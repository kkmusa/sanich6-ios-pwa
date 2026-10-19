// Shared by the PWA and Android's local WebView. No remote services.
(function () {
  'use strict';
  const KEY = 'sanich6_vnr_bookmarks_v1';
  const pages = [...document.querySelectorAll('.page')];
  if (!pages.length) return;
  const style = document.createElement('style');
  style.textContent = `.vnr-position{position:fixed;z-index:110;left:8px;right:8px;top:108px;display:flex;align-items:center;gap:8px;background:#fff7d5;border:1px solid #b58a00;border-radius:10px;padding:5px 8px;color:#171717;font:13px Arial}.vnr-position input{min-width:0;flex:1;accent-color:#c59400;height:32px}.vnr-position button,.vnr-bookmarks button{min-height:40px;border:1px solid #b58a00;border-radius:7px;background:#ffdf66;color:#171717;padding:5px 9px;font:14px Arial}.vnr-bookmarks{position:fixed;z-index:120;left:8px;right:8px;top:162px;max-height:55vh;overflow:auto;background:#fff;border:2px solid #c59400;border-radius:12px;padding:10px;box-shadow:0 4px 15px #0004;font:15px Arial}.vnr-bookmarks[hidden]{display:none}.vnr-bookmark-row{display:flex;gap:6px;margin-top:7px;align-items:center}.vnr-bookmark-row .open-bookmark{flex:1;text-align:left;overflow-wrap:anywhere}.vnr-bookmark-row button{flex-shrink:0}.page{scroll-margin-top:162px!important}body{padding-top:162px!important;padding-bottom:90px!important}.vnr-position output{white-space:nowrap;min-width:51px}.vnr-bookmark-status{font-size:13px;color:#805000}`;
  document.head.appendChild(style);
  const bar = document.createElement('div');
  bar.className = 'vnr-position';
  bar.innerHTML =
    '<output id="vnr-position-label"></output><input id="vnr-position" type="range" min="0" max="1000" value="0" step="1" aria-label="Положение в регламенте"><button type="button" id="vnr-bookmarks-toggle" aria-expanded="false">Закладки</button>';
  const panel = document.createElement('section');
  panel.className = 'vnr-bookmarks';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Закладки регламента');
  panel.innerHTML =
    '<div style="display:flex;gap:8px"><button type="button" id="vnr-bookmark-add">＋ Текущая страница</button><button type="button" id="vnr-bookmarks-close">Закрыть</button></div><p class="vnr-bookmark-status" role="status"></p><div id="vnr-bookmark-list"></div>';
  document.body.append(bar, panel);
  const slider = bar.querySelector('input'),
    label = bar.querySelector('output');
  const status = panel.querySelector('[role="status"]'),
    list = panel.querySelector('#vnr-bookmark-list');
  let bookmarks = [],
    current = 1,
    dragging = false,
    pending = false;
  function valid(items) {
    return Array.isArray(items)
      ? items
          .filter(
            (item, index, all) =>
              item &&
              Number.isInteger(item.page) &&
              item.page >= 1 &&
              item.page <= pages.length &&
              typeof item.name === 'string' &&
              all.findIndex((other) => other?.page === item.page) === index,
          )
          .map((item) => ({ page: item.page, name: item.name.slice(0, 120) }))
      : [];
  }
  try {
    const raw = window.SanichBookmarks ? window.SanichBookmarks.read() : localStorage.getItem(KEY);
    bookmarks = valid(JSON.parse(raw || '[]'));
  } catch {}
  function store(next) {
    try {
      const data = JSON.stringify(next);
      if (window.SanichBookmarks) {
        if (!window.SanichBookmarks.write(data)) throw new Error('storage');
      } else localStorage.setItem(KEY, data);
      bookmarks = next;
      status.textContent = 'Сохранено на этом устройстве';
      renderList();
    } catch {
      status.textContent = 'Не удалось сохранить: хранилище недоступно или заполнено.';
    }
  }
  function button(text, action, className) {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = text;
    if (className) node.className = className;
    node.onclick = action;
    return node;
  }
  function renderList() {
    list.replaceChildren();
    if (!bookmarks.length) {
      list.textContent = 'Закладок пока нет. Откройте нужную страницу и добавьте её.';
      return;
    }
    for (const item of bookmarks) {
      const row = document.createElement('div');
      row.className = 'vnr-bookmark-row';
      row.append(
        button(
          `${item.page}. ${item.name}`,
          () => {
            jumpPage(item.page);
            setOpen(false);
            update();
          },
          'open-bookmark',
        ),
      );
      const rename = button('✎', () => {
        const name = window.prompt('Название закладки', item.name);
        if (name?.trim())
          store(
            bookmarks.map((old) =>
              old.page === item.page ? { ...old, name: name.trim().slice(0, 120) } : old,
            ),
          );
      });
      rename.setAttribute('aria-label', `Переименовать закладку ${item.page}`);
      const remove = button('×', () => store(bookmarks.filter((old) => old.page !== item.page)));
      remove.setAttribute('aria-label', `Удалить закладку ${item.page}`);
      row.append(rename, remove);
      list.appendChild(row);
    }
  }
  function setOpen(value) {
    panel.hidden = !value;
    bar.querySelector('button').setAttribute('aria-expanded', String(value));
    if (value) {
      update();
      renderList();
      panel.querySelector('#vnr-bookmark-add').textContent = `＋ Страница ${current}`;
    }
  }
  bar.querySelector('button').onclick = () => setOpen(panel.hidden);
  panel.querySelector('#vnr-bookmarks-close').onclick = () => setOpen(false);
  panel.querySelector('#vnr-bookmark-add').onclick = () => {
    update();
    if (bookmarks.some((item) => item.page === current)) {
      status.textContent = 'Эта страница уже в закладках';
      return;
    }
    store(
      [...bookmarks, { page: current, name: `Страница ${current}` }].sort(
        (a, b) => a.page - b.page,
      ),
    );
  };
  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - innerHeight);
  }
  function update() {
    const line = scrollY + bar.getBoundingClientRect().bottom + 16;
    let low = 0,
      high = pages.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (pages[mid].offsetTop <= line) low = mid;
      else high = mid - 1;
    }
    current = scrollY >= maxScroll() - 2 && maxScroll() > 0 ? pages.length : low + 1;
    label.textContent = `${current}/${pages.length}`;
    if (!dragging)
      slider.value = String(maxScroll() ? Math.round((scrollY / maxScroll()) * 1000) : 0);
  }
  slider.addEventListener('pointerdown', () => {
    dragging = true;
  });
  slider.addEventListener('input', () => {
    window.scrollTo(0, (Number(slider.value) / 1000) * maxScroll());
    update();
  });
  function release() {
    dragging = false;
    update();
  }
  slider.addEventListener('change', release);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener(
    'scroll',
    () => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          update();
        });
      }
    },
    { passive: true },
  );
  window.addEventListener('resize', update);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  update();
  renderList();
})();
