// Shared presentation components. Kept separate from application state and calculations.
function topbar(title) {
  return `<div class="topbar"><button class="back" onclick="goBack()">‹</button><h1>${esc(title)}</h1>${calculationHelpFor() ? '<button type="button" class="calculation-help-open" id="calculationHelpOpen" onclick="openCalculationHelp()" aria-label="Пояснения и формулы">?</button>' : ''}</div>`;
}
function bottomNav(active = 'home') {
  const canBack = state.route !== 'home' || state.navStack.length > 0;
  return `<nav class="bottom-nav"><button class="nav-btn back-nav" onclick="goBack()" ${canBack ? '' : 'disabled'}><span>‹</span><span>Назад</span></button><button class="nav-btn ${active === 'home' ? 'active' : ''}" onclick="go('home')"><span>⌂</span><span>Главная</span></button><button class="nav-btn ${active === 'technologist' ? 'active' : ''}" onclick="go('technologist')"><span>${iconSvg('technologist')}</span><span>Технолог</span></button><button class="nav-btn ${active === 'history' ? 'active' : ''}" onclick="go('history')"><span>◷</span><span>История</span></button><button class="nav-btn ${active === 'reference' ? 'active' : ''}" onclick="go('reference')"><span>☰</span><span>Справочник</span></button></nav>`;
}
function screen(body, active = 'home') {
  closeCalculationHelp(false);
  return `<div class="screen">${body}</div>${bottomNav(active)}`;
}
function field(id, label, opts = '') {
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" inputmode="decimal" autocomplete="off" ${opts}></div>`;
}
function selectField(id, label, options, value) {
  return `<div class="field"><label>${label}</label><select id="${id}">${options.map((o) => `<option ${String(o) === String(value) ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
}
function resultCard(title, value, error = '') {
  return `<div class="card result"><h4>${esc(title)}</h4>${value ? `<div class="value">${esc(value)}</div>` : `<div class="error">${esc(error || 'Заполните параметры')}</div>`}</div>`;
}
function assistantCard(topic, heading = '', className = '') {
  return `<div class="card warning-card ref-text ${className}">${heading ? `<h2>${esc(heading)}</h2>` : ''}${topic.steps.map((step, index) => `<p>${esc(topic.preserve ? step : `${index + 1}. ${step}`)}</p>`).join('')}</div>`;
}
