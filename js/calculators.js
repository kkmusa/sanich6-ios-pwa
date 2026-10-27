function renderHome() {
  app.innerHTML = screen(
    `<section class="hero home-hero"><img src="assets/logo.png" alt="Оператор ДНГ"><h1>Расчёты</h1>${APP_EDITION !== 'author' ? `<div class="edition-label">${esc(APP_NAME)}</div>` : ''}</section><main class="content stack">
${menuCard('level', 'Уровень жидкости в скважине', '', 'level')}
${menuCard('frequency', 'Необходимая частота запуска', '', 'frequency')}
${menuCard('manual', 'Ручной замер дебита', '', 'manual')}
${menuCard('headAtFrequency', 'Напор на частоте', '', 'headAtFrequency')}
${menuCard('⚡', 'Расчёт отпайки ТМПН', '', 'tap')}
${menuCard('ramp', 'Разгон', '', 'ramp')}
${menuCard('FF', 'РИЧ', '', 'rich')}
${menuCard('2А', 'Коэффициент двигателя 2А', '', 'motorCoefficient')}
${menuCard('Q', 'Потенциал скважины', '', 'wellPotential')}</main>`,
    'home',
  );
}

function renderHeadAtFrequency() {
  app.innerHTML = screen(`${topbar('Напор на частоте')}<main class="content stack">
    ${field('passportHead', 'Паспортный напор при 50 Гц, м')}
    ${field('workingFrequency', 'Рабочая частота, Гц')}
    <div id="liveResult">${resultCard('Напор', '', 'Введите напор при 50 Гц и рабочую частоту')}</div>
    <button class="btn secondary full" id="clearHead">Очистить</button>
  </main>`);
  const calc = () => {
    const head = num(document.getElementById('passportHead').value);
    const frequency = num(document.getElementById('workingFrequency').value);
    const value = DngMath.headAtFrequency(head, frequency);
    if (value === null) {
      state._last = null;
      return setResult('Напор', '', 'Напор должен быть больше нуля, частота — неотрицательной');
    }
    const displayValue = `${fmt(Math.round(value), 0)} м`;
    setResult(`Напор на ${fmt(frequency)} Гц`, displayValue);
    state.last = {
      title: 'Напор на частоте',
      method: 'Квадратичная зависимость от 50 Гц',
      result: displayValue,
      details: `Напор при 50 Гц=${fmt(head)} м; частота=${fmt(frequency)} Гц`,
    };
  };
  bind(['passportHead', 'workingFrequency'], calc);
  document.getElementById('clearHead').onclick = () => {
    document.getElementById('passportHead').value = '';
    document.getElementById('workingFrequency').value = '';
    resetHistoryDraft();
    calc();
    snapshotRoute();
  };
}

function renderLevel() {
  app.innerHTML = screen(
    `${topbar('Расчёт уровня жидкости')}<main class="content stack">${field('depth', 'Глубина спуска насоса, м')}<div class="row">${field('pz', 'Pз, ат (кгс/см²)')}${field('pd', 'Pд, ат (кгс/см²)')}</div>${field('density', 'Плотность жидкости, г/см³')}${field('extension', 'Удлинение, м (необязательно)')}<div id="liveResult">${resultCard('Уровень жидкости', '', 'Заполните все параметры')}</div><button class="btn secondary full" id="clear">Очистить</button></main>`,
  );
  const calc = () => {
    const d = num(depth.value),
      z = num(pz.value),
      p = num(pd.value),
      rho = num(density.value);
    if ([d, z, p, rho].some((v) => v === null) || rho <= 0 || d <= 0)
      return setResult('Уровень жидкости', '', 'Заполните все параметры');
    const extensionText = document.getElementById('extension').value,
      extensionValue = extensionText.trim() === '' ? 0 : num(extensionText);
    if (extensionValue === null || extensionValue < 0 || extensionValue > d)
      return setResult('Уровень жидкости', '', 'Удлинение должно быть от нуля до глубины спуска');
    const level = DngMath.liquidLevel(d - extensionValue, z, p, rho * 1000);
    if (level === null)
      return setResult('Уровень жидкости', '', 'Результат выходит за числовой диапазон');
    setResult('Вертикальный уровень жидкости', `${fmt(level)} м`);
    state.last = {
      title: 'Уровень жидкости',
      method: 'Автоматический расчёт',
      result: `${fmt(level)} м`,
      details: `Глубина=${d} м; Pз=${z}; Pд=${p}; плотность=${rho} г/см³; удлинение=${extensionValue} м`,
    };
  };
  bind(['depth', 'extension', 'pz', 'pd', 'density'], calc);
  clear.onclick = () => {
    ['depth', 'extension', 'pz', 'pd', 'density'].forEach(
      (i) => (document.getElementById(i).value = ''),
    );
    calc();
  };
  window.onbeforeunload = null;
}

