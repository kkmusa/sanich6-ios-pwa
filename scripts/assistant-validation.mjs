import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const normalize = (text) =>
  text
    .replace(/^\s*\d{1,4}\s*$/gm, '')
    .replaceAll('\u00ad', '')
    .replace(/[\uf02d\uf0a7]/g, '—')
    .replace(/-[ \t]*\n[ \t]*(?=\p{L}|\d|_)/gu, '-')
    .replace(/\s+/g, ' ')
    .trim();

// Evidence is retained for maintainers; it is never rendered in the application.
export function checkAssistant(read, researchDirectory = process.env.DNG_SOURCE_RESEARCH) {
  const context = {};
  vm.runInNewContext(read('js/assistant-reglament-data.js'), context);
  const topics = context.DNG_REG_ASSISTANT;
  const audit = JSON.parse(read('docs/assistant-sources.json'));
  assert.equal(topics.length, 12);
  assert.equal(audit.topics.length, topics.length);
  const documents = new Map(audit.sourceFiles.map((source) => [source.document, source]));
  const raw = new Map();
  function sourcePage(document, page) {
    if (!raw.has(document)) {
      const name = document === 'vnr' ? 'vnr-pages.json' : document + '.json';
      raw.set(document, JSON.parse(fs.readFileSync(path.join(researchDirectory, name), 'utf8')));
    }
    const entry = raw.get(document)[page - 1];
    assert.equal(entry.pdfPage || entry.page, page);
    return normalize(entry.text);
  }
  let points = 0;
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const evidence = audit.topics[i];
    assert.equal(topic.title, evidence.title);
    assert.ok(topic.steps.length > 0);
    assert.equal(topic.steps.length, evidence.steps.length);
    assert.equal(topic.stepSources.length, topic.steps.length);
    for (let n = 0; n < topic.steps.length; n++) {
      const text = topic.steps[n];
      const proof = evidence.steps[n];
      assert.equal(text, proof.displayText, topic.title);
      assert.equal(
        crypto.createHash('sha256').update(text).digest('hex'),
        proof.displaySha256,
        `${topic.title}, paragraph ${n + 1}`,
      );
      assert.ok(proof.sourceQuote?.trim());
      const source = documents.get(proof.document);
      assert.ok(source, proof.document);
      assert.ok(proof.pages.length > 0);
      for (const page of proof.pages)
        assert.ok(Number.isInteger(page) && page >= 1 && page <= source.pages);
      assert.ok(topic.stepSources[n].length > 0);
      for (const index of topic.stepSources[n]) {
        const reference = topic.sources[index];
        assert.equal(reference.document, proof.document);
        assert.equal(reference.clause, proof.clause);
        assert.equal(reference.page, proof.page);
      }
      if (researchDirectory) {
        if (proof.quoteParts) {
          assert.equal(
            normalize(proof.quoteParts.map((part) => part.text).join(' ')),
            normalize(proof.sourceQuote),
          );
          for (const part of proof.quoteParts)
            assert.ok(sourcePage(proof.document, part.page).includes(normalize(part.text)));
        } else {
          const original = proof.pages.map((page) => sourcePage(proof.document, page)).join(' ');
          assert.ok(original.includes(normalize(proof.sourceQuote)), `${topic.title}: ${proof.clause}`);
        }
      }
      points++;
    }
  }
  return { topics: topics.length, points, originalPagesChecked: Boolean(researchDirectory) };
}
