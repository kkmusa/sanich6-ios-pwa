let pedDb = null;
const PED_STATE_KEY = 'operator_dng_ped_selection_v1';
let pedSaved = { selection: {}, selectedKey: null, working: '', nominal: '' };
// Keep this form only in the current page's memory, across section navigation.
// Remove the old persisted selection so reopening/reloading starts with a clean form.
try {
  sessionStorage.removeItem(PED_STATE_KEY);
} catch {}
function pedKey(p) {
  return JSON.stringify([p.manufacturer, p.name, p.diameter, p.power, p.speed, p.casing, p.wall]);
}
function rememberPed() {
  pedSaved.selection = { ...(state.pedSel || {}) };
}

async function loadPedDb() {
  if (pedDb) return pedDb;
  const r = await fetch('./assets/PedCoolingDatabase.json');
  if (!r.ok) throw new Error('Не удалось загрузить справочник ПЭД');
  pedDb = await r.json();
  return pedDb;
}
function uniqueSorted(a, numeric = true) {
  return [...new Set(a)].sort((x, y) =>
    numeric ? x - y : String(x).localeCompare(String(y), 'ru'),
  );
}
async function renderPed() {
  app.innerHTML = screen(
    `${topbarTo('Охлаждение ПЭД')}<main class="content stack"><div class="card"><b>Необходимый приток для охлаждения ПЭД</b><div class="hint">Выберите параметры своего ПЭД для расчёта необходимого притока.</div></div><div id="pedBody" class="stack"><div class="card">Загрузка справочника…</div></div><button type="button" class="btn secondary full" id="resetPed">Сбросить</button></main>`,
    'reference',
  );
  document.getElementById('resetPed').onclick = () => {
    pedSaved = { selection: {}, selectedKey: null, working: '', nominal: '' };
    state.pedSel = {};
    resetHistoryDraft();
    routeDrafts.delete('ped');
    persistDrafts();
    if (pedDb) renderPedBody(pedDb);
    window.scrollTo(0, 0);
  };
  const body = document.getElementById('pedBody');
  try {
    const db = await loadPedDb();
    if (!body.isConnected) return;
    state.pedSel = { ...pedSaved.selection };
    renderPedBody(db);
  } catch (e) {
    if (body.isConnected) body.innerHTML = `<div class="card error">${esc(e.message)}</div>`;
  }
}
function pedSelectHtml(id, label, values, val = '') {
  const opts = [
    `<option value="">— Выберите —</option>`,
    ...values.map(
      (o) =>
        `<option value="${esc(o)}" ${String(o) === String(val) ? 'selected' : ''}>${esc(o)}</option>`,
    ),
  ].join('');
  return `<div class="field"><label>${esc(label)}</label><select id="${id}">${opts}</select></div>`;
}
function renderPedBody(db) {
  const s = state.pedSel || {};
  const dias = uniqueSorted(db.map((x) => x.diameter));
  let html = pedSelectHtml('pedDia', 'Диаметр ПЭД, мм', dias, s.diameter || '');
  if (!s.diameter) {
    html += `<div class="card hint">Начните с выбора диаметра ПЭД.</div>`;
    document.getElementById('pedBody').innerHTML = html;
    bindPedSelects(db);
    return;
  }
  const dia = Number(s.diameter);
  const pows = uniqueSorted(db.filter((x) => x.diameter === dia).map((x) => x.power));
  html += pedSelectHtml('pedPower', 'Мощность, кВт', pows, s.power || '');
  if (!s.power) {
    html += `<div class="card hint">Теперь выберите мощность ПЭД.</div>`;
    document.getElementById('pedBody').innerHTML = html;
    bindPedSelects(db);
    return;
  }
  const power = Number(s.power);
  const cas = uniqueSorted(
    db.filter((x) => x.diameter === dia && x.power === power).map((x) => x.casing),
  );
  html += pedSelectHtml('pedCasing', 'Обсадная колонна, мм', cas, s.casing || '');
  if (!s.casing) {
    html += `<div class="card hint">Выберите диаметр обсадной колонны.</div>`;
    document.getElementById('pedBody').innerHTML = html;
    bindPedSelects(db);
    return;
  }
  const casing = Number(s.casing);
  const walls = uniqueSorted(
    db
      .filter((x) => x.diameter === dia && x.power === power && x.casing === casing)
      .map((x) => x.wall),
  );
  html += pedSelectHtml('pedWall', 'Толщина стенки, мм', walls, s.wall || '');
  if (!s.wall) {
    html += `<div class="card hint">Выберите толщину стенки обсадной колонны.</div>`;
    document.getElementById('pedBody').innerHTML = html;
    bindPedSelects(db);
    return;
  }
  const wall = Number(s.wall);
  const results = db.filter(
    (x) =>
      x.diameter === dia &&
      x.power === power &&
      x.casing === casing &&
      Math.abs(x.wall - wall) < 1e-9,
  );
  html += `<div class="section-title">Найдено ПЭД: ${results.length}</div><div class="stack">${results.map((p, i) => `<div class="card ped-result" data-ped="${i}"><b>${esc(p.name)}</b><div class="hint">${esc(p.manufacturer)}</div><div class="ped-flow">Номинальный приток: <b>${fmt(p.flow)} м³/сут</b></div></div>`).join('') || '<div class="card">Подходящие ПЭД не найдены</div>'}</div><div id="pedDetails"></div>`;
  document.getElementById('pedBody').innerHTML = html;
  bindPedSelects(db);
  document.querySelectorAll('[data-ped]').forEach(
    (el) =>
      (el.onclick = () => {
        pedSaved.selectedKey = pedKey(results[Number(el.dataset.ped)]);
        pedSaved.working = '';
        pedSaved.nominal = '';
        rememberPed();
        renderPedDetails(results[Number(el.dataset.ped)]);
        const details = document.getElementById('pedDetails');
        details.setAttribute('tabindex', '-1');
        details.setAttribute('role', 'region');
        details.setAttribute('aria-label', 'Расчёт охлаждения выбранного ПЭД');
        details.focus({ preventScroll: true });
        details.scrollIntoView({
          block: 'start',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      }),
  );
  const selected = results.find((p) => pedKey(p) === pedSaved.selectedKey);
  if (selected) renderPedDetails(selected);
}
function bindPedSelects(db) {
  const map = { pedDia: 'diameter', pedPower: 'power', pedCasing: 'casing', pedWall: 'wall' };
  Object.keys(map).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onchange = (e) => {
      const key = map[id];
      const value = e.target.value;
      state.pedSel[key] = value ? Number(value) : '';
      if (id === 'pedDia') {
        state.pedSel.power = '';
        state.pedSel.casing = '';
        state.pedSel.wall = '';
      }
      if (id === 'pedPower') {
        state.pedSel.casing = '';
        state.pedSel.wall = '';
      }
      if (id === 'pedCasing') {
        state.pedSel.wall = '';
      }
      pedSaved.selectedKey = null;
      pedSaved.working = '';
      pedSaved.nominal = '';
      rememberPed();
      renderPedBody(db);
    };
  });
}
function renderPedDetails(p) {
  const d = document.getElementById('pedDetails');
  if (!d) return;
  d.innerHTML = `<div class="card stack"><h3 style="margin:0">${esc(p.name)}</h3><div class="row"><div><span class="subtle">Производитель</span><br><b>${esc(p.manufacturer)}</b></div><div><span class="subtle">Номинальный приток</span><br><b>${fmt(p.flow)} м³/сут</b></div></div><div class="row">${field('pedWork', 'Рабочий ток, А')}${field('pedNom', 'Номинальный ток, А')}</div><div id="pedCalc" class="result card"><h4>Необходимый приток</h4><div class="error">Введите рабочий и номинальный ток</div></div></div>`;
  const calc = () => {
    const w = num(document.getElementById('pedWork').value),
      n = num(document.getElementById('pedNom').value);
    const box = document.getElementById('pedCalc');
    if (w === null || n === null || w < 0 || n <= 0) {
      box.innerHTML =
        '<h4>Необходимый приток</h4><div class="error">Введите рабочий и номинальный ток</div>';
      return;
    }
    const flow = DngMath.pedCooling(p.flow, w, n);
    box.innerHTML = `<h4>Необходимый приток при фактической загрузке ПЭД</h4><div class="value">${fmt(flow)} м³/сут</div>`;
    if (flow !== null)
      state.last = {
        title: 'Охлаждение ПЭД',
        method: 'По фактической загрузке',
        result: `${fmt(flow)} м³/сут`,
        details: `ПЭД=${p.name}; D=${p.diameter} мм; мощность=${p.power} кВт; ЭК=${p.casing} мм; стенка=${p.wall} мм; рабочий ток=${w} А; номинальный ток=${n} А; номинальный приток=${p.flow} м³/сут`,
      };
  };
  document.getElementById('pedWork').value = pedSaved.working;
  document.getElementById('pedNom').value = pedSaved.nominal;
  bind(['pedWork', 'pedNom'], () => {
    pedSaved.working = document.getElementById('pedWork').value;
    pedSaved.nominal = document.getElementById('pedNom').value;
    rememberPed();
    calc();
  });
  calc();
}

