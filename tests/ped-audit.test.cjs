// Regression audit against Android PedDao and PedUiState.calculatedFlow.
// VNR §6.2.1, p.52: Qcorrected = Qnominal × Iworking² / Inominal².
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const math = require('../js/math.js');
const database = require('../assets/PedCoolingDatabase.json');

function pedUi(selection = {}) {
  const elements = new Map();
  let recalculate;
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', value: '' });
    return elements.get(id);
  };
  const context = {
    state: { pedSel: selection },
    DngMath: math,
    document: { getElementById: element, querySelectorAll: () => [] },
    esc: (v) => String(v).replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]),
    fmt: (v) => Number.isFinite(v) ? String(v) : '—',
    num: (v) => String(v).trim() && Number.isFinite(Number(v)) ? Number(v) : null,
    field: (id) => `<input id="${id}">`,
    bind: (_ids, callback) => { recalculate = callback; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/ped.js'), 'utf8'), context);
  return { context, element, recalculate: () => recalculate() };
}

function optionValues(html, id) {
  const select = html.match(new RegExp(`<select id="${id}">([\\s\\S]*?)</select>`));
  assert.ok(select, id);
  return [...select[1].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
}

test('PED source records distinguish valid cooling paths from incompatible geometry', () => {
  // Appendix 19 model speeds expanded over the supported construction choices; incompatible rows have null, never a negative flow.
  assert.equal(database.length, 23693);
  const usable = database.filter((p) => p.flow > 0);
  const excluded = database.filter((p) => p.flow === null);
  assert.equal(usable.length, 18869);
  assert.equal(excluded.length, 4824);
  assert.ok(database.every((p) => ['diameter', 'speed', 'casing', 'wall']
    .every((key) => Number.isFinite(p[key]))));
  assert.ok(usable.every((p) => p.casing - 2 * p.wall > p.diameter));
  assert.ok(excluded.every((p) => p.casing - 2 * p.wall <= p.diameter));
});

test('PED wall choices omit all incompatible 117 mm motors in a 114 mm casing', () => {
  const ui = pedUi({ diameter: 117, power: 12, casing: 114 });
  ui.context.renderPedBody(database);
  assert.doesNotMatch(ui.element('pedBody').innerHTML, /id="pedWall"/);
  assert.match(ui.element('pedBody').innerHTML, /подходящие варианты не найдены/);
  ui.context.state.pedSel.casing = 140;
  ui.context.renderPedBody(database);
  assert.deepEqual(optionValues(ui.element('pedBody').innerHTML, 'pedWall'), ['6.2', '7', '7.7', '9.2', '10.5']);
});

test('PED results exclude source rows rejected by Android flow > 0', () => {
  const ui = pedUi({ diameter: 117, power: 12, casing: 114, wall: 5.2 });
  ui.context.renderPedBody(database);
  assert.doesNotMatch(ui.element('pedBody').innerHTML, /data-ped="|Номинальный приток:/);
});

test('valid PED choices preserve Android descending nominal-flow order and exact values', () => {
  const ui = pedUi({ diameter: 117, power: 12, casing: 140, wall: 6.2 });
  ui.context.renderPedBody(database);
  const flows = [...ui.element('pedBody').innerHTML.matchAll(/Номинальный приток: <b>([^<]+) м³\/сут/g)]
    .map((m) => Number(m[1]));
  assert.deepEqual(flows, [14.075243888005092, 8.797027430003183, 8.797027430003183, 8.797027430003183]);
});

test('PED current correction preserves the square, units and Android boundary behavior', () => {
  for (const [working, expected] of [[0, 0], [50, 25], [81, 65.61], [100, 100], [120, 144]])
    assert.ok(Math.abs(math.pedCooling(100, working, 100) - expected) < 1e-10);
  assert.ok(Math.abs(math.pedCooling(11.584067904, 81, 100) - 7.6003069518144) < 1e-12);
  for (const values of [[100, -1, 100], [100, 10, 0], [-1, 10, 100],
    [NaN, 10, 100], [100, Infinity, 100], [100, 1e308, 1e-308]])
    assert.equal(math.pedCooling(...values), null);
});

test('PED form shows an error rather than a valid-looking flow when correction overflows', () => {
  const ui = pedUi();
  ui.context.renderPedDetails(database.find(p => p.flow > 0));
  ui.element('pedWork').value = '1e308';
  ui.element('pedNom').value = '1e-308';
  ui.recalculate();
  const result = ui.element('pedCalc').innerHTML;
  assert.match(result, /class="error"/);
  assert.doesNotMatch(result, /class="value"/);
  assert.equal(ui.context.state.last, undefined);
});
