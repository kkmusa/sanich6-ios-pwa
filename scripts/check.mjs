import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)));
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const exists = (ref) => {
  const name = decodeURIComponent(ref.split('?')[0]);
  assert.ok(fs.statSync(path.join(root, name)).isFile(), name);
  return name;
};
const index = read('index.html'),
  manifest = JSON.parse(read('manifest.webmanifest'));
assert.match(index, /<title>Саныч-6<\/title>/);
assert.equal(manifest.short_name, 'Саныч-6');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
for (const [, ref] of index.matchAll(/(?:src|href)="([^"]+)"/g))
  if (!/^(https?:|data:|#)/.test(ref)) exists(ref);
for (const icon of manifest.icons) {
  const p = exists(icon.src),
    buffer = fs.readFileSync(path.join(root, p));
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  assert.equal(`${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`, icon.sizes);
}
const context = { self: { addEventListener() {} } };
vm.runInNewContext(read('sw.js') + '\n;globalThis.shell=SHELL;globalThis.version=CACHE;', context);
for (const asset of context.shell) if (asset !== './') exists(asset);
const version = read('js/core.js').match(/APP_VERSION\s*=\s*['"]([^'"]+)/)?.[1];
assert.ok(version);
assert.equal(context.version.split('-v').at(-1), version.split('.').at(-1));
for (const directory of ['js', 'vnr'])
  for (const file of fs.readdirSync(path.join(root, directory)))
    if (file.endsWith('.js'))
      new vm.Script(read(`${directory}/${file}`), { filename: `${directory}/${file}` });
new vm.Script(read('sw.js'));
const viewer = read('vnr/index.html'),
  pages = [...viewer.matchAll(/<section class="page" id="page-(\d+)"/g)].map((m) => Number(m[1]));
assert.deepEqual(
  pages,
  Array.from({ length: 207 }, (_, i) => i + 1),
);
for (const [, ref] of viewer.matchAll(/<script src="([^"]+)"/g)) exists(`vnr/${ref}`);
const images = [...viewer.matchAll(/<img src="pages\/(\d{3}\.jpg)" width="(\d+)" height="(\d+)"/g)];
assert.equal(images.length, 207);
for (const [, name] of images) {
  const bytes = fs.readFileSync(path.join(root, 'vnr/pages', name));
  assert.equal(bytes[0], 255);
  assert.equal(bytes[1], 216);
  assert.ok(bytes.length > 1000);
}
assert.equal(
  fs.readdirSync(path.join(root, 'vnr/pages')).filter((name) => name.endsWith('.jpg')).length,
  207,
);
const data = {};
vm.runInNewContext(read('vnr/search-data.js') + '\n;globalThis.pages=wordPages;', data);
assert.equal(data.pages.length, 207);
let words = 0;
for (const page of data.pages) {
  assert.ok(page.length > 0);
  for (const word of page) {
    assert.equal(typeof word[0], 'string');
    assert.equal(word.length, 5);
    assert.ok(word.slice(1).every(Number.isFinite));
    assert.ok(word[1] >= 0 && word[2] >= 0 && word[3] > 0 && word[4] > 0);
    words++;
  }
}
const internal = [...viewer.matchAll(/onclick="jumpPage\((\d+)\);return false"/g)];
assert.equal(internal.length, 335);
assert.equal((viewer.match(/class="link-hotspot"/g) || []).length, 338);
for (const [, page] of internal) assert.ok(Number(page) >= 1 && Number(page) <= 207);
const stations = {};
vm.runInNewContext(read('js/operator-data.js') + '\n;globalThis.steps=operatorSteps;', stations);
let steps = 0;
const photos = new Set();
for (const mode of ['ramp', 'rich']) {
  assert.equal(Object.keys(stations.steps[mode]).length, 5);
  for (const entries of Object.values(stations.steps[mode]))
    for (const step of entries) {
      assert.ok(step.title && step.description);
      exists(step.image);
      photos.add(step.image);
      steps++;
    }
}
const db = JSON.parse(read('assets/PedCoolingDatabase.json'));
assert.equal(db.length, 16160);
for (const row of db) {
  assert.ok(typeof row.name === 'string');
  for (const key of ['diameter', 'power', 'speed', 'casing', 'wall', 'flow'])
    assert.ok(Number.isFinite(row[key]));
}
console.log(
  `OK ${version}: 207 pages, ${words} search words, 335 internal + 3 external links, ${steps} station steps, ${photos.size} photos, ${db.length} PED records; scripts, manifest and cache assets valid.`,
);