function renderFrequency() {
  app.innerHTML = screen(
    `${topbar('Необходимая частота запуска')}<main class="content stack">${field('level', 'Вертикальный уровень жидкости, м')}${field('head', 'Паспортный напор при 50 Гц, м')}<p class="hint">Оценка по исходной модели: добавочный напор 392,4 м.</p><div id="liveResult">${resultCard('Необходимая частота', '', 'Заполните все параметры')}</div></main>`,
  );
  const calc = () => {
    const l = num(level.value),
      h = num(head.value);
    if (l === null || h === null || h <= 0)
      return setResult('Необходимая частота', '', 'Заполните все параметры');
    const r = DngMath.startFrequency(l, h);
    if (!Number.isFinite(r)) return setResult('Необходимая частота', '', 'Проверьте значения');
    setResult('Необходимая частота', `${fmt(r)} Гц`);
    state.last = {
      title: 'Необходимая частота запуска',
      method: 'Автоматический расчёт',
      result: `${fmt(r)} Гц`,
      details: `Уровень=${l} м; напор=${h} м`,
    };
  };
  bind(['level', 'head'], calc);
}

const vkpTable = {
  '139.7-60': 0.0091,
  // Calculated approximation, not the erroneous 0.0100 printed in table 13.
  // User-selected 7 mm casing wall; table 9 KPBP 3x16 maximum envelope:
  // pi/4 * ((139.7 - 2*7)^2 - 73^2) * 1e-6 - 14.7*35.3*1e-6
  // = 0.007705379... m³/m, rounded to the reference table's four decimals.
  '139.7-73': 0.0077,
  '139.7-89': 0.0058,
  '146-60': 0.01,
  '146-73': 0.0087,
  '146-89': 0.0067,
  '168-60': 0.015,
  '168-73': 0.0136,
  '168-89': 0.0114,
  '178-60': 0.0168,
  '178-73': 0.0155,
  '178-89': 0.0134,
};
const vnkt = { 60: 0.002, 73: 0.003, 89: 0.0045 };
const casingWalls = {
  102: [6.5],
  114: [5.2, 5.7, 6.4, 7.4, 8.6, 10.2],
  139.7: [6.2, 7, 7.7, 9.2, 10.5],
  146: [6.5, 7, 7.7, 8.5, 9.6, 10.7],
  168: [7.3, 8, 8.9, 10.6, 12.1],
  178: [5.9, 6.9, 8.1, 9.2, 10.4, 11.5, 12.7, 13.7, 15],
  194: [7.6, 8.3, 9.3, 10.9, 12.7, 16.1],
};
function renderFlow() {
  app.innerHTML = screen(`${topbar('Определение притока')}<main class="content stack">
${selectField('flowType', 'Вид расчёта', ['Герметичный ОК', 'Негерметичный ОК в период слива', 'Негерметичный ОК после слива'], 'Герметичный ОК')}
${selectField('source', 'Источник Vкп', ['По справочнику', 'По геометрии'], 'По справочнику')}
<div class="card stack" id="vkpBox"></div><div class="row">${field('dh', 'ΔH, м')}${field('time', 'Время, мин')}</div><div id="hstWrap"></div><div id="liveResult">${resultCard('Приток', '', 'Заполните параметры')}</div></main>`);
  const referenceOption = document.getElementById('source').options[0];
  referenceOption.value = 'По справочнику';
  referenceOption.textContent = 'По справочнику (приближённо)';
  let selectedCasing = '168', selectedTubing = '73', geometryCasing = null;
  const geometryWalls = new Map();
  let geometryCable = '';
  function rememberGeometry() {
    if (!document.getElementById('wall')) return;
    geometryWalls.set(geometryCasing, document.getElementById('wall').value);
    geometryCable = document.getElementById('flowCableArea').value;
  }
  function rebuildVkp() {
    selectedCasing = document.getElementById('casing')?.value ||
      document.getElementById('casingOuter')?.value || selectedCasing;
    selectedTubing = document.getElementById('tubing')?.value || selectedTubing;
    rememberGeometry();
    const src = source.value;
    if (src === 'По справочнику') {
      if (!['139.7', '146', '168', '178'].includes(selectedCasing)) selectedCasing = '168';
      vkpBox.innerHTML = `<div class="row">${selectField(
        'casing',
        'ЭК',
        ['139.7', '146', '168', '178'].sort((a, b) => Number(a) - Number(b)),
        selectedCasing,
      )}${selectField(
        'tubing',
        'НКТ',
        Object.keys(vnkt).sort((a, b) => Number(a) - Number(b)),
        selectedTubing,
      )}</div><div class="hint" id="vkpText"></div><div class="hint" id="vkpAssumption" hidden></div>`;
    } else {
      vkpBox.innerHTML = `<div class="row">${selectField(
        'casingOuter',
        'D ЭК',
        Object.keys(casingWalls).sort((a, b) => Number(a) - Number(b)),
        selectedCasing,
      )}${selectField(
        'tubing',
        'НКТ',
        Object.keys(vnkt).sort((a, b) => Number(a) - Number(b)),
        selectedTubing,
      )}</div><div id="wallHolder"></div>${field('flowCableArea', 'Наружное сечение всего кабеля, мм² (необязательно)')}<p class="hint">Пустое поле — геометрический расчёт без учёта кабеля.</p><div class="hint" id="vkpText"></div>`;
      document.getElementById('flowCableArea').value = geometryCable;
      buildWall();
      bind(['flowCableArea'], calc);
    }
    bind(['casing', 'tubing', 'casingOuter'], (event) => {
      if (event.target.id === 'casingOuter') {
        rememberGeometry();
        buildWall();
      }
      calc();
    });
    calc();
  }
  function buildWall() {
    const co = document.getElementById('casingOuter');
    if (!co) return;
    const vals = [...(casingWalls[co.value] || [])].sort((a, b) => Number(a) - Number(b));
    geometryCasing = co.value;
    const saved = geometryWalls.get(geometryCasing);
    wallHolder.innerHTML = selectField('wall', 'Стенка ЭК, мм', vals,
      vals.some(value => String(value) === saved) ? saved : vals[0]);
    bind(['wall'], calc);
  }
  function calc() {
    state._last = null;
    if (flowType.value === 'Негерметичный ОК в период слива') {
      if (!document.getElementById('hst')) {
        hstWrap.innerHTML = field('hst', 'Hст, м');
        bind(['hst'], calc);
      }
    } else {
      hstWrap.innerHTML = '';
    }
    const tub = document.getElementById('tubing')?.value || '73';
    let vkp,
      detail = '';
    if (source.value === 'По справочнику') {
      const cas = document.getElementById('casing')?.value;
      vkp = vkpTable[`${cas}-${tub}`];
      detail = `ЭК=${cas} мм; НКТ=${tub} мм`;
      const approximation = cas === '139.7' && tub === '73';
      const assumption = document.getElementById('vkpAssumption');
      // Replacing a focused input can synchronously emit its final change
      // while the new selector markup is still being installed.
      if (assumption) {
        assumption.hidden = !approximation;
        assumption.textContent = approximation
          ? 'Расчётное приближение: стенка ЭК 7 мм; КПБП 3×16 по максимальным габаритам 14,7 × 35,3 мм.' : '';
      }
      if (approximation) detail += '; расчётное приближение: стенка ЭК=7 мм; КПБП 3×16=14.7×35.3 мм';
    } else {
      const co = num(document.getElementById('casingOuter')?.value),
        w = num(document.getElementById('wall')?.value),
        to = num(tub),
        cableText = document.getElementById('flowCableArea')?.value || '',
        cableArea = cableText.trim() ? num(cableText) : 0;
      if (co && w && to) {
        const inner = co - 2 * w;
        if (inner > to) {
          vkp = DngMath.annularVolume(to, co, w, cableArea);
          detail = `НКТ=${tub} мм; D ЭК=${co} мм; стенка=${w} мм; Dвнутр=${fmt(inner)} мм; кабель=${cableArea === 0 ? 'без учёта' : cableArea + ' мм²'}`;
        }
      }
    }
    const vt = document.getElementById('vkpText');
    if (vt) vt.textContent = vkp ? `Vкп: ${vkp.toFixed(6)} м³/м` : 'Выберите размеры и проверьте сечение кабеля';
    const D = num(dh.value),
      T = num(time.value);
    if (D === null || D < 0 || T === null || T <= 0 || !vkp)
      return setResult('Приток', '', 'Заполните параметры');
    const type = flowType.value,
      mode =
        type === 'Герметичный ОК'
          ? 'hermetic'
          : type === 'Негерметичный ОК после слива'
            ? 'afterDrain'
            : 'drain';
    const hs = mode === 'drain' ? num(document.getElementById('hst')?.value) : 0;
    if (hs === null || hs < 0) return setResult('Приток', '', 'Введите Hст');
    const raw = DngMath.wellFlowRaw(mode, D, vkp, T, vnkt[tub] || 0, hs);
    const r = DngMath.wellFlow(mode, D, vkp, T, vnkt[tub] || 0, hs);
    if (r === null) return setResult('Приток', '', 'Проверьте параметры');
    if (raw < 0)
      return setResult('Приток', '', 'Расчёт дал отрицательный приток. Проверьте ΔH, Hст, время и соответствие выбранному режиму слива.');
    setResult('Приток', `${fmt(r)} м³/сут`);
    state.last = {
      title: type,
      method: source.value,
      result: `${fmt(r)} м³/сут`,
      details: `ΔH=${D} м; время=${T} мин; ${detail}; Vкп=${vkp.toFixed(6)} м³/м${mode === 'drain' ? `; Hст=${hs} м` : ''}`,
    };
  }
  bind(['flowType'], () => {
    hstWrap.innerHTML = '';
    calc();
  });
  bind(['source'], rebuildVkp);
  bind(['dh', 'time'], calc);
  rebuildVkp();
}

