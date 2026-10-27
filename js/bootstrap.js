let privacySeen = false;
function hasPrivacySeen() {
  try {
    return privacySeen || !!localStorage.getItem('privacy_seen');
  } catch {
    return privacySeen;
  }
}
function acceptPrivacy() {
  privacySeen = true;
  try {
    localStorage.setItem('privacy_seen', '1');
  } catch {
    storageNotice('Настройки не сохраняются: хранилище браузера недоступно.');
  }
}
function openHomeFromStart() {
  state.route = 'home';
  state.navStack = [];
  window.history.replaceState({ sanich: true, route: 'home', stack: [], index: 0 }, '');
  render();
  scrollTo(0, 0);
}
function renderNotice() {
  app.innerHTML = `<div class="notice"><div class="panel card"><img src="assets/logo.png" style="width:130px;display:block;margin:0 auto 14px"><h1>Конфиденциальность</h1><p>Приложение работает локально и не передаёт введённые данные разработчику или третьим лицам.</p><p>Перед использованием вы можете ознакомиться с Политикой конфиденциальности.</p><div class="actions"><button class="btn secondary full" id="policyFirst">Открыть политику</button><button class="btn full" id="continueFirst">Продолжить</button></div></div></div>`;
  policyFirst.onclick = () => {
    state.route = 'privacy';
    state.navStack = [];
    render();
    scrollTo(0, 0);
  };
  continueFirst.onclick = () => {
    acceptPrivacy();
    openHomeFromStart();
  };
}
function renderSplash() {
  state.route = 'splash';
  app.innerHTML = `<div class="splash"><div class="center"><img src="assets/logo.png" alt="Оператор ДНГ"><div class="tag">Инженерные расчёты</div></div><div class="meta">Автор<strong>Муса Якупов</strong>Версия ${APP_VERSION}</div></div>`;
  setTimeout(() => {
    if (hasPrivacySeen()) openHomeFromStart();
    else renderNotice();
  }, 1200);
}

function saveLastIfNeeded() {
  state._last = null;
}
window.go = go;
window.goBack = goBack;
function renderScreen() {
  switch (state.route) {
    case 'home':
      return renderHome();
    case 'technologist':
      return renderTechnologist();
    case 'rpd':
      return renderRpd();
    case 'motorCoefficient':
      return renderMotorCoefficient();
    case 'temperatureSetpoint':
      return renderTemperatureSetpoint();
    case 'wellPotential':
      return renderWellPotential();
    case 'level':
      return renderLevel();
    case 'headAtFrequency':
      return renderHeadAtFrequency();
    case 'frequency':
      return renderFrequency();
    case 'flow':
      return renderFlow();
    case 'manual':
      return renderManual();
    case 'upr':
      return renderOperating('upr');
    case 'apv':
      return renderOperating('apv');
    case 'sko':
      return renderSko();
    case 'tap':
      return renderTap();
    case 'history':
      return renderHistory();
    case 'reference':
      return renderReference();
    case 'vnr':
      return renderVnr();
    case 'refinfo':
      return renderRefInfo();
    case 'ped':
      return renderPed();
    case 'assistant':
      return renderAssistant();
    case 'ramp':
    case 'rich':
      operatorMode = state.route;
      operatorViewing = false;
      return renderOperator();
    case 'operators':
      return renderOperator();
    case 'casingReference':
      state.pipeType = 'casing';
      return renderPipes();
    case 'tubingReference':
      state.pipeType = 'tubing';
      return renderPipes();
    case 'pipes':
      return renderPipes();
    case 'skoref':
      return renderSkoReference();
    case 'about':
      return renderAbout();
    case 'privacy':
      return renderPrivacy();
    default:
      return renderHome();
  }
}

function render() {
  stopManualTimer();
  // Entry navigation clears completed calculation forms. A same-route render
  // may still reuse its live DOM without interrupting the current process.
  if (showCachedScreen(state.route)) return;
  const result = renderScreen();
  restoreRoute();
  return result;
}

function setupPressFeedback() {
  const selector =
    '.btn,.menu-card,.nav-btn,.back,.radio-item,.chip,.assistant-topic,.ped-result,.nkt-option';
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = e.target.closest?.(selector);
      if (!el) return;
      el.classList.add('pressed');
      if (navigator.vibrate) {
        try {
          navigator.vibrate(10);
        } catch {}
      }
    },
    { passive: true },
  );
  const clear = (e) => {
    const el = e.target.closest?.(selector);
    if (el) el.classList.remove('pressed');
  };
  document.addEventListener('pointerup', clear, { passive: true });
  document.addEventListener('pointercancel', clear, { passive: true });
  document.addEventListener('pointerleave', clear, { passive: true });
}
setupPressFeedback();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => window.DngOfflineWorker.ready().catch(() => {}));
}
renderSplash();
