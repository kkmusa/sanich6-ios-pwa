(function () {
  const button = document.getElementById('vnr-download');
  const label = document.getElementById('vnr-download-status');
  const bar = document.getElementById('vnr-download-progress');
  const panel = button.closest('.vnr-offline');
  panel.hidden = true;
  let dismissed = false,
    userOpened = false;
  try {
    dismissed = localStorage.getItem('sanich_vnr_download_dismissed') === '1';
  } catch {}
  const style = document.createElement('style');
  style.textContent =
    '.vnr-offline[hidden]{display:none}.vnr-offline{top:166px;bottom:auto;left:8px;right:8px;max-width:none;z-index:125;font-size:14px}.vnr-offline button{min-height:40px}.vnr-download-close{float:right;font-size:22px}.vnr-refresh{margin-right:0}';
  document.head.appendChild(style);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'vnr-download-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Закрыть загрузку');
  close.onclick = () => {
    panel.hidden = true;
    userOpened = false;
    dismissed = true;
    try {
      localStorage.setItem('sanich_vnr_download_dismissed', '1');
    } catch {}
  };
  panel.prepend(close);
  const refreshChoice = document.createElement('label');
  refreshChoice.style.display = 'block';
  refreshChoice.style.margin = '8px 0';
  refreshChoice.innerHTML =
    '<input type="checkbox" id="vnr-force-refresh"> Обновить уже скачанные страницы из опубликованной версии (нужен интернет)';
  button.before(refreshChoice);
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.id = 'vnr-offline-open';
  refresh.className = 'vnr-refresh';
  refresh.textContent = 'Скачать';
  refresh.setAttribute('aria-label', 'Загрузка и проверка офлайн-копии регламента');
  refresh.onclick = () => {
    userOpened = true;
    panel.hidden = false;
    send('VNR_STATUS');
  };
  // bookmarks.js constructs the shared progress toolbar after this script.
  function attach() {
    const toolbar = document.querySelector('.vnr-position');
    if (toolbar) toolbar.appendChild(refresh);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
  const update = (saved, total) => {
    refresh.textContent = saved === total ? 'Офлайн ✓' : 'Скачать';
    if (saved === total && !userOpened) panel.hidden = true;
    else if (saved < total && !dismissed) panel.hidden = false;
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
      const worker = await window.DngOfflineWorker.ready();
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
        if (data.type === 'complete') {
          label.textContent = 'Готово: 207 страниц доступны офлайн';
          userOpened = false;
          panel.hidden = true;
        }
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
  button.textContent = 'Загрузить / проверить офлайн-копию';
  button.disabled = false;
  button.addEventListener('click', () => {
    button.disabled = true;
    label.textContent = 'Загрузка… Не закрывайте приложение';
    send(document.getElementById('vnr-force-refresh').checked ? 'VNR_REFRESH' : 'VNR_DOWNLOAD');
  });
  send('VNR_STATUS');
})();