function renderSko() {
  const variants = [
    ['direct', 'Прямая закачка — при снижении производительности'],
    ['direct8', 'Прямая закачка — нет подачи / клин'],
    ['reverse', 'Обратная закачка — УЭЦН работает'],
    ['reverseOff', 'Обратная закачка — УЭЦН выключен'],
  ];
  let variant = 'direct',
    selectedTubing = '73';
  app.innerHTML =
    screen(`${topbar('Объём СКО')}<main class="content stack"><div class="section-title">Выберите вариант обработки</div><div class="radio-list" id="variants">${variants.map(([key, title], i) => `<div class="radio-item pressable ${i === 0 ? 'active' : ''}" role="button" tabindex="0" data-v="${key}">${esc(title)}</div>`).join('')}</div>${field('skoDepth', 'Глубина спуска ЭЦН, м')}
 <div id="skoGeometryWrap" class="stack" hidden>${selectField('skoCasing', 'Наружный диаметр ЭК', Object.keys(casingWalls), '146')}<div id="skoWallWrap"></div></div>
 <div id="skoTubingWrap" class="field"><label>НКТ</label><div class="nkt-grid">${['60', '73', '89'].map((t) => `<button type="button" class="nkt-option ${t === '73' ? 'active' : ''}" data-t="${t}">${t} мм</button>`).join('')}</div><div class="hint" id="skoTubingVolume"></div></div>
 <div id="liveResult">${resultCard('Общий объём обработки', '', 'Введите параметры')}</div><div class="hint">Расчёт по формулам регламента. Технология, концентрация кислоты и окончательный объём определяются Планом-заказом и технологической службой.</div></main>`);
  const byId = (id) => document.getElementById(id),
    liters = () => ({ 60: 2, 73: 3, 89: 4.5 })[selectedTubing];
  function calc() {
    const depth = num(byId('skoDepth').value),
      casing = num(byId('skoCasing').value),
      wall = num(byId('skoWall')?.value);
    const treatment = DngMath.skoVolume(
      variant,
      depth,
      liters(),
      casing !== null && wall !== null ? (casing - 2 * wall) / 1000 : null,
      Number(selectedTubing) / 1000,
    );
    byId('skoTubingVolume').textContent =
      variant === 'direct' || variant === 'direct8' ? `Справочный объём: ${fmt(liters())} л/м` : '';
    if (!treatment)
      return setResult('Общий объём обработки', '', 'Проверьте глубину и размеры труб');
    const value = `${fmt(treatment.total)} м³`;
    setResult('Общий объём обработки', value);
    state.last = {
      title: 'Объём СКО',
      method: variants.find(([key]) => key === variant)[1],
      result: value,
      details:
        `Глубина=${depth} м; НКТ=${selectedTubing} мм` +
        (variant === 'reverse' || variant === 'reverseOff' ? `; ЭК=${casing}×${wall} мм` : ''),
    };
  }
  function buildWall() {
    const values = casingWalls[byId('skoCasing').value] || [];
    byId('skoWallWrap').innerHTML = selectField(
      'skoWall',
      'Толщина стенки ЭК',
      values,
      values.includes(8.5) ? 8.5 : values[0],
    );
    bind(['skoWall'], calc);
  }
  function showVariant() {
    byId('skoGeometryWrap').hidden = variant === 'direct' || variant === 'direct8';
    byId('skoTubingWrap').hidden = variant === 'reverseOff';
    calc();
  }
  document.querySelectorAll('[data-v]').forEach(
    (button) =>
      (button.onclick = () => {
        variant = button.dataset.v;
        document
          .querySelectorAll('[data-v]')
          .forEach((item) => item.classList.toggle('active', item === button));
        showVariant();
      }),
  );
  document.querySelectorAll('[data-t]').forEach(
    (button) =>
      (button.onclick = () => {
        selectedTubing = button.dataset.t;
        document
          .querySelectorAll('[data-t]')
          .forEach((item) => item.classList.toggle('active', item === button));
        calc();
      }),
  );
  bind(['skoCasing'], () => {
    buildWall();
    calc();
  });
  bind(['skoDepth'], calc);
  buildWall();
  showVariant();
}