function renderAssistant() {
  if (APP_EDITION === 'bez') {
    state.route = 'reference';
    state.assistantIndex = null;
    return renderReference();
  }
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    if (state.route === 'assistant') window.scrollTo(0, 0);
  });
  if (
    APP_EDITION === 'reglament' &&
    (!Array.isArray(globalThis.DNG_REG_ASSISTANT) || !Array.isArray(globalThis.DNG_REG_AUTHOR_EXTRA))
  ) {
    app.innerHTML = screen(
      `${topbarTo('Помощник оператора')}<main class="content"><div class="card" role="status">Не удалось загрузить инструкции. Подключитесь к интернету и обновите приложение.</div></main>`,
      'reference',
    );
    return;
  }
  const selected = state.assistantIndex;
  if (selected === undefined || selected === null) {
    app.innerHTML = screen(
      `${topbarTo('Помощник оператора')}<main class="content stack"><div class="section-title">Выберите ситуацию</div>${assistantTopics.map((t, i) => `<div class="card assistant-topic" onclick="state.assistantIndex=${i};renderAssistant()"><b>${esc(t.title)}</b><span>›</span></div>`).join('')}</main>`,
      'reference',
    );
    return;
  }
  const t = assistantTopics[selected];
  const author = APP_EDITION === 'reglament'
    ? globalThis.DNG_REG_AUTHOR_EXTRA.find((topic) => topic.title === t.title)
    : null;
  app.innerHTML = screen(
    `${topbarTo(t.title, 'assistant')}<main class="content${APP_EDITION === 'reglament' ? ' assistant-document stack' : ''}">${author ? assistantCard(author, 'Порядок работы', 'assistant-author') : ''}${assistantCard(t, author ? 'Требования регламента' : '', APP_EDITION === 'reglament' ? 'assistant-reglament' : '')}</main>`,
    'reference',
  );
  document.querySelector('.back').onclick = () => {
    state.assistantIndex = null;
    renderAssistant();
  };
}

