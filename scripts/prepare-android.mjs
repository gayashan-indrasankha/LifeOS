import { cp, mkdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const stage = path.resolve(root, 'android-stage');
if (!stage.startsWith(root + path.sep)) throw new Error('Android stage must be in the repository.');
try {
  const existing = await realpath(stage);
  if (!existing.startsWith(root + path.sep)) {
    throw new Error('Android stage resolves outside the repository.');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await rm(stage, { recursive: true, force: true });

const standalone = path.join(root, '.next', 'standalone');
await mkdir(path.join(standalone, '.next'), { recursive: true });
await cp(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), {
  recursive: true,
  force: true,
});
await cp(path.join(root, 'public'), path.join(standalone, 'public'), {
  recursive: true,
  force: true,
});

await mkdir(path.join(stage, 'node_modules', '@electric-sql'), { recursive: true });
await mkdir(path.join(stage, 'desktop'), { recursive: true });
await mkdir(path.join(stage, 'android'), { recursive: true });
await mkdir(path.join(stage, 'lib', 'db'), { recursive: true });
await cp(standalone, path.join(stage, '.next', 'standalone'), { recursive: true });
await cp(path.join(root, 'desktop', 'runtime.cjs'), path.join(stage, 'desktop', 'runtime.cjs'));
await cp(path.join(root, 'android', 'launcher.cjs'), path.join(stage, 'android', 'launcher.cjs'));
await cp(path.join(root, 'lib', 'db', 'migrations'), path.join(stage, 'lib', 'db', 'migrations'), {
  recursive: true,
});
for (const name of ['pglite', 'pglite-socket']) {
  await cp(
    path.join(root, 'node_modules', '@electric-sql', name),
    path.join(stage, 'node_modules', '@electric-sql', name),
    { recursive: true },
  );
}
await cp(
  path.join(root, 'node_modules', 'drizzle-orm'),
  path.join(stage, 'node_modules', 'drizzle-orm'),
  {
    recursive: true,
  },
);
console.log('Android runtime stage prepared.');
