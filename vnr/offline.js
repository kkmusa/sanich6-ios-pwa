(function () {
  const button = document.getElementById('vnr-download');
  const label = document.getElementById('vnr-download-status');
  const bar = document.getElementById('vnr-download-progress');
  const update = (saved, total) => {
    bar.max = total;
    bar.value = saved;
    label.textContent =
      saved === total
        ? 'Все 207 страниц сохранены для офлайн-доступа'
        : `Сохранено ${saved} из ${total} страниц`;
  };
  async function send(type) {
    if (!('serviceWorker' in navigator)) {
      label.textContent = 'Safari не поддерживает офлайн-загрузку в этом режиме';
      return;
    }
    try {
      const reg = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Офлайн-модуль не готов')), 10000);
        navigator.serviceWorker.ready.then(
          (reg) => {
            clearTimeout(timer);
            resolve(reg);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          },
        );
      });
      const worker = navigator.serviceWorker.controller || reg.active;
      if (!worker) throw new Error('Service Worker ещё не запущен');
      const channel = new MessageChannel();
      let timeout;
      const arm = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          channel.port1.close();
          button.disabled = false;
          label.textContent = 'Нет ответа от офлайн-модуля. Повторите загрузку.';
        }, 30000);
      };
      arm();
      channel.port1.onmessage = (e) => {
        arm();
        const data = e.data || {};
        if (data.type === 'progress' || data.type === 'complete' || data.type === 'status')
          update(data.saved, data.total);
        if (data.type === 'complete' || data.type === 'error') button.disabled = false;
        if (data.type === 'error')
          label.textContent =
            'Не удалось завершить: ' + data.message + '. Нажмите ещё раз для продолжения.';
        if (data.type === 'complete') label.textContent = 'Готово: 207 страниц доступны офлайн';
        if (['complete', 'error', 'status'].includes(data.type)) {
          clearTimeout(timeout);
          channel.port1.close();
        }
      };
      worker.postMessage({ type }, [channel.port2]);
    } catch (err) {
      button.disabled = false;
      label.textContent = 'Ошибка: ' + err.message;
    }
  }
  button.disabled = false;
  button.addEventListener('click', () => {
    button.disabled = true;
    label.textContent = 'Загрузка… Не закрывайте приложение';
    send('VNR_DOWNLOAD');
  });
  send('VNR_STATUS');
})();