function renderSkoReference() {
  const cards = [
    [
      'Кислотная композиция',
      '• Через НКТ — 1,5 м³ кислотной композиции.\n• Через затрубное пространство — 3 м³.\n• Применяются растворы 5%, 10% и 12%.\n• Для профилактики — 5%.\n• До 12% при расклинивании — только по решению ОРМФ.\n• Продавка — водным раствором ПАВ 0,1–1,0%.',
    ],
    ['Справочные объёмы НКТ', 'НКТ 60 — 2 л/м\nНКТ 73 — 3 л/м\nНКТ 89 — 4,5 л/м'],
    [
      'Варианты расчёта',
      '1. Прямая, работающий УЭЦН:\nVобр = Vнкт × Lэцн / 1000\n\n2. Прямая, нет подачи / клин:\nVобр = Vнкт × Lэцн / 1000 + 8 м³\n\n3. Обратная, работающий УЭЦН:\nVобр = 0,79 × Lэцн × (Dс² − Dнкт²) + 0,5\n\n4. Обратная, насос выключен:\nVобр = 0,79 × Dс² × Lэцн\n\nДля вариантов 3 и 4 диаметры используются в метрах.',
    ],
    [
      'Ограничения по времени',
      '• Профилактическая промывка: кислота в зоне насоса — не более 20 минут.\n• Расклинивание без циркуляции — не более 60 минут.\n• При обратной обработке учитывается скорость оседания раствора 100–150 м/ч.',
    ],
    [
      'Ограничения по проведению',
      '• Не более 3 СКО за скользящий месяц.\n• Не более 5 СКО за одну эксплуатацию ЭПО.\n• Повторная обработка — после оценки причины и эффективности предыдущих работ.',
    ],
    [
      'Критерии применения',
      '• Снижение или отсутствие подачи.\n• Снижение подачи более чем на 5–20% от установившегося режима.\n• Остановка по причине «КЛИН».\n• Нет эффекта после промывки технологической жидкостью.\n• Подтверждённые солеотложения.\n• Частые остановки по ЗП при исправном наземном оборудовании.',
    ],
    [
      'Когда СКО исключается',
      '• Нет подачи и отсутствует циркуляция при промывке.\n• Высокий динамический уровень.\n• Высокое давление или противодавление закачки.\n• Повторная обработка неэффективна при аномально низком пластовом давлении.',
    ],
  ];
  app.innerHTML = screen(
    `${topbarTo('Соляно-кислотная обработка УЭЦН')}<main class="content stack">${cards.map(([t, x]) => `<div class="card ref-text"><h3>${esc(t)}</h3>${esc(x).replace(/\n/g, '<br>')}</div>`).join('')}<div class="card warning-card"><b>Технология, концентрация кислоты, объём обработки и необходимость отключения УЭЦН определяются технологической службой и указываются в Плане-заказе.</b></div></main>`,
    'reference',
  );
}

