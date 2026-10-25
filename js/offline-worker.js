// Resolve the worker for this application's folder, including the embedded VNR reader.
// A more general parent registration must never receive this edition's downloads.
(function () {
  'use strict';
  const scope = new URL('../', document.currentScript.src).href;
  const scriptURL = new URL('sw.js', scope).href;
  let pending = null,
    resolvedWorker = null;

  function ready() {
    if (resolvedWorker && resolvedWorker.state !== 'activated') {
      pending = null;
      resolvedWorker = null;
    }
    if (pending) return pending;
    const attempt = new Promise((resolve, reject) => {
      let finished = false,
        registration = null;
      const observed = new Map();
      const timeout = setTimeout(
        () =>
          finish(null, Error('Офлайн-модуль не готов. Повторите загрузку при наличии интернета.')),
        10000,
      );

      function finish(worker, error) {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        registration?.removeEventListener('updatefound', inspect);
        for (const [item, listener] of observed) item.removeEventListener('statechange', listener);
        if (error) reject(error);
        else {
          resolvedWorker = worker;
          resolve(worker);
        }
      }
      function isOwnWorker(worker) {
        return worker && worker.scriptURL === scriptURL;
      }
      function inspect() {
        if (finished) return;
        if (isOwnWorker(registration.active) && registration.active.state === 'activated') {
          finish(registration.active);
          return;
        }
        const workers = [registration.active, registration.waiting, registration.installing].filter(
          isOwnWorker,
        );
        for (const worker of workers) {
          if (observed.has(worker)) continue;
          const listener = () => {
            if (worker.state === 'redundant') {
              const replacement = [
                registration.active,
                registration.waiting,
                registration.installing,
              ].some((item) => isOwnWorker(item) && item.state !== 'redundant');
              if (!replacement) {
                finish(null, Error('Не удалось запустить офлайн-модуль. Повторите загрузку.'));
                return;
              }
            }
            inspect();
          };
          observed.set(worker, listener);
          worker.addEventListener('statechange', listener);
        }
        if (workers.length && workers.every((worker) => worker.state === 'redundant'))
          finish(null, Error('Не удалось запустить офлайн-модуль. Повторите загрузку.'));
      }

      if (!('serviceWorker' in navigator)) {
        finish(null, Error('Service Worker недоступен'));
        return;
      }
      Promise.resolve()
        .then(() => navigator.serviceWorker.register(scriptURL, { scope }))
        .then((ownRegistration) => {
          if (finished) return;
          if (!ownRegistration || ownRegistration.scope !== scope) {
            finish(null, Error('Офлайн-модуль относится к другому приложению'));
            return;
          }
          registration = ownRegistration;
          registration.addEventListener('updatefound', inspect);
          inspect();
        })
        .catch((error) => finish(null, error));
    });
    const result = attempt.catch((error) => {
      if (pending === result) {
        pending = null;
        resolvedWorker = null;
      }
      throw error;
    });
    pending = result;
    return result;
  }

  window.DngOfflineWorker = { scope, ready };
})();