function renderTap() {
  app.innerHTML = screen(
    `${topbar('Расчёт отпайки ТМПН')}<main class="content stack"><div class="section-title">Тип станции управления</div><div class="chips"><button class="chip active" data-mode="no">Без ЧРП</button><button class="chip" data-mode="vfd">С ЧРП</button></div><div class="row">${field('trIn', 'Номинальное Uвх ТМПН, В')}${field('supplyV', 'Фактическое U сети, В')}</div><div class="row">${field('motorV', 'Паспортное U ПЭД, В')}${field('motorI', 'Номинальный ток ПЭД, А')}</div><div class="row">${field('cableL', 'Кабель, м')}${field('cableS', 'Сечение, мм²')}</div>${field('temp', 'Температура пласта, °C')}<div class="section-title">Материал кабеля</div><div class="chips"><button class="chip active" data-mat="cu">Медь</button><button class="chip" data-mat="al">Алюминий</button></div><div class="section-title">Тип ПЭД</div><div class="chips"><button class="chip active" data-motor="async">Асинхронный</button><button class="chip" data-motor="pm">Вентильный</button></div><div id="vfdFields"></div><div id="liveResult">${resultCard('Расчётное напряжение отпайки', '', 'Заполните параметры')}</div><div class="hint">Выберите ближайшую доступную отпайку в большую сторону.</div></main>`,
  );
  let mode = 'no',
    mat = 'cu',
    motor = 'async',
    filter = false;
  function rebuild() {
    if (!vfdFields.firstElementChild) {
      vfdFields.innerHTML = `<div class="row">${field('vfdV', 'Uвых max ЧРП, В')}${field('fmax', 'Максимальная частота ЧРП Fб, Гц')}</div>${field('fnom', 'Номинальная частота ПЭД, Гц')}<label class="switchline card"><span><b>Выходной фильтр в составе НЭО</b><br><span class="subtle">Учитывать коэффициент 1,08</span></span><input id="filter" type="checkbox"></label>`;
      bind(['vfdV', 'fmax', 'fnom'], calc);
      document.getElementById('filter').onchange = (event) => {
        filter = event.target.checked;
        calc();
      };
    }
    vfdFields.hidden = mode !== 'vfd';
    calc();
  }
  function calc() {
    const a = num(trIn.value),
      b = num(supplyV.value),
      u = num(motorV.value),
      i = num(motorI.value),
      l = num(cableL.value),
      s = num(cableS.value),
      t = num(temp.value);
    if ([a, b, u, i, l, s, t].some((v) => v === null) || [a, b, u, i, l, s].some((v) => v <= 0))
      return setResult('Расчётное напряжение отпайки', '', 'Заполните параметры');
    const calculation = DngMath.tapVoltage({
      mode,
      input: a,
      supply: b,
      motorVoltage: u,
      current: i,
      length: l,
      section: s,
      temperature: t,
      material: mat,
      motor,
      vfdVoltage: num(document.getElementById('vfdV')?.value),
      maxFrequency: num(document.getElementById('fmax')?.value),
      nominalFrequency: num(document.getElementById('fnom')?.value),
      filter,
    });
    if (!calculation)
      return setResult('Расчётное напряжение отпайки', '', 'Проверьте температуру и параметры ЧРП');
    const text = `${fmt(calculation.total, 1)} В\nПотери в кабеле: ${fmt(calculation.loss, 1)} В`;
    setResult('Расчётное напряжение отпайки', text);
    state.last = {
      title: 'Отпайка ТМПН',
      method: mode === 'no' ? 'Без ЧРП' : 'С ЧРП',
      result: text,
      details: `Uвх=${a}; Uсети=${b}; UПЭД=${u}; I=${i}; кабель=${l} м; сечение=${s} мм²; T=${t}°C`,
    };
  }
  bind(['trIn', 'supplyV', 'motorV', 'motorI', 'cableL', 'cableS', 'temp'], calc);
  document.querySelectorAll('[data-mode]').forEach(
    (x) =>
      (x.onclick = () => {
        mode = x.dataset.mode;
        document
          .querySelectorAll('[data-mode]')
          .forEach((y) => y.classList.toggle('active', y === x));
        rebuild();
      }),
  );
  document.querySelectorAll('[data-mat]').forEach(
    (x) =>
      (x.onclick = () => {
        mat = x.dataset.mat;
        document
          .querySelectorAll('[data-mat]')
          .forEach((y) => y.classList.toggle('active', y === x));
        calc();
      }),
  );
  document.querySelectorAll('[data-motor]').forEach(
    (x) =>
      (x.onclick = () => {
        motor = x.dataset.motor;
        document
          .querySelectorAll('[data-motor]')
          .forEach((y) => y.classList.toggle('active', y === x));
        calc();
      }),
  );
  rebuild();
}

