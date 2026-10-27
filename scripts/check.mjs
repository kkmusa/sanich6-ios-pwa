import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkAssistant, authorAdditions } from './assistant-validation.mjs';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)));
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const exists = (ref) => {
  const name = decodeURIComponent(ref.split('?')[0]);
  assert.ok(fs.statSync(path.join(root, name)).isFile(), name);
  return name;
};
// Published bundles contain the display data but no internal audit documents.
// Validate the source repository before copying it into either edition.
if (fs.existsSync(path.join(root, 'docs/assistant-sources.json'))) {
  const assistant = checkAssistant(read);
  console.log(`Assistant evidence: ${assistant.topics} topics, ${assistant.points} verified display paragraphs${assistant.originalPagesChecked ? '; original source pages matched' : ''}.`);
}
const index = read('index.html'),
  manifest = JSON.parse(read('manifest.webmanifest'));
const edition = index.match(/data-edition="([^"]+)"/)?.[1];
const names = { author: 'Оператор ДНГ', reglament: 'Опер ДНГ рег', bez: 'Опер ДНГ без' };
assert.ok(names[edition]);
assert.ok(index.includes(`<title>${names[edition]}</title>`));
assert.equal(manifest.short_name, names[edition]);
assert.equal(manifest.id, './');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.orientation, 'any');
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
assert.equal(context.version.split('-v').at(-1), version);
if (edition === 'reglament') {
  const data = {};
  vm.runInNewContext(read('js/assistant-reglament-data.js'), data);
  assert.equal(data.DNG_REG_ASSISTANT.length, 12);
  vm.runInNewContext(read('js/assistant-author-extra.js'), data);
  assert.deepEqual(JSON.parse(JSON.stringify(data.DNG_REG_AUTHOR_EXTRA)), authorAdditions(read));
  for (const topic of data.DNG_REG_ASSISTANT) {
    assert.ok(topic.title && topic.steps.length > 0);
    assert.ok(topic.steps.every((step) => typeof step === 'string' && step.trim()));
  }
  assert.ok(index.indexOf('js/assistant-reglament-data.js') < index.indexOf('js/reference-data.js'));
  assert.match(context.version, /^operator-dng-reglament-pwa-/);
}
if (edition === 'bez') {
  assert.ok(!fs.existsSync(path.join(root, 'js/assistant-author-extra.js')));
  assert.ok(!fs.existsSync(path.join(root, 'js/assistant-reglament-data.js')));
  assert.ok(!index.includes('js/assistant-reglament-data.js'));
  const data = {};
  vm.runInNewContext(read('js/reference-data.js') + ';globalThis.topics=assistantTopics', data);
  assert.equal(data.topics.length, 0);
  assert.match(context.version, /^operator-dng-bez-pwa-/);
}
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
for (const [, ref] of viewer.matchAll(/<link[^>]+href="([^"]+)"/g)) exists(`vnr/${ref}`);
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
const catalog = JSON.parse(read('assets/PedCoolingCatalog-v7.json'));
assert.equal(catalog.models.length, 551);
assert.equal(db.length, catalog.models.length * catalog.geometries.length);
for (const row of db) {
  assert.ok(typeof row.name === 'string');
  assert.ok(Number.isFinite(row.power) || typeof row.power === 'string');
  for (const key of ['diameter', 'speed', 'casing', 'wall'])
    assert.ok(Number.isFinite(row[key]));
  const inner = row.casing - 2 * row.wall;
  if (inner <= row.diameter) assert.equal(row.flow, null);
  else {
    const expected = Math.PI / 4 * ((inner / 1000) ** 2 - (row.diameter / 1000) ** 2) * row.speed * 86400;
    assert.ok(row.flow > 0 && Math.abs(row.flow - expected) < 1e-9);
  }
}
console.log(
  `OK ${version} (${edition}): 207 pages, ${words} search words, 335 internal + 3 external links, ${steps} station steps, ${photos.size} photos, ${db.length} PED records; scripts, manifest and cache assets valid.`,
);
