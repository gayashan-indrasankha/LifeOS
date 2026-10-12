const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { freeLoopbackPort } = require('../desktop/runtime.cjs');

const root = path.resolve('android-stage');
const dataDir = mkdtempSync(path.join(tmpdir(), 'lifeos-android-smoke-'));

async function start(port) {
  const child = spawn(process.execPath, [path.join(root, 'android', 'launcher.cjs')], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HABITFLOW_ANDROID_DATA_DIR: dataDir,
      VERCEL_ENV: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      output = (output + chunk.toString()).slice(-8000);
    });
  }
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 240; attempt++) {
    if (child.exitCode !== null) throw new Error(`Android launcher exited:\n${output}`);
    try {
      const response = await fetch(`${origin}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return { child, origin };
    } catch {
      // The embedded database and server are still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  child.kill();
  throw new Error(`Android launcher timed out:\n${output}`);
}

async function stop(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function main() {
  const email = `android-${crypto.randomUUID()}@example.test`;
  const password = 'Android-smoke-password-42';
  let child;
  try {
    const first = await start(await freeLoopbackPort());
    child = first.child;
    const registration = await fetch(`${first.origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: first.origin },
      body: JSON.stringify({ name: 'Android Smoke', email, password }),
    });
    if (!registration.ok) throw new Error(`Registration failed: HTTP ${registration.status}`);
    const cookie = registration.headers
      .getSetCookie()
      .map((item) => item.split(';', 1)[0])
      .join('; ');
    if (!cookie) throw new Error('Registration returned no session cookie.');
    const dashboard = await fetch(`${first.origin}/dashboard`, { headers: { Cookie: cookie } });
    if (!dashboard.ok) throw new Error(`Dashboard failed: HTTP ${dashboard.status}`);
    const backup = await fetch(`${first.origin}/api/export`, { headers: { Cookie: cookie } });
    const data = await backup.json();
    if (!backup.ok || data.schemaVersion !== 2) {
      throw new Error('Backup export failed.');
    }
    const noteId = crypto.randomUUID();
    data.dailyNotes.push({
      id: noteId,
      date: '2026-10-12',
      content: 'Cloud migration smoke note',
      createdAt: '2026-10-12T00:00:00.000Z',
      updatedAt: '2026-10-12T00:00:00.000Z',
    });
    const merge = (payload, compressed = false) =>
      fetch(`${first.origin}/api/import/merge`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: first.origin,
          'Content-Type': compressed ? 'application/gzip' : 'application/json',
        },
        body: compressed ? gzipSync(JSON.stringify(payload)) : JSON.stringify(payload),
      });
    const firstMerge = await merge(data);
    if (!firstMerge.ok || (await firstMerge.json()).added !== 1) {
      throw new Error(`Safe migration failed: HTTP ${firstMerge.status}`);
    }
    const repeatedMerge = await merge(data, true);
    if (!repeatedMerge.ok || (await repeatedMerge.json()).alreadyPresent < 1) {
      throw new Error('Repeating a migration was not idempotent.');
    }
    data.dailyNotes[0].content = 'Conflicting note';
    const conflict = await merge(data);
    if (conflict.status !== 409) throw new Error('A conflicting migration was not rejected.');
    const verified = await fetch(`${first.origin}/api/export`, { headers: { Cookie: cookie } });
    const after = await verified.json();
    if (
      after.dailyNotes.find((note) => note.id === noteId)?.content !== 'Cloud migration smoke note'
    ) {
      throw new Error('A rejected migration changed existing data.');
    }
    await stop(child);
    child = undefined;

    const second = await start(await freeLoopbackPort());
    child = second.child;
    const login = await fetch(`${second.origin}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: second.origin },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) throw new Error(`Stored account was lost: HTTP ${login.status}`);
    console.log('Android local server and persisted account smoke passed.');
  } finally {
    if (child) await stop(child);
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
