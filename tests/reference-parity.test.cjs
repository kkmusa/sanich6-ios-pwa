const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path');
test('all Android assistant topics, original wording and formatting are preserved', () => {
  const context = {};
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../js/reference-data.js'), 'utf8') +
      ';globalThis.topics=assistantTopics',
    context,
  );
  const actual = JSON.parse(JSON.stringify(context.topics)),
    expected = require('./android-assistant-topics.json');
  for (const topic of expected)
    assert.deepEqual(
      actual.find((x) => x.title === topic.title),
      topic,
      topic.title,
    );
  assert.equal(expected.length, 12);
});
