const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const math = require('../js/math.js');

function close(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test('inflow material balance: accumulation, tubing drainage and recovery after drainage use distinct volumes', () => {
  // VNR p.53. In one hour the annular reserve rises by 1.36 m³.
  // While draining, 0.60 m³ came from the tubing; after drainage the
  // additional 0.30 m³ fills the tubing along the same 100 m level rise.
  assert.equal(math.wellFlow('hermetic', 100, 0.0136, 60), 32.64);
  assert.equal(math.wellFlow('drain', 100, 0.0136, 60, 0.003, 200), 18.24);
  assert.equal(math.wellFlow('afterDrain', 100, 0.0136, 60, 0.003), 39.84);
  // The 1440 multiplier converts a one-day measurement without changing
  // the measured volume; there is no seconds/minutes or litres/m³ mixup.
  assert.equal(math.wellFlow('hermetic', 100, 0.0136, 1440), 1.36);
  assert.equal(math.wellFlow('drain', 100, 0.0136, 1440, 0.003, 200), 0.76);
  assert.equal(math.wellFlow('afterDrain', 100, 0.0136, 1440, 0.003), 1.66);
});

test('annular volume agrees with a one-metre cylinder in metres and the displaced outer tubing section', () => {
  // 146 mm casing, 7 mm wall => 132 mm inside diameter, not 146 mm.
  // The tubing displaces its OUTER 73 mm section, not its internal volume.
  const innerRadius = 0.132 / 2;
  const tubingRadius = 0.073 / 2;
  const volume = Math.PI * innerRadius ** 2 - Math.PI * tubingRadius ** 2;
  close(math.annularVolume(73, 146, 7), volume);
  close(math.casingInnerDiameter(146, 7), 132);
  close(
    math.annularVolume(60, 146, 7) - math.annularVolume(73, 146, 7),
    Math.PI * ((0.073 / 2) ** 2 - (0.060 / 2) ** 2),
  );
  assert.equal(math.wellFlow('hermetic', 100, volume, 60), 22.8);
  assert.equal(math.wellFlow('drain', 100, volume, 60, 0.003, 200), 8.4);
  assert.equal(math.wellFlow('afterDrain', 100, volume, 60, 0.003), 30);
  for (const args of [[73, 146, 73], [132, 146, 7], [133, 146, 7], [73, 146, 0]])
    assert.equal(math.annularVolume(...args), null);
});

test('sensor-derived inflow uses the pressure difference with density in g/cm³ as required by the preserved formula', () => {
  // rho = 1 g/cm³, pressure changes by 5 at => a 50 m level difference.
  // Both absolute depth and the unchanged annulus pressure cancel out.
  assert.equal(math.sensorHermetic(1000, 20, 25, 5, 1, '168', '73', 0.0136, 60), 16.32);
  assert.equal(math.sensorHermetic(1500, 20, 25, 10, 1, '168', '73', 0.0136, 60), 16.32);
  assert.equal(math.sensorHermetic(1000, 25, 20, 5, 1, '168', '73', 0.0136, 60), 16.32);
  assert.equal(math.sensorHermetic(1000, 20, 20, 5, 1, '168', '73', 0.0136, 60), 0);
  assert.equal(math.sensorHermetic(1000, 20, 25, 5, 0, '168', '73', 0.0136, 60), null);
  assert.equal(math.sensorHermetic(1000, 20, 25, 5, 1, '', '73', 0.0136, 60), null);
});

test('inflow rejects missing values and zero time while retaining true zero measurements and signed source arithmetic', () => {
  assert.equal(math.wellFlow('hermetic', 0, 0.0136, 60), 0);
  assert.equal(math.wellFlow('afterDrain', 0, 0.0136, 60, 0.003), 0);
  assert.equal(math.wellFlow('hermetic', 100, 0, 60), 0);
  assert.equal(math.wellFlow('drain', 100, 0.0136, 60, 0.003, 0), 32.64);
  for (const args of [
    ['hermetic', null, 0.0136, 60], ['hermetic', 100, null, 60],
    ['hermetic', 100, 0.0136, null], ['hermetic', 100, 0.0136, 0],
    ['hermetic', 100, 0.0136, -1], ['hermetic', -1, 0.0136, 60],
    ['drain', 100, 0.0136, 60, 0.003, null],
    ['drain', 100, 0.0136, 60, 0.003, -1],
  ]) assert.equal(math.wellFlow(...args), null);
  // Keep the source formula signed. The UI must explain an inconsistent
  // negative outcome rather than silently clipping it to zero or abs(value).
  assert.equal(math.wellFlow('drain', 10, 0.0136, 60, 0.003, 100), -3.94);
  assert.equal(math.wellFlow('hermetic', 0.125, 1, 1440), 0.12);
  assert.equal(math.wellFlow('hermetic', 0.135, 1, 1440), 0.14);
  assert.equal(math.wellFlow('drain', 0, 1, 1440, 1, 0.125), -0.12);
  assert.equal(math.wellFlow('drain', 0, 1, 1440, 1, 0.135), -0.14);
});

test('eleven source capacities remain unchanged and the impossible 139.7/73 value is disabled', () => {
  const context = {};
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../js/calculators.js'), 'utf8') +
      '\nglobalThis.tables = { vkpTable, vnkt };',
    context,
  );
  // VNR p.45, table 13 (caption in supplied scan: 113). The 139.7/73
  // entry is deliberately disabled for calculations; actual geometry is required.
  assert.deepEqual(JSON.parse(JSON.stringify(context.tables)), {
    vkpTable: {
      '139.7-60': 0.0091, '139.7-73': null, '139.7-89': 0.0058,
      '146-60': 0.01, '146-73': 0.0087, '146-89': 0.0067,
      '168-60': 0.015, '168-73': 0.0136, '168-89': 0.0114,
      '178-60': 0.0168, '178-73': 0.0155, '178-89': 0.0134,
    },
    vnkt: { 60: 0.002, 73: 0.003, 89: 0.0045 },
  });
});
