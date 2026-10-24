const { test } = require('node:test');
const assert = require('node:assert/strict');
const math = require('../js/math.js');
test('liquid level: reference example and invalid density', () => {
  assert.equal(math.liquidLevel(1000, 10, 20, 1000), 900);
  assert.equal(math.liquidLevel(1000, 10, 20, 0), null);
  assert.equal(math.liquidLevel(NaN, 10, 20, 1000), null);
});
test('start frequency and invalid head', () => {
  assert.equal(math.startFrequency(607.6, 1000), 50);
  assert.equal(math.startFrequency(100, 0), null);
});
test('manual measurement: equivalent seconds and minutes', () => {
  assert.equal(math.manualDebit(100, 60), 144);
  assert.equal(math.manualDebitInterval(100, 1), 144);
  assert.equal(math.manualDebit(100, 0), null);
  assert.equal(math.manualDebitInterval(-1, 10), null);
});
test('manual interval: midnight, full day and invalid times', () => {
  assert.equal(math.intervalMinutes(0, 23, 50, 0, 10), 20);
  assert.equal(math.intervalMinutes(0, 12, 0, 12, 0), 1440);
  assert.equal(math.intervalMinutes(1, 12, 0, 12, 0), null);
  assert.equal(math.intervalMinutes(1, 23, 50, 0, 10), null);
  assert.equal(math.intervalMinutes(1, 24, 0, 12, 0), null);
  assert.equal(math.intervalMinutes(2, 12, 0, 13, 0), null);
});
test('operating cycle: productive time, startup and stop', () => {
  assert.deepEqual(math.operatingCycle(100, 50, 60, 3600), {
    productive: 1800,
    total: 1860,
    stop: 1740,
  });
  assert.equal(math.operatingCycle(0, 50, 60, 3600), null);
});
test('APV: rounds minimum cycle to full minutes', () => {
  assert.equal(math.apvMinimumCycle(100, 50, 61, 60), 300);
  assert.equal(math.apvMinimumCycle(100, 100, 60, 60), null);
});
test('Android motor coefficient: both directions, zero frequency and invalid poles', () => {
  assert.deepEqual(math.motorCoefficient(6000, 2, 50), {
    base: 100,
    coefficient: 2,
    converted: 100,
  });
  assert.deepEqual(math.motorCoefficient(6000, 2, 100, true), {
    base: 100,
    coefficient: 2,
    converted: 50,
  });
  assert.equal(math.motorCoefficient(3000, 4, 0).converted, 0);
  assert.equal(math.motorCoefficient(3000, 3, 50), null);
  assert.equal(math.motorCoefficient(0, 2, 50), null);
  assert.equal(math.motorCoefficient(6000, 2).converted, null);
});
test('Android TMS temperature: all groups, cap and invalid inputs', () => {
  assert.equal(math.temperatureSetpoint(80, 'Д1'), 84);
  assert.equal(math.temperatureSetpoint(120, 'Д1'), 102);
  assert.equal(math.temperatureSetpoint(150, 'Д2'), 127.5);
  assert.equal(math.temperatureSetpoint(170, 'Д3'), 144.5);
  assert.equal(math.temperatureSetpoint(null, 'Д1'), null);
  assert.equal(math.temperatureSetpoint(80, 'unknown'), null);
});
test('Android well potential: optional delay, zero production and invalid interval', () => {
  assert.equal(math.wellPotential(100, 60, 60), 50);
  assert.equal(math.wellPotential(100, 60, 60, 12), 40);
  assert.equal(math.wellPotential(0, 60, 0), 0);
  assert.equal(math.wellPotential(100, 60, 60, 60), null);
  assert.equal(math.wellPotential(100, 0, 60), null);
});
test('Android APV uses minutes, rounds to whole hours and checks the selected cycle', () => {
  assert.deepEqual(math.apvCycle(100, 50, 10, 60, 360), {
    productive: 180,
    total: 190,
    stop: 170,
    required: 140,
    minimum: 180,
    suitable: true,
  });
  assert.equal(math.apvCycle(100, 50, 10, 60, 120).suitable, false);
  assert.equal(math.apvMinimumCycle(100, 50, 1, 1), 60);
  assert.equal(math.operatingCycle(100, 50, 30, 60), null);
});
test('Android RPD: accumulation limit and pressure example', () => {
  const r = math.rpd(0.15, 0.073, 870, 1015, 80, 17, 57, 30, 10, 20);
  assert.equal(r.actualRun, 8.5);
  assert.equal(r.accumulation, 20);
  assert.equal(r.rho, 986);
  assert.ok(Math.abs(r.off - 28.327) < 0.01);
  assert.equal(r.start, 30);
  assert.equal(math.rpd(0.073, 0.15, 870, 1015, 80, 17, 57, 30, 10, 20), null);
  assert.equal(math.rpd(0.15, 0.073, 870, 1015, 101, 17, 57, 30, 10, 20), null);
});
test('annular geometry: validates diameters and wall thickness', () => {
  assert.ok(
    Math.abs(math.annularVolume(73, 146, 8.5) - (Math.PI / 4) * (129 ** 2 - 73 ** 2) * 1e-6) <
      1e-12,
  );
  assert.equal(math.annularVolume(150, 146, 8.5), null);
  assert.equal(math.annularVolume(73, 146, 0), null);
});
test('all flow modes and negative/zero boundaries', () => {
  assert.equal(math.wellFlow('hermetic', 10, 0.0136, 60), 3.26);
  assert.equal(math.wellFlow('drain', 10, 0.0136, 60, 0.003, 5), 2.9);
  assert.equal(math.wellFlow('afterDrain', 10, 0.0136, 60, 0.003), 3.98);
  assert.equal(math.wellFlow('hermetic', 0, 0.0136, 60), 0);
  assert.equal(math.wellFlow('hermetic', -1, 0.0136, 60), null);
  assert.equal(math.wellFlow('drain', 10, 0.0136, 0, 0.003, 5), null);
  assert.equal(math.wellFlow('unknown', 10, 0.0136, 60), null);
});
test('all four SKO variants preserve original constants', () => {
  assert.deepEqual(math.skoVolume('direct', 1000, 3), { base: 3, additional: 0, total: 3 });
  assert.deepEqual(math.skoVolume('direct8', 1000, 3), { base: 3, additional: 8, total: 11 });
  assert.ok(Math.abs(math.skoVolume('reverse', 1000, null, 0.129, 0.073).total - 9.43648) < 1e-8);
  assert.ok(Math.abs(math.skoVolume('reverseOff', 1000, null, 0.129).total - 13.14639) < 1e-8);
  assert.equal(math.skoVolume('reverse', 1000, null, 0.073, 0.129), null);
  assert.equal(math.skoVolume('direct', 0, 3), null);
});
test('tap voltage: VFD/filter/material and motor coefficients', () => {
  const inputs = {
    mode: 'no',
    input: 380,
    supply: 380,
    motorVoltage: 1000,
    current: 20,
    length: 1000,
    section: 16,
    temperature: 20,
  };
  const result = math.tapVoltage(inputs),
    loss = Math.sqrt(3) * 20 * 0.85 * (1000 / 16) * 0.017;
  assert.ok(Math.abs(result.total - (1000 + loss)) < 1e-8);
  const vfd = math.tapVoltage({
    ...inputs,
    mode: 'vfd',
    vfdVoltage: 380,
    maxFrequency: 60,
    nominalFrequency: 50,
    filter: true,
  });
  assert.ok(Math.abs(vfd.total - (1296 + loss)) < 1e-8);
  assert.ok(math.tapVoltage({ ...inputs, material: 'al' }).loss > result.loss);
  assert.ok(math.tapVoltage({ ...inputs, motor: 'pm' }).loss > result.loss);
  assert.equal(math.tapVoltage({ ...inputs, temperature: -1000 }), null);
  assert.equal(math.tapVoltage({ ...inputs, section: 0 }), null);
});
test('PED cooling: squared current ratio, zero current and invalid denominator', () => {
  assert.equal(math.pedCooling(100, 50, 100), 25);
  assert.equal(math.pedCooling(100, 0, 100), 0);
  assert.equal(math.pedCooling(100, -1, 100), null);
  assert.equal(math.pedCooling(100, 10, 0), null);
});
test('manual calendar interval: midnight, leap day, year boundary and invalid dates', () => {
  assert.equal(math.intervalBetweenDates('2026-10-18', 23, 50, '2026-10-19', 0, 10), 20);
  assert.equal(math.intervalBetweenDates('2024-02-28', 12, 0, '2024-03-01', 12, 0), 2880);
  assert.equal(math.intervalBetweenDates('2025-12-31', 23, 59, '2026-01-01', 0, 1), 2);
  assert.equal(math.intervalBetweenDates('2026-02-30', 0, 0, '2026-03-01', 0, 0), null);
  assert.equal(math.intervalBetweenDates('2026-10-19', 12, 0, '2026-10-18', 12, 0), null);
});
test('overflow does not produce a valid displayed calculation', () => {
  assert.equal(math.manualDebit(1e308, 1e-308), null);
  assert.equal(math.manualDebitInterval(1e308, 1e-308), null);
  assert.equal(math.annularVolume(1, 1e308, 1), null);
  assert.equal(math.liquidLevel(1e308, 0, 0, 1000), null);
});
test('operator ramp and RICH use original time units and validation', () => {
  assert.deepEqual(math.operatorRamp(40, 50, 1, 60), {
    start: 40,
    end: 50,
    delta: 1,
    seconds: 60,
    rate: 60,
    totalMinutes: 10,
    duration: '00:10',
  });
  assert.equal(math.operatorRamp(40, 40, 1, 60), null);
  assert.equal(math.operatorRamp(40, 50, 0, 60), null);
  assert.deepEqual(math.operatorRich(50, 40, 10, 5), {
    high: 50,
    low: 40,
    highMinutes: 10,
    lowMinutes: 5,
    underloadSeconds: 360,
  });
  assert.equal(math.operatorRich(40, 50, 10, 5), null);
});

