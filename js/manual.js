// Manual measurement screen. Independent from the rest of the calculator UI.
let manualTimerHandle = null,
  manualTimerStart = 0,
  manualTimerElapsed = 0,
  manualTimerRunning = false;
let manualSavedLiters = '',
  manualSavedSeconds = '',
  manualSavedMinutes = false;
let manualSaveCurrent = null;
const MANUAL_TIMER_KEY = 'operator_dng_manual_timer_v1';
try {
  const saved = JSON.parse(localStorage.getItem(MANUAL_TIMER_KEY) || 'null');
  if (
    saved &&
    Number.isFinite(saved.elapsed) &&
    saved.elapsed >= 0 &&
    Number.isFinite(saved.wall)
  ) {
    manualTimerElapsed = saved.elapsed + (saved.running ? Math.max(0, Date.now() - saved.wall) : 0);
    manualTimerRunning = saved.running === true;
    manualTimerStart = performance.now();
    manualSavedLiters = typeof saved.liters === 'string' ? saved.liters : '';
    manualSavedSeconds = typeof saved.seconds === 'string' ? saved.seconds : '';
    manualSavedMinutes = saved.minutes === true;
  }
} catch {}
function manualElapsed() {
  return (
    manualTimerElapsed +
    (manualTimerRunning ? Math.max(0, performance.now() - manualTimerStart) : 0)
  );
}
function persistManualTimer() {
  if (state.route === 'manual' && document.getElementById('liters')) {
    manualSavedLiters = document.getElementById('liters').value;
    manualSavedSeconds = document.getElementById('seconds').value;
    manualSavedMinutes = document.getElementById('manualMinutesMode').checked;
  }
  try {
    localStorage.setItem(
      MANUAL_TIMER_KEY,
      JSON.stringify({
        elapsed: manualElapsed(),
        running: manualTimerRunning,
        wall: Date.now(),
        liters: manualSavedLiters,
        seconds: manualSavedSeconds,
        minutes: manualSavedMinutes,
      }),
    );
  } catch {}
}
function pauseManualTimer() {
  manualTimerElapsed = manualElapsed();
  manualTimerRunning = false;
  stopManualTimer();
  persistManualTimer();
}
window.addEventListener('pagehide', persistManualTimer);
window.addEventListener('pagehide', () => {
  if (state.route === 'manual') manualSaveCurrent?.();
});
document.addEventListener('input', (event) => {
  if (state.route === 'manual' && ['liters', 'seconds'].includes(event.target.id))
    persistManualTimer();
});
function stopManualTimer() {
  if (manualTimerHandle !== null) {
    clearInterval(manualTimerHandle);
    manualTimerHandle = null;
  }
  persistManualTimer();
}
function wheelHTML(id, label, max, initial) {
  return `<div class="time-wheel-column"><div class="time-wheel-label">${label}</div><div class="time-wheel" id="${id}" role="listbox" tabindex="0" aria-label="${label}">${Array.from({ length: max }, (_, i) => `<button type="button" class="time-wheel-option" data-value="${i}" role="option" aria-selected="${i === initial}">${String(i).padStart(2, '0')}</button>`).join('')}</div></div>`;
}
function initWheel(id, initial, onChange) {
  const el = document.getElementById(id),
    rowHeight = 48,
    max = el.children.length;
  let current = initial,
    scrollTimer = null;
  function select(value, animate = true) {
    if (!el.isConnected) return;
    current = Math.max(0, Math.min(max - 1, value));
    el.querySelectorAll('.time-wheel-option').forEach((node, i) =>
      node.setAttribute('aria-selected', String(i === current)),
    );
    el.scrollTo({ top: current * rowHeight, behavior: 'auto' });
    onChange();
    snapshotRoute();
  }
  el.addEventListener(
    'scroll',
    () => {
      if (!el.getClientRects().length) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (!el.isConnected || !el.getClientRects().length) return;
        const next = Math.max(0, Math.min(max - 1, Math.round(el.scrollTop / rowHeight)));
        select(next, false);
      }, 110);
    },
    { passive: true },
  );
  el.addEventListener('click', (event) => {
    const item = event.target.closest('[data-value]');
    if (item) select(Number(item.dataset.value));
  });
  el.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      select(current + (event.key === 'ArrowDown' ? 1 : -1));
    }
  });
  requestAnimationFrame(() => select(current, false));
  return () => current;
}
function renderManual() {
  stopManualTimer();
  const now = new Date(),
    hour = now.getHours(),
    minute = now.getMinutes();
  const draft = routeDrafts.get('manual'),
    saved = draft?._manual;
  const minutesInitially = draft?.manualMinutesMode?.checked ?? manualSavedMinutes;
  const calendarDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
    today = calendarDate(now),
    yesterday = calendarDate(yesterdayDate);
  const startDateValue =
      draft?.manualStartDate?.value || (saved?.startDay === 0 ? yesterday : today),
    endDateValue = draft?.manualEndDate?.value || today;

  const initial = (id, fallback, max) =>
    Number.isInteger(saved?.wheels?.[id]) && saved.wheels[id] >= 0 && saved.wheels[id] < max
      ? saved.wheels[id]
      : fallback;
  app.innerHTML = screen(`${topbar('Ручной замер дебита')}<main class="content stack">
    ${field('liters', 'Набежавший объём, л')}
    <label class="switchline card"><span><b>Расчёт по временному интервалу</b></span><input id="manualIntervalMode" type="checkbox"></label>
    <section id="manualStopwatch" class="stack">
      ${field('seconds', 'Время замера, с')}
      <label class="switchline card"><span>Время в минутах</span><input id="manualMinutesMode" type="checkbox" ${minutesInitially ? 'checked' : ''}></label>
      <div class="row"><button class="btn" id="timerBtn">Старт</button><button class="btn secondary" id="resetBtn">Сброс времени</button></div>
    </section>
    <section id="manualInterval" class="stack" hidden>
      <div class="card stack"><div class="section-title">Начало</div><div class="field"><label for="manualStartDate">Дата начала</label><input id="manualStartDate" type="date" value="${esc(startDateValue)}"></div><div class="chips" id="startDayChoices"><button type="button" class="chip" data-day="0">Вчера</button><button type="button" class="chip active" data-day="1">Сегодня</button></div>
      <div class="time-wheel-pair">${wheelHTML('startHours', 'Часы', 24, hour)}${wheelHTML('startMinutes', 'Минуты', 60, minute)}</div></div>
      <div class="card stack"><div class="section-title">Конец</div><div class="field"><label for="manualEndDate">Дата окончания</label><input id="manualEndDate" type="date" value="${esc(endDateValue)}"></div><div class="time-wheel-pair">${wheelHTML('endHours', 'Часы', 24, hour)}${wheelHTML('endMinutes', 'Минуты', 60, minute)}</div></div>
      <div class="hint" id="intervalDuration">Выберите время начала и окончания</div>
    </section>
    <div id="liveResult">${resultCard('Дебит скважины', '', 'Введите объём и время')}</div>
    <button class="btn full" id="saveManual">Сохранить замер в историю</button>
    <button class="btn secondary full" id="clear">Очистить</button>
  </main>`);
  const byId = (id) => document.getElementById(id),
    volume = byId('liters'),
    seconds = byId('seconds'),
    toggle = byId('manualIntervalMode');
  let lastMinutesMode = minutesInitially;
  volume.value = manualSavedLiters;
  seconds.value = manualSavedSeconds;
  let startDay = saved?.startDay === 0 ? 0 : 1,
    getSH = () => hour,
    getSM = () => minute,
    getEH = () => hour,
    getEM = () => minute,
    lastEntry = null;
  let savedHistoryId = null,
    savedHistoryKey = null;
  function calc() {
    const liters = num(volume.value),
      isInterval = toggle.checked;
    let duration = null,
      debit = null,
      details = '';
    if (isInterval) {
      duration = DngMath.intervalBetweenDates(
        byId('manualStartDate').value,
        getSH(),
        getSM(),
        byId('manualEndDate').value,
        getEH(),
        getEM(),
      );
      byId('intervalDuration').textContent =
        duration === null
          ? 'Проверьте интервал: конец должен быть позже начала'
          : `Продолжительность: ${Math.floor(duration / 60)} ч ${duration % 60} мин`;
      debit = DngMath.manualDebitInterval(liters, duration);
      details = `Объём=${liters} л; начало=${byId('manualStartDate').value} ${String(getSH()).padStart(2, '0')}:${String(getSM()).padStart(2, '0')}; конец=${byId('manualEndDate').value} ${String(getEH()).padStart(2, '0')}:${String(getEM()).padStart(2, '0')}; интервал=${duration} мин`;
    } else {
      const entered = num(seconds.value);
      duration = entered === null ? null : entered * (byId('manualMinutesMode').checked ? 60 : 1);
      debit = DngMath.manualDebit(liters, duration);
      details = `Объём=${liters} л; время=${duration} с`;
    }
    lastEntry =
      debit === null
        ? null
        : {
            title: 'Ручной замер дебита',
            method: isInterval ? 'Временной интервал' : 'Секундомер / ручной ввод',
            result: `${fmt(debit)} м³/сут`,
            details,
          };
    setResult(
      'Дебит скважины',
      lastEntry?.result || '',
      lastEntry ? undefined : 'Введите положительный объём и корректное время',
    );
    byId('saveManual').disabled = !lastEntry;
  }
  getSH = initWheel('startHours', initial('startHours', hour, 24), calc);
  getSM = initWheel('startMinutes', initial('startMinutes', minute, 60), calc);
  getEH = initWheel('endHours', initial('endHours', hour, 24), calc);
  getEM = initWheel('endMinutes', initial('endMinutes', minute, 60), calc);
  byId('startDayChoices')
    .querySelectorAll('[data-day]')
    .forEach((b) => b.classList.toggle('active', Number(b.dataset.day) === startDay));
  byId('startDayChoices').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    startDay = Number(b.dataset.day);
    byId('manualStartDate').value = startDay === 0 ? yesterday : today;
    byId('manualEndDate').value = today;
    byId('startDayChoices')
      .querySelectorAll('button')
      .forEach((x) => x.classList.toggle('active', x === b));
    calc();
    snapshotRoute();
  });
  bind(['manualStartDate', 'manualEndDate'], () => {
    const value = byId('manualStartDate').value;
    startDay = value === yesterday ? 0 : 1;
    byId('startDayChoices')
      .querySelectorAll('[data-day]')
      .forEach((button) =>
        button.classList.toggle(
          'active',
          value === (Number(button.dataset.day) === 0 ? yesterday : today),
        ),
      );
    calc();
    snapshotRoute();
  });
  toggle.addEventListener('change', () => {
    if (toggle.checked) pauseManualTimer();
    stopManualTimer();
    byId('timerBtn').textContent = 'Старт';
    seconds.disabled = false;
    byId('manualMinutesMode').disabled = false;
    byId('manualStopwatch').hidden = toggle.checked;
    byId('manualInterval').hidden = !toggle.checked;
    if (toggle.checked)
      requestAnimationFrame(() => {
        if (!volume.isConnected) return;
        document.querySelectorAll('.time-wheel').forEach((wheel) => {
          const selected = Number(
            wheel.querySelector('[aria-selected="true"]')?.dataset.value || 0,
          );
          wheel.scrollTo({ top: selected * 48, behavior: 'auto' });
        });
      });
    calc();
  });
  function tick() {
    if (!volume.isConnected) return;
    seconds.value = (manualElapsed() / (byId('manualMinutesMode').checked ? 60000 : 1000)).toFixed(
      2,
    );
    calc();
  }
  function showRunning() {
    if (manualTimerHandle !== null) clearInterval(manualTimerHandle);
    seconds.disabled = true;
    byId('manualMinutesMode').disabled = true;
    byId('timerBtn').textContent = 'Стоп';
    tick();
    manualTimerHandle = setInterval(tick, 100);
  }
  byId('manualMinutesMode').onchange = () => {
    const value = num(seconds.value),
      minutes = byId('manualMinutesMode').checked;
    if (value !== null && minutes !== lastMinutesMode)
      seconds.value = String(minutes ? value / 60 : value * 60);
    lastMinutesMode = minutes;
    byId('seconds').previousElementSibling.textContent = minutes
      ? 'Время замера, мин'
      : 'Время замера, с';
    calc();
    snapshotRoute();
    persistManualTimer();
  };
  byId('timerBtn').addEventListener('click', () => {
    if (manualTimerRunning) {
      pauseManualTimer();
      tick();
      seconds.disabled = false;
      byId('manualMinutesMode').disabled = false;
      byId('timerBtn').textContent = 'Продолжить';
      calc();
      snapshotRoute();
    } else {
      manualTimerElapsed =
        (num(seconds.value) || 0) * (byId('manualMinutesMode').checked ? 60000 : 1000);
      manualTimerStart = performance.now();
      manualTimerRunning = true;
      showRunning();
      persistManualTimer();
    }
  });
  byId('resetBtn').addEventListener('click', () => {
    pauseManualTimer();
    manualTimerElapsed = 0;
    seconds.disabled = false;
    byId('manualMinutesMode').disabled = false;
    seconds.value = '';
    byId('timerBtn').textContent = 'Старт';
    calc();
    persistManualTimer();
    snapshotRoute();
  });
  bind(['liters', 'seconds'], () => {
    if (!manualTimerRunning)
      manualTimerElapsed =
        (num(seconds.value) || 0) * (byId('manualMinutesMode').checked ? 60000 : 1000);
    calc();
  });
  function saveMeasurement(explicit = false) {
    if (manualTimerRunning) tick();
    else calc();
    if (!lastEntry) return false;
    const key = toggle.checked ? lastEntry.details : 'stopwatch';
    if (
      !explicit &&
      savedHistoryId &&
      savedHistoryKey === key &&
      updateHistory(savedHistoryId, lastEntry)
    )
      return true;
    const id = saveHistory(lastEntry);
    if (!id) return false;
    savedHistoryId = id;
    savedHistoryKey = key;
    resetHistoryDraft();
    return true;
  }
  manualSaveCurrent = () => saveMeasurement(false);
  byId('saveManual').addEventListener('click', () => {
    if (!saveMeasurement(true)) return;
    byId('saveManual').textContent = 'Сохранено ✓';
    setTimeout(() => {
      const button = byId('saveManual');
      if (button) button.textContent = 'Сохранить замер в историю';
    }, 1200);
  });
  byId('clear').addEventListener('click', () => {
    volume.value = '';
    byId('resetBtn').click();
    calc();
  });
  calc();
  requestAnimationFrame(() => {
    if (state.route !== 'manual' || !volume.isConnected) return;
    if (manualTimerRunning && !toggle.checked) {
      showRunning();
    } else {
      byId('seconds').previousElementSibling.textContent = byId('manualMinutesMode').checked
        ? 'Время замера, мин'
        : 'Время замера, с';
      calc();
    }
  });
}
