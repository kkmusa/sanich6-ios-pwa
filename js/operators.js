const OPERATOR_PHOTOS = [
  ...new Set(
    Object.values(operatorSteps).flatMap((stations) =>
      Object.values(stations).flatMap((steps) => steps.map((step) => step.image).filter(Boolean)),
    ),
  ),
];
const OP_STATIONS = ['Борец КАСКАД-НТ', 'Эталон ЧР', 'ЭЛЕКТОН', 'ОРИОН-01', 'ТРИОЛ (УМКА)'];
let operatorMode = 'ramp',
  operatorStep = 0,
  operatorViewing = false;
const opValues = {
  ramp: { start: '', end: '', delta: '', stepMinutes: '', station: OP_STATIONS[0] },
  rich: { high: '', low: '', highMinutes: '', lowMinutes: '', station: OP_STATIONS[0] },
};
const OPERATOR_STATE_KEY = 'operator_dng_operators_v1';
try {
  const saved = JSON.parse(sessionStorage.getItem(OPERATOR_STATE_KEY) || 'null');
  if (saved) {
    if (['ramp', 'rich'].includes(saved.mode)) operatorMode = saved.mode;
    for (const mode of ['ramp', 'rich'])
      for (const key of Object.keys(opValues[mode])) {
        const value = saved.values?.[mode]?.[key];
        if (typeof value === 'string' && (key !== 'station' || OP_STATIONS.includes(value)))
          opValues[mode][key] = value;
      }
    operatorViewing = saved.viewing === true;
    operatorStep = Number.isInteger(saved.step) && saved.step >= 0 ? saved.step : 0;
  }
} catch {}
function persistOperatorState() {
  try {
    sessionStorage.setItem(
      OPERATOR_STATE_KEY,
      JSON.stringify({
        mode: operatorMode,
        values: opValues,
        viewing: operatorViewing,
        step: operatorStep,
      }),
    );
  } catch {}
}
async function operatorOfflineStatus() {
  const label = document.getElementById('opOfflineStatus');
  if (!label || !('caches' in window)) return;
  try {
    const cache = await caches.open('operator-dng-photos-v1');
    let saved = 0;
    for (const path of OPERATOR_PHOTOS) {
      const response = await cache.match(new URL(path, document.baseURI));
      if (response?.ok && /^image\//i.test(response.headers.get('content-type') || '')) saved++;
    }
    if (label.isConnected)
      label.textContent =
        saved === OPERATOR_PHOTOS.length
          ? `Все ${saved} фотографий доступны офлайн`
          : `Сохранено ${saved} из ${OPERATOR_PHOTOS.length} фотографий`;
  } catch {}
}
function opNumber(value) {
  return num(value);
}
function opCalc(mode, values) {
  const n = (key) => opNumber(values[key]);
  if (mode === 'ramp') {
    const r = DngMath.operatorRamp(...['start', 'end', 'delta', 'stepMinutes'].map(n));
    return r
      ? {
          st: fmt(r.start),
          en: fmt(r.end),
          rt: fmt(r.rate),
          dv: fmt(r.delta),
          sm: fmt(r.seconds),
          totalMinutes: fmt(r.totalMinutes),
          duration: r.duration,
        }
      : null;
  }
  const r = DngMath.operatorRich(...['high', 'low', 'highMinutes', 'lowMinutes'].map(n));
  if (!r) return null;
  const minutesClock = (value) =>
      `${Math.floor(Math.round(value) / 60)} ч ${String(Math.round(value) % 60).padStart(2, '0')} мин`,
    secondsClock = (value) =>
      `${Math.floor(Math.round(value) / 60)} мин ${String(Math.round(value) % 60).padStart(2, '0')} с`;
  return {
    hi: fmt(r.high),
    lo: fmt(r.low),
    htime: fmt(r.highMinutes),
    ltime: fmt(r.lowMinutes),
    uv: fmt(r.underloadSeconds),
    uvClock: secondsClock(r.underloadSeconds),
    highClock: minutesClock(r.highMinutes),
    lowClock: minutesClock(r.lowMinutes),
  };
}
function opDescription(raw, c) {
  return raw
    .replace(/\$\{formatNumber\(dv!!\)\}/g, c.dv || '')
    .replace(/\$\{formatNumber\(sm!!\)\}/g, c.sm || '')
    .replace(/\$\{formatNumber\(uv!!\)\}/g, c.uv || '')
    .replace(/\$\{secondsClock\(uv!!\)\}/g, c.uvClock || '')
    .replace(/\$\{minutesClock\(hm!!\)\}/g, c.highClock || '')
    .replace(/\$\{minutesClock\(lm!!\)\}/g, c.lowClock || '')
    .replace(/\$\{formatNumber\(\(lm!! \+ 1\.0\) \* 60\.0\)\}/g, c.uv || '')
    .replace(/\$\{formatNumber\(totalMinutes\)\}/g, c.totalMinutes || '')
    .replace(/\$duration/g, c.duration || '')
    .replace(/\$(st|en|rt|hi|lo|htime|ltime)/g, (_, key) => c[key] || '');
}
async function downloadOperatorPhotos() {
  const status = document.getElementById('opOfflineStatus');
  const button = document.getElementById('opOfflineDownload');
  button.disabled = true;
  try {
    if (!('serviceWorker' in navigator)) throw Error('Service Worker недоступен');
    const registration = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(Error('Офлайн-модуль не готов. Перезагрузите приложение при наличии интернета.')),
        10000,
      );
      navigator.serviceWorker.ready.then(
        (r) => {
          clearTimeout(timeout);
          resolve(r);
        },
        (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      );
    });
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) throw Error('Перезапустите приложение');
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      let timeout;
      const finish = (error) => {
        clearTimeout(timeout);
        channel.port1.close();
        error ? reject(error) : resolve();
      };
      const arm = () => {
        clearTimeout(timeout);
        timeout = setTimeout(
          () => finish(Error('Нет ответа от офлайн-модуля. Повторите загрузку.')),
          30000,
        );
      };
      arm();
      channel.port1.onmessage = (e) => {
        arm();
        const m = e.data;
        if (m.type === 'progress')
          status.textContent = `Сохранено ${m.saved} из ${m.total} фотографий`;
        if (m.type === 'complete') {
          status.textContent = `Фотографии сохранены: ${m.saved} из ${m.total}. Доступны офлайн.`;
          finish();
        }
        if (m.type === 'error') {
          finish(Error(m.message));
        }
      };
      worker.postMessage({ type: 'OPERATORS_DOWNLOAD', paths: OPERATOR_PHOTOS }, [channel.port2]);
    });
  } catch (e) {
    status.textContent = 'Ошибка: ' + e.message;
  } finally {
    button.disabled = false;
  }
}
function renderOperator() {
  persistOperatorState();
  const mode = operatorMode,
    v = opValues[mode],
    calc = opCalc(mode, v),
    title = mode === 'ramp' ? 'Разгон' : 'РИЧ';
  if (operatorViewing) {
    const steps = operatorSteps[mode]?.[v.station] || [];
    if (!calc || !steps.length) {
      operatorViewing = false;
      return renderOperator();
    }
    operatorStep = Math.max(0, Math.min(operatorStep, steps.length - 1));
    const s = steps[operatorStep];
    app.innerHTML = screen(
      `${topbar(title + ' — ' + v.station)}<main class="content stack"><div class="card"><div class="subtle">Шаг ${operatorStep + 1} из ${steps.length}</div><h2>${esc(s.title)}</h2>${s.image ? `<img class="operator-photo" src="${s.image}" alt="${esc(s.title)}" loading="lazy">` : ''}<p>${esc(opDescription(s.description, calc))}</p></div><div class="row"><button class="btn secondary" id="opPrev">Назад</button><button class="btn" id="opNext">${operatorStep === steps.length - 1 ? 'К параметрам' : 'Далее'}</button></div><p class="hint">Перед применением сверяйте с документацией конкретной СУ и утверждённой технологией.</p></main>`,
    );
    document.getElementById('opPrev').onclick = () => {
      if (operatorStep === 0) operatorViewing = false;
      else operatorStep--;
      renderOperator();
    };
    document.getElementById('opNext').onclick = () => {
      if (operatorStep === steps.length - 1) operatorViewing = false;
      else operatorStep++;
      renderOperator();
    };
    return;
  }
  const fields =
    mode === 'ramp'
      ? [
          ['start', 'Начальная частота, Гц'],
          ['end', 'Конечная частота, Гц'],
          ['delta', 'Шаг изменения частоты, Гц'],
          ['stepMinutes', 'Время одного шага, с'],
        ]
      : [
          ['high', 'Рабочая / повышенная частота, Гц'],
          ['low', 'Пониженная частота, Гц'],
          ['highMinutes', 'Время на рабочей частоте, мин'],
          ['lowMinutes', 'Время на пониженной частоте, мин'],
        ];
  app.innerHTML = screen(
    `${topbar('Операторы — ' + title)}<main class="content stack"><div class="chips"><button class="chip ${mode === 'ramp' ? 'active' : ''}" data-opmode="ramp">Разгон</button><button class="chip ${mode === 'rich' ? 'active' : ''}" data-opmode="rich">РИЧ</button></div><div class="card stack"><h2>Введите свои значения</h2>${fields.map(([key, label]) => `<div class="field"><label for="op-${key}">${label}</label><input id="op-${key}" type="text" inputmode="decimal" value="${esc(v[key])}" autocomplete="off"></div>`).join('')}<div class="field"><label for="opStation">Станция управления</label><select id="opStation">${OP_STATIONS.map((s) => `<option ${s === v.station ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div><div id="opUnderload" class="hint">${mode === 'rich' && calc ? `Время срабатывания недогрузки: ${calc.uv} с` : ''}</div><div id="opValidation" class="hint"></div><button class="btn full" id="opStart" ${calc ? '' : 'disabled'}>Перейти к инструкции</button></div><div class="card stack"><h3>Фотографии станций офлайн</h3><p class="hint">Загрузите фотографии при наличии интернета.</p><button class="btn secondary full" id="opOfflineDownload">↓ Скачать фотографии</button><p id="opOfflineStatus" class="hint" role="status"></p></div></main>`,
  );
  document.getElementById('opOfflineDownload').onclick = downloadOperatorPhotos;
  operatorOfflineStatus();
  document.querySelectorAll('[data-opmode]').forEach(
    (b) =>
      (b.onclick = () => {
        operatorMode = b.dataset.opmode;
        renderOperator();
      }),
  );
  fields.forEach(([key]) =>
    document.getElementById('op-' + key).addEventListener('input', (e) => {
      v[key] = e.target.value;
      persistOperatorState();
      const c = opCalc(mode, v);
      document.getElementById('opUnderload').textContent =
        mode === 'rich' && c ? `Время срабатывания недогрузки: ${c.uv} с` : '';
      document.getElementById('opStart').disabled = !c;
      document.getElementById('opValidation').textContent = c
        ? ''
        : 'Проверьте частоты и время: значения должны быть положительными.';
    }),
  );
  document.getElementById('opStation').onchange = (e) => {
    v.station = e.target.value;
    persistOperatorState();
  };
  document.getElementById('opStart').onclick = () => {
    if (!opCalc(mode, v)) return;
    operatorStep = 0;
    operatorViewing = true;
    renderOperator();
  };
}