function renderAbout() {
  app.innerHTML = screen(
    `${topbar('О приложении')}<main class="content stack" style="text-align:center"><img src="assets/logo.png" style="width:min(56vw,240px);margin:0 auto;display:block" alt="${esc(APP_NAME)}"><h2 style="margin-bottom:0">${esc(APP_NAME)}</h2>${APP_EDITION === 'reglament' ? '<div class="edition-label">Инструкции по регламенту</div>' : ''}<div class="hint">Расчёты выполняются локально на устройстве.</div><div>Версия ${APP_VERSION}</div><button class="btn full" onclick="go('privacy')">Политика конфиденциальности</button></main>`,
    'reference',
  );
}
function renderPrivacy() {
  app.innerHTML = screen(
    `${topbar('Политика конфиденциальности')}<main class="content policy"><p><b>Приложение «Оператор ДНГ»</b> предназначено для выполнения инженерных расчётов и работает локально на устройстве пользователя.</p><h2>1. Сбор персональных данных</h2><p>Приложение не требует регистрации и не запрашивает имя, номер телефона, адрес электронной почты, паспортные или иные персональные данные.</p><h2>2. Вводимые данные</h2><p>Параметры, которые пользователь вводит для расчётов, используются только для выполнения вычислений. История расчётов, если пользователь её использует, хранится локально на устройстве.</p><h2>3. Передача третьим лицам</h2><p>Приложение не передаёт пользовательские данные третьим лицам, рекламным сетям или разработчику.</p><h2>4. Реклама и аналитика</h2><p>Приложение не содержит рекламных систем и сторонней аналитики.</p><h2>5. Доступ к функциям устройства</h2><p>Приложение не требует доступа к контактам, сообщениям, фотографиям, микрофону, камере или геолокации для выполнения основных расчётов.</p><h2>6. Офлайн-работа</h2><p>После первой загрузки файлы приложения могут сохраняться браузером для работы без интернета. Локальные данные можно удалить средствами браузера или удалением веб-приложения.</p><h2>7. Изменения политики</h2><p>Политика может обновляться при изменении функциональности приложения.</p></main>`,
    'reference',
  );
}
