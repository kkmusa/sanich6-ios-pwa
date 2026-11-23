// Shared presentation components. Kept separate from application state and calculations.
function topbar(title) {
  return `<div class="topbar"><button class="back" onclick="goBack()">‹</button><h1>${esc(title)}</h1>${calculationHelpFor() ? '<button type="button" class="calculation-help-open" id="calculationHelpOpen" onclick="openCalculationHelp()" aria-label="Пояснения и формулы" title="Пояснения к расчёту">?</button>' : ''}</div>`;
}
function vnrTopbar(title) {
  return `<div class="topbar"><button class="back" onclick="goBack()">‹</button><h1>${esc(title)}</h1><button type="button" class="vnr-rotate" onclick="toggleVnrOrientation()" aria-label="Повернуть экран вручную" title="Повернуть экран">↻</button></div>`;
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
function assistantExtra(extra) {
  if (!extra?.summary || !extra.blocks?.length) return '';
  const blocks = extra.blocks
    .map(
      (block) => `<section class="assistant-extra-block"><h4>${esc(block.title)}</h4><div>${esc(block.text)}</div><div class="assistant-formula">${esc(block.formula)}</div><ul>${block.terms.map((term) => `<li>${esc(term)}</li>`).join('')}</ul></section>`,
    )
    .join('');
  return `<details class="assistant-extra"><summary>${esc(extra.summary)}</summary><div class="assistant-extra-body"><div>${esc(extra.intro)}</div>${blocks}<div class="assistant-extra-conclusion">${esc(extra.conclusion)}</div></div></details>`;
}
function assistantCard(topic, heading = '', className = '') {
  const hasCauses = !topic.preserve && /^(?:Основные\s+)?возможные причины(?:\s+[^:]*)?:/i.test(topic.steps[0] || '');
  const firstAction = hasCauses ? 1 : 0,
    actions = topic.steps
      .slice(firstAction)
      .map((step, index) => {
        const originalStep = firstAction + index + 1;
        return `<p>${esc(topic.preserve ? step : `${index + 1}. ${step}`)}</p>${topic.extra?.afterStep === originalStep ? assistantExtra(topic.extra) : ''}`;
      })
      .join('');
  let steps = actions;
  if (hasCauses) {
    const causes = topic.steps[0]
      .replace(/^(?:Основные\s+)?возможные причины(?:\s+[^:]*)?:\s*/i, '')
      .split(/;\s*/)
      .map((cause) => cause.trim())
      .filter(Boolean);
    steps = `<section class="assistant-causes"><h3>Возможные причины</h3><ul>${causes.map((cause) => `<li>${esc(cause)}</li>`).join('')}</ul></section><section class="assistant-actions"><h3>Алгоритм действий</h3>${actions}</section>`;
  }
  const table = topic.table
    ? `<div class="assistant-table-wrap"><h3>${esc(topic.table.title)}</h3><table class="assistant-table"><thead><tr>${topic.table.headers.map((value) => `<th>${esc(value)}</th>`).join('')}</tr></thead><tbody>${topic.table.rows.map((row) => `<tr>${row.map((value) => `<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>${topic.table.note ? `<div class="hint">${esc(topic.table.note)}</div>` : ''}</div>`
    : '';
  return `<div class="card warning-card ref-text ${className}">${heading ? `<h2>${esc(heading)}</h2>` : ''}${steps}${table}</div>`;
}
