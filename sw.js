const CACHE = 'operator-dng-pwa-v3.0.8';
const VNR_CACHE = 'operator-dng-vnr-pages-v1';
const VNR_TOTAL = 207;
const OP_CACHE = 'operator-dng-photos-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=3.0.8',
  './js/core.js?v=3.0.8',
  './js/calculation-help-data.js?v=3.0.8',
  './js/calculation-help.js?v=3.0.8',
  './js/ui-components.js?v=3.0.8',
  './js/math.js?v=3.0.8',
  './js/calculators.js?v=3.0.8',
  './js/manual.js?v=3.0.8',
  './js/engineering.js?v=3.0.8',
  './js/reference-data.js?v=3.0.8',
  './js/reference-ui.js?v=3.0.8',
  './js/ped.js?v=3.0.8',
  './js/operator-data.js?v=3.0.8',
  './js/operators.js?v=3.0.8',
  './js/bootstrap.js?v=3.0.8',
  './manifest.webmanifest',
  './assets/logo.png',
  './assets/PedCoolingDatabase.json',
  './assets/ic_manual_debit.png',
  './assets/ic_ped_cooling.png',
  './assets/ic_well_inflow.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];
self.addEventListener('install', (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        await cache.addAll(SHELL);
        // The full document is distributed separately; its absence must not break the app shell.
        try {
          await cache.addAll([
            './vnr/index.html',
            './vnr/search-data.js?v=3.0.8',
            './vnr/reader.js?v=3.0.8',
            './vnr/toolbar.js?v=3.0.8',
            './vnr/offline.js?v=3.0.8',
            './vnr/bookmarks.js?v=3.0.8',
            './vnr/layout.css?v=3.0.8',
            './vnr/layout.js?v=3.0.8',
          ]);
        } catch {}
      })
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('operator-dng-pwa-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
function offlineError(error) {
  return error?.name === 'QuotaExceededError'
    ? 'Недостаточно места для офлайн-файлов. Освободите место и повторите загрузку.'
    : String(error?.message || error);
}
function isImage(response) {
  return (
    !!response?.ok &&
    response.type !== 'opaque' &&
    /^image\/(jpeg|png)(?:;|$)/i.test(response.headers.get('content-type') || '')
  );
}
async function cachedImage(request, cacheName) {
  const cache = await caches.open(cacheName),
    cached = await cache.match(request);
  if (isImage(cached)) return cached;
  const response = await fetch(request);
  if (isImage(response)) await cache.put(request, response.clone());
  return response;
}
self.addEventListener('fetch', (event) => {
  const req = event.request,
    url = new URL(req.url),
    scope = new URL(self.registration.scope);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(new URL('vnr/pages/', scope).pathname)) {
    event.respondWith(cachedImage(req, VNR_CACHE));
    return;
  }
  if (url.pathname.startsWith(new URL('assets/operators/', scope).pathname)) {
    event.respondWith(cachedImage(req, OP_CACHE));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(req);
          if (!response.ok) throw Error('HTTP ' + response.status);
          if (
            url.pathname === scope.pathname ||
            url.pathname === new URL('index.html', scope).pathname ||
            url.pathname === new URL('vnr/index.html', scope).pathname
          )
            await cache.put(req, response.clone());
          return response;
        } catch {
          const cached = await cache.match(req);
          if (cached) return cached;
          if (url.pathname === new URL('vnr/index.html', scope).pathname)
            return new Response(
              '<!doctype html><meta charset="utf-8"><title>Регламент ВНР</title><p>Регламент ВНР недоступен. Загрузите документ при наличии интернета.</p>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            );
          return await cache.match(new URL('index.html', scope));
        }
      })(),
    );
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE),
        cached = await cache.match(req);
      if (cached) return cached;
      const response = await fetch(req);
      if (response.ok && response.type === 'basic') await cache.put(req, response.clone());
      return response;
    })(),
  );
});

// Explicit offline download; keep the document cache independent of app releases.
let vnrDownloadRunning = false;
self.addEventListener('message', (event) => {
  if (!event.data || !['VNR_DOWNLOAD', 'VNR_REFRESH'].includes(event.data.type)) return;
  const port = event.ports && event.ports[0];
  if (!port) return;
  if (vnrDownloadRunning) {
    port.postMessage({ type: 'error', message: 'Загрузка уже выполняется' });
    return;
  }
  vnrDownloadRunning = true;
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(VNR_CACHE);
        let saved = 0;
        for (let i = 1; i <= VNR_TOTAL; i++) {
          const url = new URL(
            './vnr/pages/' + String(i).padStart(3, '0') + '.jpg',
            self.registration.scope,
          );
          const old = await cache.match(url);
          if (isImage(old) && event.data.type !== 'VNR_REFRESH') {
            saved++;
            port.postMessage({ type: 'progress', saved, total: VNR_TOTAL });
            continue;
          }
          const response = await fetch(url, { cache: 'no-store' });
          if (!isImage(response))
            throw new Error('Страница ' + i + ': ожидалось изображение, HTTP ' + response.status);
          await cache.put(url, response);
          saved++;
          port.postMessage({ type: 'progress', saved, total: VNR_TOTAL });
        }
        port.postMessage({ type: 'complete', saved, total: VNR_TOTAL });
      } catch (err) {
        port.postMessage({ type: 'error', message: offlineError(err) });
      } finally {
        vnrDownloadRunning = false;
        port.close();
      }
    })(),
  );
});
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'VNR_STATUS') return;
  const port = event.ports && event.ports[0];
  if (!port) return;
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(VNR_CACHE);
        let saved = 0;
        for (let i = 1; i <= VNR_TOTAL; i++) {
          const url = new URL(
            './vnr/pages/' + String(i).padStart(3, '0') + '.jpg',
            self.registration.scope,
          );
          if (isImage(await cache.match(url))) saved++;
        }
        port.postMessage({ type: 'status', saved, total: VNR_TOTAL });
      } catch (err) {
        port.postMessage({ type: 'error', message: String(err) });
      } finally {
        port.close();
      }
    })(),
  );
});

// Download station photographs into a version-independent cache.
let opBusy = false;
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'OPERATORS_DOWNLOAD') return;
  const port = event.ports?.[0];
  if (!port) return;
  event.waitUntil(
    (async () => {
      if (opBusy) {
        port.postMessage({ type: 'error', message: 'Загрузка уже выполняется' });
        return;
      }
      opBusy = true;
      try {
        const paths = event.data.paths;
        if (
          !Array.isArray(paths) ||
          paths.length > 100 ||
          paths.some(
            (p) => typeof p !== 'string' || !/^assets\/operators\/[a-z0-9_-]+\.jpg$/.test(p),
          )
        )
          throw Error('Некорректные имена фотографий');
        const unique = [...new Set(paths)];
        const cache = await caches.open(OP_CACHE);
        let saved = 0;
        for (const path of unique) {
          const url = new URL(path, self.registration.scope);
          let response = await cache.match(url);
          if (!isImage(response)) {
            response = await fetch(url, { cache: 'no-store' });
            if (!isImage(response)) throw Error('Ошибка загрузки изображения: ' + path);
            await cache.put(url, response);
          }
          port.postMessage({ type: 'progress', saved: ++saved, total: unique.length });
        }
        port.postMessage({ type: 'complete', saved, total: unique.length });
      } catch (err) {
        port.postMessage({ type: 'error', message: offlineError(err) });
      } finally {
        opBusy = false;
        port.close();
      }
    })(),
  );
});
