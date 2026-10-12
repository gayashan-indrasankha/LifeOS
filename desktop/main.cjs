const { app, BrowserWindow, dialog, safeStorage, shell } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { startEmbeddedDatabase, freeLoopbackPort } = require('./runtime.cjs');
const { cloudOrigin } = require('./cloud-config.cjs');

let database;
let server;
let closing = false;

if (process.env.HABITFLOW_DESKTOP_DATA_DIR) {
  mkdirSync(process.env.HABITFLOW_DESKTOP_DATA_DIR, { recursive: true });
  app.setPath('userData', process.env.HABITFLOW_DESKTOP_DATA_DIR);
} else {
  const previousDataDir = path.join(app.getPath('appData'), 'HabitFlow');
  if (existsSync(path.join(previousDataDir, 'database'))) app.setPath('userData', previousDataDir);
}

function persistentAuthSecret(dir) {
  if (!safeStorage.isEncryptionAvailable())
    throw new Error('Windows secure storage is unavailable.');
  const file = path.join(dir, 'auth-secret.bin');
  if (existsSync(file)) return safeStorage.decryptString(readFileSync(file)).toString();
  const secret = crypto.randomBytes(48).toString('base64url');
  writeFileSync(file, safeStorage.encryptString(secret));
  return secret;
}

async function waitForServer(url, child) {
  let output = '';
  const appendOutput = (chunk) => {
    output += chunk.toString();
    if (output.length > 8000) output = output.slice(-8000);
  };
  child.stdout?.on('data', appendOutput);
  child.stderr?.on('data', appendOutput);
  child.on('error', appendOutput);
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) {
      const detail = output.trim();
      throw new Error(
        detail
          ? `The application server stopped during startup.\n\n${detail}`
          : 'The application server stopped during startup.',
      );
    }
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* Server is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('The application server did not become ready.');
}

async function launch() {
  const dataDir = app.getPath('userData');
  mkdirSync(dataDir, { recursive: true });
  const localDataExists = existsSync(path.join(dataDir, 'database'));
  let useLocal = !cloudOrigin;
  if (cloudOrigin && localDataExists) {
    const choice = await dialog.showMessageBox({
      type: 'question',
      title: 'Move LifeOS data online',
      message: 'This computer has LifeOS data stored locally.',
      detail:
        'Open the local app to export a JSON backup, then sign in to online LifeOS and restore it there. Your local database will be kept on this computer.',
      buttons: ['Open local data to export', 'Open online LifeOS', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (choice.response === 2) {
      app.quit();
      return;
    }
    useLocal = choice.response === 0;
  }
  const origin = useLocal ? await startLocalServer(dataDir) : cloudOrigin;
  const window = new BrowserWindow({
    icon: path.join(__dirname, 'icon.ico'),
    width: 1380,
    height: 900,
    minWidth: 370,
    minHeight: 600,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origin + '/')) return { action: 'allow' };
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== origin && !url.startsWith(origin + '/')) event.preventDefault();
  });
  try {
    await window.loadURL(origin);
  } catch (error) {
    if (useLocal) throw error;
    const page = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>LifeOS is offline</title><style>body{font:16px system-ui;margin:3rem;max-width:30rem;line-height:1.5}a{display:inline-block;margin-top:1rem;padding:.8rem 1.2rem;border-radius:.7rem;background:#1647ce;color:white;text-decoration:none}</style></head><body><h1>LifeOS could not connect</h1><p>Check your internet connection, then try again. Your online data has not been changed.</p><a href="${origin}">Retry connection</a></body></html>`;
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  }
  window.show();
}

async function startLocalServer(dataDir) {
  const root = app.getAppPath();
  const migrationsFolder = path.join(root, 'lib', 'db', 'migrations');
  const serverRoot = path.join(root, '.next', 'standalone');
  const serverFile = path.join(serverRoot, 'server.js');
  if (!existsSync(serverFile)) throw new Error('The bundled application server is missing.');

  database = await startEmbeddedDatabase(path.join(dataDir, 'database'), migrationsFolder);
  const port = await freeLoopbackPort();
  const origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [serverFile], {
    cwd: serverRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: database.url,
      BETTER_AUTH_URL: origin,
      NEXT_PUBLIC_APP_URL: origin,
      BETTER_AUTH_SECRET: persistentAuthSecret(dataDir),
    },
  });
  await waitForServer(origin, server);
  return origin;
}

async function shutdown() {
  if (closing) return;
  closing = true;
  if (server && server.exitCode === null) server.kill();
  if (database) await database.close();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => BrowserWindow.getAllWindows()[0]?.focus());
  app
    .whenReady()
    .then(launch)
    .catch(async (error) => {
      try {
        writeFileSync(
          path.join(app.getPath('userData'), 'startup-error.log'),
          error instanceof Error ? error.message : 'Unknown startup error',
        );
      } catch {
        /* The user data directory may itself be unavailable. */
      }
      dialog.showErrorBox(
        'LifeOS could not start',
        error instanceof Error ? error.message : 'Unknown startup error',
      );
      await shutdown();
      app.quit();
    });
  app.on('window-all-closed', () => {
    void shutdown().finally(() => app.quit());
  });
}