test('head at frequency: quadratic example, zero, invalid inputs and overflow', () => {
  assert.ok(Math.abs(math.headAtFrequency(2100, 54) - 2449.44) < 1e-9);
  assert.equal(math.headAtFrequency(2100, 50), 2100);
  assert.ok(Math.abs(math.headAtFrequency(2100, 40) - 1344) < 1e-9);
  assert.equal(math.headAtFrequency(2100, 75), 4725);
  assert.equal(math.headAtFrequency(2100, 0), 0);
  for (const [head, frequency] of [
    [0, 50],
    [-1, 50],
    [2100, -1],
    [null, 50],
    [2100, null],
    [NaN, 50],
    [2100, Infinity],
    [1e308, 1e308],
  ])
    assert.equal(math.headAtFrequency(head, frequency), null);
});

test('operating modes: user example matches the original formula and gives 61/59 whole minutes', () => {
  const apv = math.apvCycle(70, 24, 20, 43, 120);
  assert.ok(Math.abs(apv.total - 61.142857142857146) < 1e-12);
  assert.ok(Math.abs(apv.stop - 58.857142857142854) < 1e-12);
  assert.ok(Math.abs(apv.required - 95.8695652173913) < 1e-12);
  assert.equal(apv.minimum, 120);
  assert.equal(apv.suitable, true);
  const upr = math.operatingCycle(70, 24, 20, 120);
  assert.equal(upr.total, apv.total);
  for (const r of [upr, apv]) {
    const minutes = math.roundOperatingTimes(r.total, 120);
    assert.deepEqual(minutes, { total: 61, stop: 59 });
    assert.equal(minutes.total + minutes.stop, 120);
  }
});

test('operating minute rounding preserves half-minute cycle totals and rejects unrepresentable times', () => {
  assert.deepEqual(math.roundOperatingTimes(60.5, 120), { total: 61, stop: 59 });
  assert.deepEqual(math.roundOperatingTimes(60.49, 120), { total: 60, stop: 60 });
  assert.deepEqual(math.roundOperatingTimes(0, 120), { total: 0, stop: 120 });
  for (const [total, cycle] of [
    [0.1, 120],
    [119.9, 120],
    [120, 120],
    [-1, 120],
    [60, 120.5],
    [60, 0],
    [NaN, 120],
    [60, Infinity],
    [60, null],
  ])
    assert.equal(math.roundOperatingTimes(total, cycle), null);
});
