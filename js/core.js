const APP_VERSION = '3.0.15';
const APP_EDITION = document.documentElement.dataset.edition || 'author';
const APP_NAME = document.title || 'Оператор ДНГ';
const app = document.getElementById('app');
const state = {
  route: 'splash',
  navStack: [],
  historyDraftId: null,
  historyDraftRoute: null,
  _last: null,
};
const num = (v) => {
  const text = String(v ?? '')
    .trim()
    .replace(',', '.');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const x = Number(text);
  return Number.isFinite(x) ? x : null;
};
const fmt = (v, d = 2) => {
  if (!Number.isFinite(v)) return '—';
  const text = v.toFixed(d);
  if (Number(text) === 0) return '0';
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
};
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m],
  );
const historyKey = 'operator_dng_history_v1';
function storageNotice(message) {
  let notice = document.getElementById('storageNotice');
  if (!notice) {
    notice = document.createElement('p');
    notice.id = 'storageNotice';
    notice.className = 'storage-notice';
    notice.setAttribute('role', 'status');
    document.body.appendChild(notice);
  }
  notice.textContent = message;
}
function calculationHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey) || '[]');
    return Array.isArray(saved)
      ? saved.filter(
          (x) =>
            x &&
            typeof x === 'object' &&
            typeof x.title === 'string' &&
            typeof x.result === 'string',
        )
      : [];
  } catch {
    return [];
  }
}
function writeHistory(list) {
  try {
    localStorage.setItem(historyKey, JSON.stringify(list));
    return true;
  } catch {
    storageNotice('Не удалось сохранить историю: хранилище браузера недоступно или заполнено.');
    return false;
  }
}
function saveHistory(entry) {
  const list = calculationHistory(),
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  list.unshift({ ...entry, id, ts: Date.now() });
  return writeHistory(list) ? id : null;
}
function updateHistory(id, entry) {
  const list = calculationHistory();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return false;
  list[i] = { ...list[i], ...entry, ts: Date.now() };
  return writeHistory(list);
}
function recordCalculation(entry) {
  state._last = entry;
  if (!entry) return;
  if (state.historyDraftRoute !== state.route) {
    state.historyDraftId = null;
    state.historyDraftRoute = state.route;
  }
  if (state.historyDraftId && updateHistory(state.historyDraftId, entry)) return;
  state.historyDraftId = saveHistory(entry);
  state.historyDraftRoute = state.route;
}
Object.defineProperty(state, 'last', {
  get() {
    return state._last;
  },
  set(v) {
    recordCalculation(v);
  },
});
function resetHistoryDraft() {
  state.historyDraftId = null;
  state.historyDraftRoute = null;
  state._last = null;
}
function deleteHistory(id) {
  const list = calculationHistory();
  return writeHistory(list.filter((entry) => entry.id !== id));
}
function clearHistory() {
  try {
    localStorage.removeItem(historyKey);
    resetHistoryDraft();
  } catch {
    storageNotice('Не удалось очистить историю: хранилище браузера недоступно.');
  }
}
// Route-scoped drafts survive reloads within the same browser session.
// Never persist password/file inputs, and avoid storing calculation history twice.
const DRAFTS_KEY = 'operator_dng_route_drafts_v2';
const routeDrafts = new Map();
try {
  const saved = JSON.parse(sessionStorage.getItem(DRAFTS_KEY) || '{}');
  for (const [route, fields] of Object.entries(saved)) {
    if (route === 'ped') continue;
    if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
      // web.20/21 stored these fields in seconds; migrate explicitly to minutes.
      if (['upr', 'apv'].includes(route))
        for (const [oldId, newId] of [
          ['startupSeconds', 'startupMinutes'],
          ['drainSeconds', 'drainMinutes'],
        ]) {
          const old = fields[oldId];
          if (
            old &&
            typeof old.value === 'string' &&
            old.value.trim() !== '' &&
            Number.isFinite(Number(old.value.replace(',', '.')))
          )
            fields[newId] = { value: String(Number(old.value.replace(',', '.')) / 60) };
          delete fields[oldId];
        }
      if (route === 'level' && fields.densityUnit) {
        if (fields.densityUnit.value === 'kg' && fields.density?.value) {
          const density = Number(fields.density.value.replace(',', '.'));
          if (Number.isFinite(density)) fields.density.value = String(density / 1000);
        }
        delete fields.densityUnit;
      }
      routeDrafts.set(route, fields);
    }
  }
} catch {
  /* storage may be disabled in private browsing */
}
try {
  if (!routeDrafts.has('manual')) {
    const savedManual = JSON.parse(localStorage.getItem('sanich_manual_form_v3') || 'null');
    if (savedManual && typeof savedManual === 'object') routeDrafts.set('manual', savedManual);
  }
} catch {}
function persistDrafts() {
  try {
    if (routeDrafts.has('manual'))
      localStorage.setItem('sanich_manual_form_v3', JSON.stringify(routeDrafts.get('manual')));
  } catch {}
  try {
    sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(Object.fromEntries(routeDrafts)));
  } catch {}
}
function snapshotRoute() {
  if (!state.route || !app || state.route === 'ped') return;
  const fields = {};
  app.querySelectorAll('input[id],select[id],textarea[id]').forEach((el) => {
    if (['password', 'file', 'hidden'].includes(el.type)) return;
    fields[el.id] =
      el.type === 'checkbox' || el.type === 'radio' ? { checked: el.checked } : { value: el.value };
  });
  const choices = {};
  for (const attribute of ['data-v', 'data-t', 'data-mode', 'data-mat', 'data-motor']) {
    const selected = app.querySelector(`[${attribute}].active`);
    if (selected) choices[attribute] = selected.getAttribute(attribute);
  }
  if (Object.keys(choices).length) fields._choices = choices;
  if (state.route === 'manual') {
    fields._manual = {
      wheels: Object.fromEntries(
        [...app.querySelectorAll('.time-wheel')].map((el) => [
          el.id,
          Number(el.querySelector('[aria-selected="true"]')?.dataset.value || 0),
        ]),
      ),
      startDay: Number(app.querySelector('[data-day].active')?.dataset.day ?? 1),
      datesEdited: app.querySelector('#manualInterval')?.dataset.datesEdited === 'true',
    };
  }
  if (Object.keys(fields).length) {
    routeDrafts.set(state.route, fields);
    persistDrafts();
  }
}
function restoreRoute() {
  const fields = routeDrafts.get(state.route);
  if (!fields || state.route === 'operators' || state.route === 'ped') return;
  for (const [attribute, value] of Object.entries(fields._choices || {})) {
    if (!['data-v', 'data-t', 'data-mode', 'data-mat', 'data-motor'].includes(attribute)) continue;
    const choice = [...app.querySelectorAll(`[${attribute}]`)].find(
      (el) => el.getAttribute(attribute) === value,
    );
    if (choice && !choice.classList.contains('active')) choice.click();
  }
  // Restore selects in DOM order so each dependent selector exists before its value is assigned.
  for (const [id, saved] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el?.tagName === 'SELECT' && saved && 'value' in saved && el.value !== String(saved.value)) {
      el.value = String(saved.value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  let firstChanged = null;
  const changedModes = [];
  Object.entries(fields).forEach(([id, saved]) => {
    const el = document.getElementById(id);
    if (!el || !saved || typeof saved !== 'object') return;
    if ('checked' in saved) {
      if (el.checked !== !!saved.checked) {
        firstChanged ??= el;
        changedModes.push(el);
      }
      el.checked = !!saved.checked;
    } else if ('value' in saved) {
      if (el.value !== String(saved.value)) firstChanged ??= el;
      el.value = String(saved.value);
    }
  });
  // Recompute results after restoring drafts, without rerendering the whole screen.
  changedModes.forEach((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
  if (firstChanged && !changedModes.includes(firstChanged))
    firstChanged.dispatchEvent(
      new Event(
        firstChanged.type === 'checkbox' || firstChanged.type === 'radio' ? 'change' : 'input',
        { bubbles: true },
      ),
    );
}
// Capture changes without rerendering screens or disturbing the caret / keyboard.
// A calculation may update its result independently of this persistence layer.
document.addEventListener(
  'input',
  (e) => {
    if (e.target?.matches?.('input[id],textarea[id]')) snapshotRoute();
  },
  true,
);
document.addEventListener(
  'change',
  (e) => {
    if (e.target?.matches?.('input[id],select[id],textarea[id]')) snapshotRoute();
  },
  true,
);
window.addEventListener('pagehide', snapshotRoute);
// Keep live DOM nodes and event handlers for calculator screens instead of
// rebuilding them on every navigation. Dynamic lists and timer screens are
// deliberately excluded because they need a fresh render or active cleanup.
const CACHED_CALCULATOR_ROUTES = new Set([
  'level',
  'frequency',
  'headAtFrequency',
  'flow',
  'upr',
  'apv',
  'sko',
  'tap',
  'motorCoefficient',
  'temperatureSetpoint',
  'wellPotential',
  'rpd',
]);
const screenCache = new Map();
// Remember scroll positions per route while moving through the application.
// A new forward visit starts at the top; Back restores the previous position.
const routeScroll = new Map();
function saveRouteScroll() {
  if (state.route) routeScroll.set(state.route, window.scrollY || 0);
}
function restoreRouteScroll(route) {
  const position = route === 'assistant' ? 0 : routeScroll.get(route) || 0;
  requestAnimationFrame(() => window.scrollTo(0, position));
}

function parkCurrentScreen() {
  const route = state.route;
  if (!CACHED_CALCULATOR_ROUTES.has(route) || !app?.firstChild) return;
  const fragment = document.createDocumentFragment();
  while (app.firstChild) fragment.appendChild(app.firstChild);
  screenCache.delete(route);
  screenCache.set(route, fragment);
}
function showCachedScreen(route) {
  const fragment = screenCache.get(route);
  if (!fragment) return false;
  screenCache.delete(route);
  app.replaceChildren(fragment);
  return true;
}
function clearScreenCache() {
  screenCache.clear();
}
function go(route) {
  if (APP_EDITION === 'bez' && route === 'assistant') route = 'reference';
  if (route === state.route) return;
  if (state.route) state.navStack.push(state.route);
  snapshotRoute();
  saveRouteScroll();
  parkCurrentScreen();
  resetHistoryDraft();
  state.route = route;
  routeScroll.set(route, 0);
  window.history.pushState(
    {
      sanich: true,
      route,
      stack: [...state.navStack],
      index: (window.history.state?.index || 0) + 1,
    },
    '',
  );
  render();
  scrollTo(0, 0);
}
function goBack() {
  if (['operators', 'ramp', 'rich'].includes(state.route) && operatorViewing) {
    operatorViewing = false;
    operatorStep = 0;
    renderOperator();
    return;
  }
  if (
    state.route === 'assistant' &&
    state.assistantIndex !== undefined &&
    state.assistantIndex !== null
  ) {
    state.assistantIndex = null;
    renderAssistant();
    scrollTo(0, 0);
    return;
  }
  if (window.history.state?.sanich && window.history.state.index > 0) {
    window.history.back();
    return;
  }
  snapshotRoute();
  saveRouteScroll();
  parkCurrentScreen();
  const prev = state.navStack.pop();
  if (prev) {
    resetHistoryDraft();
    state.route = prev;
    render();
    restoreRouteScroll(prev);
    return;
  }
  if (state.route !== 'home') {
    resetHistoryDraft();
    state.route = 'home';
    render();
    restoreRouteScroll('home');
  }
}
function bind(ids, fn) {
  ids.forEach((id) => document.getElementById(id)?.addEventListener('input', fn));
  ids.forEach((id) => document.getElementById(id)?.addEventListener('change', fn));
}
function setResult(title, value, error) {
  const el = document.getElementById('liveResult');
  if (el) el.outerHTML = `<div id="liveResult">${resultCard(title, value, error)}</div>`;
}
function iconSvg(type) {
  const common = 'class="menu-svg" viewBox="0 0 48 48" aria-hidden="true"';
  const paths = {
    technologist:
      'M6.36,18.78L6.61,21l1.62-1.54l2.77-7.6c-0.68-0.17-1.28-0.51-1.77-0.98L6.36,18.78z M14.77,10.88c-0.49,0.47-1.1,0.81-1.77,0.98l2.77,7.6L17.39,21l0.26-2.22L14.77,10.88z M15,8c0-1.3-0.84-2.4-2-2.82V3h-2v2.18C9.84,5.6,9,6.7,9,8c0,1.66,1.34,3,3,3S15,9.66,15,8z M12,9c-0.55,0-1-0.45-1-1 c0-0.55,0.45-1,1-1s1,0.45,1,1C13,8.55,12.55,9,12,9z',
    level: 'M7 2H10V22H7Z M10 4H17V6H10Z M10 9H15V11H10Z M10 14H17V16H10Z M10 19H15V21H10Z',
    ramp: 'M3 17L9 11L13 15L21 7V12H23V3H14V5H19L13 11L9 7L1 15Z',
    frequency:
      'M20.38 8.57 21.83 6.39 20.17 5.28 18.72 7.46A10 10 0 0 0 2.02 18H21.98A10 10 0 0 0 20.38 8.57ZM12 16A2 2 0 1 1 12 12L18 7 14 14A2 2 0 0 1 12 16Z',
    '⚡': 'M11 21H9L10 14H5L13 3H15L14 10H19Z',
    '↻': 'M12 6V3L8 7L12 11V8A4 4 0 0 1 16 12C16 12.6 15.9 13.2 15.6 13.7L17.1 15.2A6 6 0 0 0 12 6ZM6.9 8.8A6 6 0 0 0 12 18V21L16 17L12 13V16A4 4 0 0 1 8 12C8 11.4 8.1 10.8 8.4 10.3Z',
    sko: 'M6 22A2 2 0 0 1 4.3 19L9 11V4H8V2H16V4H15V11L19.7 19A2 2 0 0 1 18 22ZM8 16H16L13 11V4H11V11Z',
    '🌡': 'M15 13.76V5A3 3 0 0 0 9 5V13.76A5 5 0 1 0 15 13.76ZM11 5A1 1 0 0 1 13 5V15L14 15.7A3 3 0 1 1 10 15.7L11 15Z',
    '⚙': 'M19.43 12.98A7.4 7.4 0 0 0 19.43 11.02L21.54 9.37L19.54 5.91L17.05 6.91A8 8 0 0 0 15.36 5.93L15 3H9L8.64 5.93A8 8 0 0 0 6.95 6.91L4.46 5.91L2.46 9.37L4.57 11.02A7.4 7.4 0 0 0 4.57 12.98L2.46 14.63L4.46 18.09L6.95 17.09A8 8 0 0 0 8.64 18.07L9 21H15L15.36 18.07A8 8 0 0 0 17.05 17.09L19.54 18.09L21.54 14.63ZM12 15.5A3.5 3.5 0 1 1 12 8.5A3.5 3.5 0 0 1 12 15.5Z',
  };
  if (paths[type])
    return `<svg class="menu-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="${type === 'technologist' ? 'currentColor' : '#f28c00'}" fill-rule="evenodd" d="${paths[type]}"/></svg>`;
  if (type === 'FF')
    return `<svg ${common}><text x="7" y="34" font-size="32" font-weight="600" fill="#f28c00">F</text><text x="27" y="34" font-size="19.5" font-weight="600" fill="#f28c00">F</text></svg>`;
  if (type === 'headAtFrequency')
    return `<svg class="menu-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17M7 17Q14 16 20 5M16 5h4v4" fill="none" stroke="#f28c00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (['2А', 'Q'].includes(type))
    return `<svg ${common}><text x="24" y="33" text-anchor="middle" font-size="28" font-weight="800" fill="#f28c00">${type}</text></svg>`;
  if (type === 'pedCooling') return '<img class="menu-img" src="assets/ic_ped_cooling.png" alt="">';
  if (type === 'manual') return `<img class="menu-img" src="assets/ic_manual_debit.png" alt="">`;
  if (type === 'flow') return `<img class="menu-img" src="assets/ic_well_inflow.png" alt="">`;
  if (type === 'zsp')
    return `<svg ${common}><rect x="5" y="9" width="38" height="30" rx="9" fill="#fff3cd" stroke="#f28c00" stroke-width="2"/><text x="24" y="30" text-anchor="middle" font-size="17" font-weight="900" fill="#171717">ЗСП</text></svg>`;
  if (type === 'pipeLarge')
    return `<svg ${common}><ellipse cx="24" cy="12" rx="15" ry="7" fill="#d9dde1" stroke="#59636d" stroke-width="2.4"/><path d="M9 12v24c0 4 30 4 30 0V12" fill="#c4cad0" stroke="#59636d" stroke-width="2.4"/><ellipse cx="24" cy="12" rx="8" ry="3.5" fill="#f6f6f6" stroke="#59636d" stroke-width="2"/></svg>`;
  if (type === 'pipeSmall')
    return `<svg ${common}><ellipse cx="24" cy="14" rx="11" ry="5" fill="#d9dde1" stroke="#59636d" stroke-width="2.3"/><path d="M13 14v22c0 3 22 3 22 0V14" fill="#c4cad0" stroke="#59636d" stroke-width="2.3"/><ellipse cx="24" cy="14" rx="5.5" ry="2.4" fill="#f6f6f6" stroke="#59636d" stroke-width="1.8"/></svg>`;
  return type;
}
function menuCard(icon, title, subtitle, route) {
  return `<div class="card menu-card pressable" role="button" tabindex="0" onclick="go('${route}')"><div class="emoji">${iconSvg(icon)}</div><div class="grow"><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><div class="chev">›</div></div>`;
}

// Choice buttons need persistence after their screen-specific click handlers run.
document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-v],[data-t],[data-mode],[data-mat],[data-motor]'))
    snapshotRoute();
});

document.addEventListener('keydown', (event) => {
  const button = event.target.closest?.('[role="button"]');
  if (button && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    button.click();
  }
});

window.addEventListener('popstate', (event) => {
  const target = event.state;
  if (!target?.sanich || typeof target.route !== 'string') return;
  snapshotRoute();
  saveRouteScroll();
  parkCurrentScreen();
  resetHistoryDraft();
  state.route = target.route;
  state.navStack = Array.isArray(target.stack) ? [...target.stack] : [];
  render();
  restoreRouteScroll(state.route);
});
