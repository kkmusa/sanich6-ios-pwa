const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function helpers() {
  const c = {
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
    render('Hур = Hсп − 10 × (Pд − Pз) / ρ'),
    /Hсп − <\/mtext><mfrac><mtext>10 × \(Pд − Pз\)<\/mtext><mtext>ρ<\/mtext>/,
  );
  assert.match(render('f = 50 × √((40 × 9,81 + Hур) / Hэцн)'), /<msqrt><mfrac>/);
});
test('Android help has complete formulas, terms and explicit route mapping without unrelated screens', () => {
  const c = helpers();
  assert.equal(Object.keys(c.helpData).length, 10);
  assert.equal(c.calculationHelpFor('upr'), c.calculationHelpFor('apv'));
  assert.equal(c.calculationHelpFor('manual').formulas[0], 'Q = Vл × 1440 / (tмин × 1000)');
  assert.equal(c.calculationHelpFor('level').terms[3], 'ρ — плотность жидкости, г/см³.');
  assert.equal(c.calculationHelpFor('ped').formulas.length, 0);
  for (const r of ['home', 'history', 'ramp', 'rich', 'assistant', 'technologist'])
    assert.equal(c.calculationHelpFor(r), null);
  for (const d of Object.values(c.helpData))
    for (const f of d.formulas) assert.match(c.calculationFormula(f), /<math[^>]+aria-label=/);
});
