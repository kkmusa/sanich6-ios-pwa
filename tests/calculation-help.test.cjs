const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function helpers(edition = 'author') {
  const c = {
    APP_EDITION: edition,
    state: { route: 'home' },
    esc: (v) =>
      String(v)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;'),
  };
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, '../js/calculation-help-data.js'), 'utf8') +
      '\n' +
      fs.readFileSync(path.resolve(__dirname, '../js/rpd-help-data.js'), 'utf8') +
      '\n' +
      fs.readFileSync(path.resolve(__dirname, '../js/calculation-help.js'), 'utf8') +
      '\nglobalThis.helpData=CALCULATION_HELP;',
    c,
  );
  return c;
}
test('help groups tap fractions without moving cable or motor factors into denominators', () => {
  const c = helpers();
  const render = (f) => c.calculationFormula(f);
  const cable = render('ΔUкаб = √3 × Iпэд × cosφ × (L/S) × ρкаб × Kₜ');
  assert.match(
    cable,
    /<mfrac><mtext>L<\/mtext><mtext>S<\/mtext><\/mfrac><mtext> × ρкаб × Kₜ<\/mtext>/,
  );
  const vfd = render('С ЧРП: Uбаза = (Uвх.ТМПН / Umax.ЧРП) × (fmax / fном) × Uпэд × Kф');
  assert.equal((vfd.match(/<mfrac>/g) || []).length, 2);
  assert.match(vfd, /<\/mfrac><mtext> × Uпэд × Kф<\/mtext>/);
  assert.match(
    render('H = Hсп − 10 × (Pд − Pз) / ρ'),
    /Hсп − <\/mtext><mfrac><mtext>10 × \(Pд − Pз\)<\/mtext><mtext>ρ<\/mtext>/,
  );
  assert.match(render('f = 50 × √((40 × 9,81 + H) / Hэцн)'), /<msqrt><mfrac>/);
});
test('Android help has complete formulas, terms and explicit route mapping without unrelated screens', () => {
  const c = helpers();
  assert.equal(Object.keys(c.helpData).length, 12);
  assert.equal(c.calculationHelpFor('upr'), c.calculationHelpFor('apv'));
  assert.equal(c.calculationHelpFor('manual').formulas[0], 'Q = Vл × 1440 / (tмин × 1000)');
  assert.ok(c.calculationHelpFor('level').terms.includes('ρ — плотность жидкости, г/см³.'));
  assert.equal(c.calculationHelpFor('motorCoefficient').formulas[1], 'КФ = n × p / 3000');
  assert.equal(c.calculationHelpFor('motorCoefficient').formulas[2], 'fстанции = fобычная × КФ');
  assert.equal(c.calculationHelpFor('motorCoefficient').formulas[3], 'fобычная = fстанции / КФ');
  assert.doesNotMatch(JSON.stringify(c.helpData), /[HН]ур/);
  assert.equal(c.calculationHelpFor('ped').formulas.length, 0);
  for (const r of ['home', 'history', 'ramp', 'rich', 'assistant', 'technologist'])
    assert.equal(c.calculationHelpFor(r), null);
  for (const d of Object.values(c.helpData))
    for (const f of d.formulas) assert.match(c.calculationFormula(f), /<math[^>]+aria-label=/);
});

test('head formula keeps multiplication outside the squared frequency ratio', () => {
  const c = helpers();
  const rendered = c.calculationFormula(c.calculationHelpFor('headAtFrequency').formulas[0]);
  assert.match(rendered, /<mtext>H₅₀ × <\/mtext><msup>/);
  assert.match(rendered, /<mfrac><mtext>f<\/mtext><mtext>50<\/mtext><\/mfrac>/);
  assert.match(rendered, /<mn>2<\/mn><\/msup>/);
});

test('expanded RPD explanation is selected only in the regulation edition', () => {
  for (const edition of ['author', 'bez']) {
    const c = helpers(edition);
    assert.equal(c.calculationHelpFor('rpd').steps, undefined);
    assert.equal(c.calculationHelpFor('rpd').formulas.length, 7);
  }
  const c = helpers('reglament');
  const help = c.calculationHelpFor('rpd');
  assert.equal(help.steps.length, 11);
  assert.equal(help.steps.flatMap((step) => step.formulas).length, 12);
  assert.equal(help.sections[0].title, 'Что вводим в расчёт');
  assert.equal(help.sections.some((section) => section.id === 'rpd-time-explanation'), false);
  assert.doesNotMatch(JSON.stringify(help), /Откуда брать|Если значение не задано, его нужно уточнить у специалиста/);
  assert.match(help.after.map((section) => section.paragraphs?.join(' ')).join(' '), /разгон отдельно не прибавляет/);
  assert.equal(c.calculationHelpFor('level'), c.helpData.level);
});

test('RPD step formulas render density percentages and annular area with correct denominators', () => {
  const c = helpers('reglament');
  const steps = c.calculationHelpFor('rpd').steps;
  const density = c.calculationFormula(steps[7].formulas[0]);
  assert.match(density, /<mfrac><mtext>ρн × \(100 − B\) \+ ρв × B<\/mtext><mtext>100<\/mtext><\/mfrac>/);
  const area = c.calculationFormula(steps[5].formulas[0]);
  assert.match(area, /<mfrac><mtext>π × \(D² − d²\)<\/mtext><mtext>4<\/mtext><\/mfrac>/);
  for (const step of steps) {
    assert.ok(step.paragraphs.length && step.example);
    for (const formula of step.formulas)
      assert.match(c.calculationFormula(formula), /<math[^>]+aria-label=/);
  }
});