let historyVisibleCount = 50;
function historyCalculationNotice(entry) {
  return entry.method === 'По справочнику' &&
    /ЭК=139[.,]7\s*мм;\s*НКТ=73\s*мм/.test(entry.details || '') &&
    /Vкп=0[.,]0100(?:00)?\s*м³\/м/.test(entry.details || '')
    ? 'Требует пересчёта: старое табличное Vкп для ЭК 139,7 / НКТ 73.' : '';
}
function renderHistory() {
  const list = calculationHistory(),
    visible = list.slice(0, historyVisibleCount);
  app.innerHTML = screen(
    `${topbar('История расчётов')}<main class="content stack">${list.length ? `<button class="btn danger full" id="clearHistory">Очистить историю</button><div class="hint">Показано ${visible.length} из ${list.length}</div>${visible.map((entry) => `<div class="card history-item"><div class="title">${esc(entry.title)}</div><div class="date">${new Date(entry.ts).toLocaleString('ru-RU')}</div>${historyCalculationNotice(entry) ? `<div class="error">${esc(historyCalculationNotice(entry))}</div>` : ''}<div class="history-result">${esc(entry.result)}</div><div class="subtle">${esc(entry.method || '')}</div><div class="hint">${esc(entry.details || '')}</div>${entry.id ? `<button class="btn danger" data-history-delete="${esc(entry.id)}" aria-label="Удалить запись ${esc(entry.title)}">Удалить запись</button>` : ''}</div>`).join('')}${visible.length < list.length ? '<button class="btn secondary full" id="moreHistory">Показать ещё</button>' : ''}` : '<div class="empty">История пока пустая.<br>Выполненные расчёты будут сохраняться на этом устройстве.</div>'}</main>`,
    'history',
  );
  document.getElementById('clearHistory')?.addEventListener('click', () => {
    if (confirm('Очистить всю историю?')) {
      clearHistory();
      historyVisibleCount = 50;
      renderHistory();
    }
  });
  document.getElementById('moreHistory')?.addEventListener('click', () => {
    historyVisibleCount += 50;
    renderHistory();
  });
  document.querySelectorAll('[data-history-delete]').forEach(
    (button) =>
      (button.onclick = () => {
        if (deleteHistory(button.dataset.historyDelete)) {
          resetHistoryDraft();
          renderHistory();
        }
      }),
  );
}

