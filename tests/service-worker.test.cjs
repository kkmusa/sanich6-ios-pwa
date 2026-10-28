const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
test('service worker upgrade preserves document, photos and unrelated application caches', async () => {
  const handlers = {},
    deleted = [];
  let claimed = false;
  const context = {
    self: {
      addEventListener: (type, fn) => {
        (handlers[type] ??= []).push(fn);
      },
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
    },
    caches: {
      keys: async () => [
        'operator-dng-pwa-v21',
        'operator-dng-pwa-v3.0.0',
        'operator-dng-pwa-v3.0.1',
        'operator-dng-pwa-v3.0.19',
        'operator-dng-vnr-pages-v1',
        'operator-dng-photos-v1',
        'another-app-cache',
      ],
      delete: async (key) => deleted.push(key),
    },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8'), context);
  let task;
  handlers.activate[0]({
    waitUntil: (promise) => {
      task = promise;
    },
  });
  await task;
  assert.deepEqual(deleted, [
    'operator-dng-pwa-v21',
    'operator-dng-pwa-v3.0.0',
    'operator-dng-pwa-v3.0.1',
  ]);
  assert.equal(claimed, true);
});
test('VNR download rejects HTML pages, reports failure and resumes without repeating saved pages', async () => {
  const handlers = {},
    saved = new Map(),
    messages = [],
    requests = [];
  let fail = true;
  const context = {
    URL,
    Response,
    Error,
    self: {
      registration: { scope: 'https://example.test/app/' },
      addEventListener: (type, fn) => {
        (handlers[type] ??= []).push(fn);
      },
    },
    caches: {
      open: async () => ({
        match: async (url) => saved.get(String(url)),
        put: async (url, response) => saved.set(String(url), response),
      }),
    },
    fetch: async (url) => {
      requests.push(String(url));
      if (fail && String(url).endsWith('002.jpg'))
        return new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } });
      return new Response('image-bytes', { headers: { 'content-type': 'image/jpeg' } });
    },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8'), context);
  const download = handlers.message[0];
  async function run(type = 'VNR_DOWNLOAD') {
    let task;
    download({
      data: { type },
      ports: [{ postMessage: (m) => messages.push(m), close() {} }],
      waitUntil: (promise) => {
        task = promise;
      },
    });
    await task;
  }
  await run();
  assert.equal(saved.size, 1);
  assert.equal(messages.at(-1).type, 'error');
  assert.ok(!messages.some((m) => m.type === 'complete'));
  fail = false;
  requests.length = 0;
  messages.length = 0;
  await run();
  assert.equal(saved.size, 207);
  assert.equal(requests.length, 206);
  assert.equal(messages.at(-1).type, 'complete');
  assert.equal(messages.at(-1).saved, 207);
  requests.length = 0;
  await run();
  assert.equal(requests.length, 0);
  await run('VNR_REFRESH');
  assert.equal(requests.length, 207);
  assert.equal(messages.at(-1).type, 'complete');
  const old = saved.get('https://example.test/app/vnr/pages/002.jpg');
  fail = true;
  messages.length = 0;
  await run('VNR_REFRESH');
  assert.equal(messages.at(-1).type, 'error');
  assert.equal(saved.get('https://example.test/app/vnr/pages/002.jpg'), old);
  assert.ok(!messages.some((message) => message.type === 'complete'));
});
test('offline quota errors are reported without claiming completion', async () => {
  const handlers = {},
    messages = [];
  const context = {
    URL,
    Response,
    self: {
      registration: { scope: 'https://example.test/' },
      addEventListener: (type, fn) => {
        (handlers[type] ??= []).push(fn);
      },
    },
    caches: {
      open: async () => ({
        match: async () => undefined,
        put: async () => {
          throw { name: 'QuotaExceededError', message: 'Disk full' };
        },
      }),
    },
    fetch: async () => new Response('image', { headers: { 'content-type': 'image/jpeg' } }),
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8'), context);
  let task;
  handlers.message[0]({
    data: { type: 'VNR_DOWNLOAD' },
    ports: [{ postMessage: (m) => messages.push(m), close() {} }],
    waitUntil: (p) => {
      task = p;
    },
  });
  await task;
  assert.equal(messages.at(-1).type, 'error');
  assert.match(messages.at(-1).message, /Недостаточно места/);
  assert.ok(!messages.some((m) => m.type === 'complete'));
});
