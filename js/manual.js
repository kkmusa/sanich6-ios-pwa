// Manual measurement screen. Independent from the rest of the calculator UI.
let manualTimerHandle = null,
  manualTimerStart = 0,
  manualTimerElapsed = 0,
  manualTimerRunning = false;
let manualSavedLiters = '',
  manualSavedSeconds = '',
  manualSavedMinutes = false;
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
    manualTimerStart = Date.now();
    manualSavedLiters = typeof saved.liters === 'string' ? saved.liters : '';
    manualSavedSeconds = typeof saved.seconds === 'string' ? saved.seconds : '';
    manualSavedMinutes = saved.minutes === true;
  }
} catch {}
function manualElapsed() {
  return manualTimerElapsed + (manualTimerRunning ? Math.max(0, Date.now() - manualTimerStart) : 0);
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
    rowHeight = 44,
    max = el.children.length;
  let current = initial;
  function update(value) {
    const next = Math.max(0, Math.min(max - 1, value));
    if (
      next === current &&
      el.querySelector('[aria-selected="true"]')?.dataset.value === String(next)
    )
      return;
    current = next;
    el.querySelectorAll('.time-wheel-option').forEach((node, i) =>
      node.setAttribute('aria-selected', String(i === current)),
    );
    onChange();
    snapshotRoute();
  }
  function select(value) {
    if (!el.isConnected) return;
    update(value);
    el.scrollTo({ top: current * rowHeight, behavior: 'auto' });
  }
  el.addEventListener(
    'scroll',
    () => {
      if (el.getClientRects().length) update(Math.round(el.scrollTop / rowHeight));
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
  function calendarDays() {
    const date = new Date();
    return {
      today: calendarDate(date),
      yesterday: calendarDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)),
    };
  }
  const { today, yesterday } = calendarDays();
  if (draft && saved?.datesEdited === false) {
    draft.manualStartDate = { value: today };
    draft.manualEndDate = { value: today };
  }
  const startDateValue = draft?.manualStartDate?.value || today,
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
      <input id="manualMinutesMode" type="checkbox" hidden ${minutesInitially ? 'checked' : ''}><div class="chips" id="manualUnitChoices"><button type="button" class="chip" data-minutes="false">Секунды</button><button type="button" class="chip" data-minutes="true">Минуты</button></div>
    </section>
    <section id="manualInterval" class="stack" data-dates-edited="${saved?.datesEdited === true}" hidden>
      <div class="card stack"><div class="section-title">Начало</div><div class="field"><label for="manualStartDate">Дата начала</label><input id="manualStartDate" type="date" value="${esc(startDateValue)}"></div><div class="chips" id="startDayChoices"><button type="button" class="chip" data-day="0">Вчера</button><button type="button" class="chip active" data-day="1">Сегодня</button></div>
      <div class="time-wheel-pair">${wheelHTML('startHours', 'Часы', 24, hour)}${wheelHTML('startMinutes', 'Минуты', 60, minute)}</div></div>
      <div class="card stack"><div class="section-title">Конец</div><div class="field"><label for="manualEndDate">Дата окончания</label><input id="manualEndDate" type="date" value="${esc(endDateValue)}"></div><div class="time-wheel-pair">${wheelHTML('endHours', 'Часы', 24, hour)}${wheelHTML('endMinutes', 'Минуты', 60, minute)}</div></div>
      <div class="hint" id="intervalDuration">Выберите время начала и окончания</div>
    </section>
    <div class="row manual-actions"><button class="btn" id="timerBtn">Старт</button><button class="btn" id="lapBtn" disabled>Круг</button><button class="btn" id="resetBtn" aria-label="Сброс времени">Сброс</button></div>
    <div id="liveResult">${resultCard('Дебит скважины', '', 'Введите объём и время')}</div>
    <section id="manualLaps" class="card" hidden><b>Круги текущего замера</b><ol id="manualLapList"></ol></section>
    <div class="hint" id="manualSaveStatus" role="status">Итоговый замер сохраняется автоматически. Круги в историю не записываются.</div>
    <button class="btn secondary full" id="clear">Очистить</button>
  </main>`);
  const byId = (id) => document.getElementById(id),
    volume = byId('liters'),
    seconds = byId('seconds'),
    toggle = byId('manualIntervalMode');
  let lastMinutesMode = minutesInitially;
  volume.value = manualSavedLiters;
  seconds.value = manualSavedSeconds;
  let startDay = startDateValue === yesterday ? 0 : 1,
    getSH = () => hour,
    getSM = () => minute,
    getEH = () => hour,
    getEM = () => minute,
    lastEntry = null;
  let savedHistoryId = null,
    savedHistoryKey = null;
  try {
    const savedHistory = JSON.parse(
      localStorage.getItem('sanich_manual_history_session') || 'null',
    );
    savedHistoryId = savedHistory?.id || null;
    savedHistoryKey = savedHistory?.key || null;
  } catch {}
  let lapNumber = 0,
    stoppedForSave = !manualTimerRunning && manualElapsed() > 0,
    saveTimer;
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
    byId('timerBtn').hidden = toggle.checked;
    byId('lapBtn').hidden = toggle.checked;
    byId('manualLaps').hidden = toggle.checked || !byId('manualLapList').children.length;
    byId('timerBtn').disabled = toggle.checked;
    byId('lapBtn').disabled = toggle.checked || !manualTimerRunning || !lastEntry;
    setResult(
      'Дебит скважины',
      lastEntry?.result || '',
      lastEntry ? undefined : 'Введите положительный объём и корректное время',
    );
  }
  getSH = initWheel('startHours', initial('startHours', hour, 24), calc);
  getSM = initWheel('startMinutes', initial('startMinutes', minute, 60), calc);
  getEH = initWheel('endHours', initial('endHours', hour, 24), calc);
  getEM = initWheel('endMinutes', initial('endMinutes', minute, 60), calc);
  function syncStartDayChoices() {
    const dates = calendarDays(),
      value = byId('manualStartDate').value;
    startDay = value === dates.yesterday ? 0 : 1;
    byId('startDayChoices')
      .querySelectorAll('[data-day]')
      .forEach((button) =>
        button.classList.toggle(
          'active',
          value === (Number(button.dataset.day) === 0 ? dates.yesterday : dates.today),
        ),
      );
  }
  syncStartDayChoices();
  byId('startDayChoices').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    byId('manualInterval').dataset.datesEdited = 'true';
    startDay = Number(b.dataset.day);
    const dates = calendarDays();
    byId('manualStartDate').value = startDay === 0 ? dates.yesterday : dates.today;
    byId('manualEndDate').value = dates.today;
    syncStartDayChoices();
    calc();
    snapshotRoute();
  });
  bind(['manualStartDate', 'manualEndDate'], () => {
    byId('manualInterval').dataset.datesEdited = 'true';
    syncStartDayChoices();
    calc();
    snapshotRoute();
  });
  toggle.addEventListener('change', (event) => {
    if (toggle.checked) {
      // Refresh automatic defaults, but keep dates explicitly chosen by the user.
      // Draft restoration dispatches an untrusted event and preserves its values.
      if (event.isTrusted && byId('manualInterval').dataset.datesEdited !== 'true') {
        const currentToday = calendarDays().today;
        byId('manualStartDate').value = currentToday;
        byId('manualEndDate').value = currentToday;
        syncStartDayChoices();
      }
      pauseManualTimer();
    }
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
          wheel.scrollTo({ top: selected * 44, behavior: 'auto' });
        });
      });
    calc();
    snapshotRoute();
    persistDraft();
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
      stoppedForSave = true;
      calc();
      saveFinal();
      snapshotRoute();
    } else {
      stoppedForSave = false;
      clearTimeout(saveTimer);
      manualTimerElapsed =
        (num(seconds.value) || 0) * (byId('manualMinutesMode').checked ? 60000 : 1000);
      manualTimerStart = Date.now();
      manualTimerRunning = true;
      showRunning();
      persistManualTimer();
    }
  });
  byId('resetBtn').addEventListener('click', () => {
    stoppedForSave = false;
    clearTimeout(saveTimer);
    savedHistoryId = savedHistoryKey = null;
    try {
      localStorage.removeItem('sanich_manual_history_session');
    } catch {}
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
  function saveMeasurement() {
    if (manualTimerRunning) tick();
    else calc();
    if (!lastEntry) return false;
    const key = toggle.checked ? 'interval' : 'stopwatch';
    if (savedHistoryId && savedHistoryKey === key && updateHistory(savedHistoryId, lastEntry))
      return true;
    const id = saveHistory(lastEntry);
    if (!id) return false;
    savedHistoryId = id;
    savedHistoryKey = key;
    try {
      localStorage.setItem('sanich_manual_history_session', JSON.stringify({ id, key }));
    } catch {}
    resetHistoryDraft();
    return true;
  }
  function saveFinal() {
    if (manualTimerRunning || !lastEntry) return;
    if (saveMeasurement())
      byId('manualSaveStatus').textContent = 'Итоговый замер сохранён в историю.';
  }
  byId('lapBtn').addEventListener('click', () => {
    if (toggle.checked || !manualTimerRunning || !lastEntry) return;
    const liters = num(volume.value),
      duration = manualElapsed() / 1000;
    const debit = DngMath.manualDebit(liters, duration);
    if (debit === null) return;
    const item = document.createElement('li');
    item.textContent = `Круг ${++lapNumber}: ${fmt(duration)} с · ${fmt(liters)} л · ${fmt(debit)} м³/сут`;
    byId('manualLapList').appendChild(item);
    byId('manualLaps').hidden = false;
    // A lap is a snapshot of the shared running timer, not a new measurement.
    tick();
    persistManualTimer();
    snapshotRoute();
  });
  function persistDraft() {
    persistManualTimer();
    clearTimeout(saveTimer);
    if (!manualTimerRunning && (toggle.checked || stoppedForSave))
      saveTimer = setTimeout(() => {
        if (volume.isConnected && !manualTimerRunning) saveFinal();
      }, 2000);
  }
  bind(
    ['liters', 'seconds', 'manualStartDate', 'manualEndDate', 'manualIntervalMode'],
    persistDraft,
  );
  byId('manualInterval').addEventListener('scroll', persistDraft, true);
  byId('manualInterval').addEventListener('click', persistDraft);
  byId('manualUnitChoices').addEventListener('click', (event) => {
    const button = event.target.closest('[data-minutes]');
    if (!button || manualTimerRunning) return;
    byId('manualMinutesMode').checked = button.dataset.minutes === 'true';
    byId('manualMinutesMode').dispatchEvent(new Event('change', { bubbles: true }));
    persistDraft();
  });
  function showUnits() {
    byId('manualUnitChoices')
      .querySelectorAll('button')
      .forEach((button) => {
        button.classList.toggle(
          'active',
          (button.dataset.minutes === 'true') === byId('manualMinutesMode').checked,
        );
        button.disabled = manualTimerRunning;
      });
  }
  toggle.addEventListener('change', showUnits);
  byId('manualMinutesMode').addEventListener('change', showUnits);
  byId('timerBtn').addEventListener('click', showUnits);
  byId('resetBtn').addEventListener('click', showUnits);
  showUnits();
  byId('clear').addEventListener('click', () => {
    volume.value = '';
    byId('manualInterval').dataset.datesEdited = 'false';
    const currentToday = calendarDays().today;
    byId('manualStartDate').value = currentToday;
    byId('manualEndDate').value = currentToday;
    syncStartDayChoices();
    byId('manualLapList').replaceChildren();
    byId('manualLaps').hidden = true;
    lapNumber = 0;
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

function updateManualMini() {
  let mini = document.getElementById('manualMini');
  if (!mini) {
    mini = document.createElement('button');
    mini.id = 'manualMini';
    mini.className = 'manual-mini';
    mini.onclick = () => go('manual');
    document.body.appendChild(mini);
  }
  mini.hidden = !manualTimerRunning || state.route === 'manual' || !hasPrivacySeen();
  const seconds = Math.floor(manualElapsed() / 1000);
  mini.textContent = `Замер ${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} ›`;
}
setInterval(() => {
  updateManualMini();
  if (manualTimerRunning) persistManualTimer();
}, 1000);
document.addEventListener('visibilitychange', () => {
  persistManualTimer();
});
