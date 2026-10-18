import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)),
  destination = path.join(root, 'dist');
const checked = spawnSync(process.execPath, [path.join(root, 'scripts/check.mjs'), root], {
  stdio: 'inherit',
});
if (checked.status !== 0) process.exit(checked.status || 1);
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
for (const name of [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'sw.js',
  'js',
  'assets',
  'vnr',
])
  fs.cpSync(path.join(root, name), path.join(destination, name), { recursive: true });
function publicationModes(directory) {
  fs.chmodSync(directory, 0o755);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) publicationModes(file);
    else fs.chmodSync(file, 0o644);
  }
}
publicationModes(destination);
const built = spawnSync(process.execPath, [path.join(root, 'scripts/check.mjs'), destination], {
  stdio: 'inherit',
});
if (built.status !== 0) process.exit(built.status || 1);
console.log('Static HTTPS publication bundle: dist/');
