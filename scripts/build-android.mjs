import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { verifyCloudOrigin } from './verify-cloud-origin.mjs';

const root = process.cwd();
const release = process.argv.includes('--release');
if (release) {
  for (const key of [
    'LIFEOS_ANDROID_KEYSTORE',
    'LIFEOS_ANDROID_KEYSTORE_PASSWORD',
    'LIFEOS_ANDROID_KEY_ALIAS',
    'LIFEOS_ANDROID_KEY_PASSWORD',
  ]) {
    if (!process.env[key]) throw new Error(`Set ${key} before building a release APK.`);
  }
}
if (process.env.LIFEOS_CLOUD_URL) {
  await verifyCloudOrigin(process.env.LIFEOS_CLOUD_URL);
}
const sdk = process.env.ANDROID_HOME || path.join(root, '.android-toolchain', 'sdk');
const runtime =
  process.env.LIFEOS_ANDROID_NODE_BINARY ||
  path.join(root, '.android-toolchain', 'node', 'libnode.so');
const gradleExecutable = process.platform === 'win32' ? 'gradle.bat' : 'gradle';
const localGradle = path.join(root, '.android-toolchain', 'gradle-8.11.1', 'bin', gradleExecutable);
const gradle = existsSync(localGradle)
  ? localGradle
  : path.join(root, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

for (const [name, file] of [
  ['Android SDK', path.join(sdk, 'platforms', 'android-35', 'android.jar')],
  ['Android Node runtime', runtime],
  ['Gradle wrapper', gradle],
]) {
  try {
    await stat(file);
  } catch {
    throw new Error(`${name} is missing: ${file}. See ANDROID.md.`);
  }
}
if (!process.env.JAVA_HOME) throw new Error('Set JAVA_HOME to JDK 17 or newer.');

const exitCode = await new Promise((resolve, reject) => {
  const windows = process.platform === 'win32';
  const command = windows ? process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe' : gradle;
  const args = windows
    ? [
        '/d',
        '/c',
        gradle,
        release ? 'assembleRelease' : 'assembleDebug',
        '--no-daemon',
        '--console=plain',
      ]
    : [release ? 'assembleRelease' : 'assembleDebug', '--no-daemon', '--console=plain'];
  const build = spawn(command, args, {
    cwd: path.join(root, 'android'),
    stdio: 'inherit',
    env: { ...process.env, ANDROID_HOME: sdk, LIFEOS_ANDROID_NODE_BINARY: runtime },
  });
  build.once('error', reject);
  build.once('exit', (code) => resolve(code ?? 1));
});
if (exitCode !== 0) throw new Error(`Android build failed with exit code ${exitCode}.`);

const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const outputDir = path.join(root, 'dist-android');
await mkdir(outputDir, { recursive: true });
const variant = release ? 'release' : 'debug';
const apk = path.join(
  root,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  variant,
  `app-${variant}.apk`,
);
const output = path.join(outputDir, `LifeOS-${version}-arm64${release ? '-release' : ''}.apk`);
await copyFile(apk, output);
const hash = createHash('sha256')
  .update(await readFile(output))
  .digest('hex');
console.log(`APK: ${output}\nSHA-256: ${hash}`);
