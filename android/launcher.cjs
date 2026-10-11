const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { startEmbeddedDatabase } = require('../desktop/runtime.cjs');

let database;
let shuttingDown = false;

function authSecret(dataDir) {
  const file = path.join(dataDir, 'auth-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const value = crypto.randomBytes(48).toString('base64url');
  try {
    fs.writeFileSync(file, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return value;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return fs.readFileSync(file, 'utf8').trim();
  }
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (database) await database.close();
}

async function main() {
  const dataDir = process.env.HABITFLOW_ANDROID_DATA_DIR;
  const port = Number(process.env.PORT);
  if (!dataDir || !path.isAbsolute(dataDir)) {
    throw new Error('HABITFLOW_ANDROID_DATA_DIR must be an absolute path.');
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('PORT must be an unprivileged TCP port.');
  }

  const root = path.resolve(__dirname, '..');
  const serverFile = path.join(root, '.next', 'standalone', 'server.js');
  if (!fs.existsSync(serverFile)) throw new Error('The bundled LifeOS server is missing.');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  database = await startEmbeddedDatabase(
    path.join(dataDir, 'database'),
    path.join(root, 'lib', 'db', 'migrations'),
  );

  const origin = `http://127.0.0.1:${port}`;
  Object.assign(process.env, {
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    DATABASE_URL: database.url,
    BETTER_AUTH_URL: origin,
    NEXT_PUBLIC_APP_URL: origin,
    BETTER_AUTH_SECRET: authSecret(dataDir),
    HABITFLOW_EMBEDDED_DB: '1',
  });

  process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));
  process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
  require(serverFile);
}

main().catch(async (error) => {
  try {
    if (process.env.HABITFLOW_ANDROID_DATA_DIR) {
      fs.writeFileSync(
        path.join(process.env.HABITFLOW_ANDROID_DATA_DIR, 'startup-error.log'),
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
    }
  } catch {
    // Startup errors are still written to stderr when storage is unavailable.
  }
  console.error(error);
  await shutdown();
  process.exit(1);
});