// Ported from Android part02 OperatingModeCalculator; all times are minutes.
function renderOperating(mode) {
  const isApv = mode === 'apv',
    title = isApv ? 'Перевод УПР в АПВ' : 'Перевод ПР в УПР';
  app.innerHTML = screen(`${topbar(title)}<main class="content stack">
    ${field('operatingRate', 'Подача насоса, м³/сут')}
    ${field('inflowRate', 'Потенциал скважины, м³/сут')}
    ${field('startupMinutes', 'Время появления подачи, мин')}
    ${field('cycleMinutes', 'Выбранный цикл, мин', `value="${isApv ? 360 : 60}"`)}
    ${isApv ? field('drainMinutes', 'Время слива, мин', 'value="60"') : ''}
    <div id="liveResult">${resultCard(title, '', 'Заполните параметры')}</div>
    <button class="btn full" id="useMinimumCycle" hidden>Использовать минимальный цикл</button>
    <p class="hint">${isApv ? 'Минимальный цикл рассчитывается независимо от выбранного и округляется вверх до 60 минут. Отстой считается для выбранного цикла.' : 'Время работы = цикл × потенциал / дебит + время появления подачи.'} Время работы округляется до ближайшей целой минуты, время остановки — остаток выбранного цикла.</p>
  </main>`);
  document.getElementById('cycleMinutes').inputMode = 'numeric';
  const ids = [
    'operatingRate',
    'inflowRate',
    'startupMinutes',
    'cycleMinutes',
    ...(isApv ? ['drainMinutes'] : []),
  ];
  let minimum = null;
  function calc() {
    state._last = null;
    const [q, p, start, cycle, drain] = ids.map((id) => num(document.getElementById(id).value));
    const button = document.getElementById('useMinimumCycle');
    button.hidden = true;
    minimum = null;
    if (cycle !== null && (!Number.isSafeInteger(cycle) || cycle <= 0))
      return setResult(title, '', 'Выбранный цикл задаётся положительным целым числом минут');
    let result;
    if (isApv) {
      result = DngMath.apvCycle(q, p, start, drain, cycle);
      if (!result)
        return setResult(title, '', 'Подача должна быть больше потенциала; проверьте время');
      minimum = result.minimum;
      if (!result.suitable) {
        button.hidden = false;
        button.textContent = `Использовать ${minimum} мин`;
        return setResult(
          'Выбранный цикл не подходит',
          `Минимально допустимый цикл: ${minimum} мин`,
        );
      }
    } else {
      result = DngMath.operatingCycle(q, p, start, cycle);
      if (!result)
        return setResult(
          title,
          '',
          'Проверьте параметры: время работы должно быть меньше выбранного цикла',
        );
    }
    const rounded = DngMath.roundOperatingTimes(result.total, cycle);
    if (!rounded || (rounded.total > 0 && rounded.total < start))
      return setResult(
        title,
        '',
        'Режим нельзя выразить целыми минутами для этого цикла. Увеличьте выбранный цикл',
      );
    if (isApv && rounded.stop < drain)
      return setResult(
        title,
        '',
        'После округления отстой меньше времени слива. Увеличьте выбранный цикл',
      );
    const value = isApv
      ? `Работа: ${rounded.total} мин\nОтстой: ${rounded.stop} мин\nВремя слива: ${fmt(drain)} мин\nМинимальный цикл: ${minimum} мин\nВыбранный цикл подходит`
      : `Работа: ${rounded.total} мин\nОстановка: ${rounded.stop} мин`;
    setResult(title, value);
    state.last = {
      title,
      method: 'Расчёт цикла',
      result: value,
      details:
        `Подача=${q} м³/сут; потенциал=${p} м³/сут; появление подачи=${start} мин; цикл=${cycle} мин` +
        (isApv ? `; слив=${drain} мин` : ''),
    };
  }
  document.getElementById('useMinimumCycle').onclick = () => {
    if (minimum === null || minimum <= 0) return;
    document.getElementById('cycleMinutes').value = minimum;
    calc();
    snapshotRoute();
  };
  bind(ids, calc);
}

function renderTechnologist() {
  app.innerHTML = screen(
    `${topbar('Технолог')}<main class="content stack">
    ${menuCard('↻', 'Расчёт РПД', 'Цикл откачки, накопления и давления на приёме', 'rpd')}
    ${menuCard('flow', 'Определение притока', 'Три режима ОК, Vкп по таблице или геометрии', 'flow')}
    ${menuCard('↻', 'Перевод ПР в УПР', 'Расчёт времени работы и остановки', 'upr')}
    ${menuCard('↻', 'Перевод УПР в АПВ', 'Проверка цикла с учётом времени слива', 'apv')}
    ${menuCard('sko', 'Объём СКО', 'Четыре варианта расчёта кислотной обработки', 'sko')}
    ${menuCard('🌡', 'Настройка температуры ТМС', 'Расчёт уставки по рабочей и максимальной температуре', 'temperatureSetpoint')}
  </main>`,
    'technologist',
  );
}
