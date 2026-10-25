// Help presentation only. Numeric calculations stay in math.js.
function calculationHelpFor(route = state.route) {
  return CALCULATION_HELP[route === 'upr' || route === 'apv' ? 'operating' : route] || null;
}
function helpMathText(value) {
  return `<mtext>${esc(value)}</mtext>`;
}
function helpFraction(numerator, denominator) {
  return `<mfrac>${helpMathText(numerator)}${helpMathText(denominator)}</mfrac>`;
}
function helpStripOuter(value) {
  const text = value.trim();
  if (!text.startsWith('(') || !text.endsWith(')')) return text;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (depth === 0 && i < text.length - 1) return text;
  }
  return depth === 0 ? text.slice(1, -1) : text;
}
function calculationFormula(formula) {
  const index = formula.indexOf(' = ');
  const left = index < 0 ? '' : formula.slice(0, index + 3);
  const expression = index < 0 ? formula : formula.slice(index + 3);
  let body;
  // Explicit groupings preserve products outside a quotient, especially tap calculations.
  if (left === 'H = ' && expression === 'H₅₀ × (f / 50)²') {
    body =
      helpMathText('H₅₀ × ') +
      `<msup><mrow><mo>(</mo>${helpFraction('f', '50')}<mo>)</mo></mrow><mn>2</mn></msup>`;
  } else if (left === 'H = ' && expression === 'Hсп − 10 × (Pд − Pз) / ρ') {
    body = helpMathText('Hсп − ') + helpFraction('10 × (Pд − Pз)', 'ρ');
  } else if (left === 'f = ') {
    body = helpMathText('50 × ') + `<msqrt>${helpFraction('40 × 9,81 + H', 'Hэцн')}</msqrt>`;
  } else if (left === 'ΔUкаб = ') {
    body =
      helpMathText('√3 × Iпэд × cosφ × ') + helpFraction('L', 'S') + helpMathText(' × ρкаб × Kₜ');
  } else if (left === 'Без ЧРП: Uбаза = ') {
    body = helpFraction('Uвх.ТМПН', 'Uсети') + helpMathText(' × Uпэд');
  } else if (left === 'С ЧРП: Uбаза = ') {
    body =
      helpFraction('Uвх.ТМПН', 'Umax.ЧРП') +
      helpMathText(' × ') +
      helpFraction('fmax', 'fном') +
      helpMathText(' × Uпэд × Kф');
  } else if (expression.includes('/')) {
    const slash = expression.indexOf('/');
    body = helpFraction(
      helpStripOuter(expression.slice(0, slash)),
      helpStripOuter(expression.slice(slash + 1)),
    );
  } else {
    body = helpMathText(expression);
  }
  const contextEnd = left.indexOf(': ');
  const context = contextEnd < 0 ? '' : left.slice(0, contextEnd + 1);
  const mathLeft = contextEnd < 0 ? left : left.slice(contextEnd + 2);
  return `<div class="help-formula-wrap">${context ? `<div class="help-formula-context">${esc(context)}</div>` : ''}<div class="help-formula"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${esc(formula)}"><mrow>${helpMathText(mathLeft)}${body}</mrow></math></div><div class="help-scroll-note" hidden>↔ Сдвиньте формулу вбок</div></div>`;
}
function closeCalculationHelp(restoreFocus = true) {
  const dialog = document.getElementById('calculationHelpDialog');
  if (!dialog) return;
  dialog.remove();
  if (restoreFocus) document.getElementById('calculationHelpOpen')?.focus({ preventScroll: true });
}
function openCalculationHelp() {
  const help = calculationHelpFor();
  if (!help || document.getElementById('calculationHelpDialog')) return;
  const list = (values) => `<ul>${values.map((value) => `<li>${esc(value)}</li>`).join('')}</ul>`;
  const dialog = document.createElement('dialog');
  dialog.id = 'calculationHelpDialog';
  dialog.className = 'calculation-help';
  dialog.setAttribute('aria-labelledby', 'calculationHelpTitle');
  dialog.innerHTML = `<header class="help-header"><h2 id="calculationHelpTitle">Как выполняется расчёт</h2><button type="button" class="help-close" aria-label="Закрыть пояснения">×</button></header><div class="help-body">${help.intro ? `<p>${esc(help.intro)}</p>` : ''}${help.formulas.length ? `<h3>Формулы</h3>${help.formulas.map(calculationFormula).join('')}` : ''}${help.terms.length ? `<h3>Обозначения</h3>${list(help.terms)}` : ''}${help.notes.length ? `<h3>Важно</h3>${list(help.notes)}` : ''}</div><footer class="help-footer"><button type="button" class="btn full" id="calculationHelpDone">Понятно</button></footer>`;
  document.body.append(dialog);
  dialog.querySelector('.help-close').onclick = () => closeCalculationHelp();
  dialog.querySelector('#calculationHelpDone').onclick = () => closeCalculationHelp();
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeCalculationHelp();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      closeCalculationHelp();
  });
  dialog.showModal();
  dialog.querySelectorAll('.help-formula').forEach((element) => {
    element.nextElementSibling.hidden = element.scrollWidth <= element.clientWidth;
  });
}
