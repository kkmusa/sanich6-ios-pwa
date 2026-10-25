import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
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
const publishedFiles = [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'sw.js',
  'js',
  'assets',
  'vnr',
];
for (const name of publishedFiles)
  fs.cpSync(path.join(root, name), path.join(destination, name), { recursive: true });

// All three editions share calculations. Only assistant availability/content,
// installation identity and persistent storage namespaces differ.
const editions = [
  { directory: 'reglament', name: 'Опер ДНГ рег', assistant: true },
  { directory: 'bez', name: 'Опер ДНГ без', assistant: false },
];
function isolateEdition(directory, edition) {
  const id = edition.directory;
  const namespaces = [
    ['operator_dng_', `operator_dng_${id}_`],
    ['operator-dng-', `operator-dng-${id}-`],
    ['sanich6_', `sanich6_${id}_`],
    ['sanich_', `sanich_${id}_`],
    ['privacy_seen', `operator_dng_${id}_privacy_seen`],
  ];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) isolateEdition(file, edition);
    else if (/\.(js|html)$/.test(entry.name)) {
      let text = fs.readFileSync(file, 'utf8');
      for (const [from, to] of namespaces) text = text.replaceAll(from, to);
      if (entry.name.endsWith('.js')) text = text.replaceAll('Оператор ДНГ', edition.name);
      fs.writeFileSync(file, text);
    }
  }
}
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const assistant = 'js/assistant-reglament-data.js';
for (const edition of editions) {
  const folder = path.join(destination, edition.directory);
  fs.mkdirSync(folder);
  for (const name of publishedFiles)
    fs.cpSync(path.join(destination, name), path.join(folder, name), { recursive: true });
  isolateEdition(folder, edition);
  const read = (name) => fs.readFileSync(path.join(folder, name), 'utf8');
  let index = read('index.html');
  assert.ok(index.includes('data-edition="author"'));
  index = index
    .replace('data-edition="author"', `data-edition="${edition.directory}"`)
    .replace('<title>Оператор ДНГ</title>', `<title>${edition.name}</title>`)
    .replace('content="Оператор ДНГ"', `content="${edition.name}"`);
  if (edition.assistant) {
    assert.ok(fs.statSync(path.join(folder, assistant)).isFile(), 'Document assistant is required');
    index = index.replace(
      `    <script src="js/reference-data.js?v=${version}" defer></script>`,
      `    <script src="${assistant}?v=${version}" defer></script>\n    <script src="js/reference-data.js?v=${version}" defer></script>`,
    );
    assert.ok(index.includes(`src="${assistant}?v=${version}"`));
    const worker = read('sw.js').replace(
      'const SHELL = [',
      `const SHELL = [\n  './${assistant}?v=${version}',`,
    );
    fs.writeFileSync(path.join(folder, 'sw.js'), worker);
  } else {
    fs.rmSync(path.join(folder, assistant));
    const reference = read('js/reference-data.js');
    const start = reference.indexOf('const assistantTopics =');
    assert.ok(start >= 0 && reference.trimEnd().endsWith('];'));
    fs.writeFileSync(
      path.join(folder, 'js/reference-data.js'),
      reference.slice(0, start) + 'const assistantTopics = [];\n',
    );
  }
  fs.writeFileSync(path.join(folder, 'index.html'), index);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  manifest.name = edition.name;
  manifest.short_name = edition.name;
  manifest.description = edition.assistant
    ? 'Расчёты и инструкции для оператора добычи нефти и газа'
    : 'Инженерные расчёты и справочные материалы';
  fs.writeFileSync(path.join(folder, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  assert.ok(
    fs.readFileSync(path.join(destination, 'js/math.js')).equals(
      fs.readFileSync(path.join(folder, 'js/math.js')),
    ),
    'All editions must use byte-identical calculations',
  );
}
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
for (const edition of editions) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/check.mjs'), path.join(destination, edition.directory)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Static HTTPS publication bundles: dist/, dist/reglament/ and dist/bez/');
