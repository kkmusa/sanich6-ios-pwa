const { test } = require('node:test');
const assert = require('node:assert/strict');
const math = require('../js/math.js');
const fixture = require('./android-goldens.json');
function close(actual, expected, message) {
  if (expected === null) return assert.equal(actual, null, message);
  assert.equal(actual.length, expected.length, message);
  actual.forEach((value, i) => {
    if (typeof expected[i] === 'boolean') assert.equal(value, expected[i], message);
    else
      assert.ok(
        Math.abs(value - expected[i]) <= 1e-9 * Math.max(1, Math.abs(expected[i])),
        `${message}: ${value} != ${expected[i]}`,
      );
  });
}
for (const kind of [...new Set(fixture.cases.map((row) => row.kind))])
  test(`original Kotlin parity: ${kind}`, () => {
    for (const row of fixture.cases.filter((row) => row.kind === kind)) {
      const a = row.inputs;
      let result;
      switch (kind) {
        case 'level':
          result = [math.liquidLevel(a[0], a[1], a[2], a[3] * 1000)];
          break;
        case 'inner':
          result = [math.casingInnerDiameter(...a)];
          break;
        case 'sensor':
          result = [math.sensorHermetic(...a)];
          break;
        case 'frequency':
          result = [math.startFrequency(...a)];
          break;
        case 'annular': {
          const r = math.annularVolume(...a);
          result = r === null ? null : [r];
          break;
        }
        case 'flow':
          result = [math.wellFlow(...a)];
          break;
        case 'sko': {
          const variant = {
              DIRECT_WORKING: 'direct',
              DIRECT_NO_FLOW: 'direct8',
              REVERSE_WORKING: 'reverse',
              REVERSE_PUMP_OFF: 'reverseOff',
            }[a[0]],
            r = math.skoVolume(variant, ...a.slice(1));
          result = r && [r.base, r.additional, r.total];
          break;
        }
        case 'tap': {
          const r = math.tapVoltage({
            mode: a[0] === 'WITHOUT_VFD' ? 'no' : 'vfd',
            material: a[1] === 'COPPER' ? 'cu' : 'al',
            motor: a[2] === 'ASYNCHRONOUS' ? 'async' : 'pm',
            filter: a[3],
            temperature: a[4],
            input: 380,
            supply: 380,
            motorVoltage: 1000,
            current: 20,
            length: 1200,
            section: 16,
            vfdVoltage: 380,
            maxFrequency: 60,
            nominalFrequency: 50,
          });
          result = r && [r.temperatureCoefficient, r.loss, r.total];
          break;
        }
        case 'upr': {
          const r = math.operatingCycle(...a);
          result = r && [r.productive, r.total, r.stop];
          break;
        }
        case 'apv': {
          const r = math.apvCycle(...a);
          result = r && [r.productive, r.total, r.required, r.minimum, r.stop, r.suitable];
          break;
        }
        default:
          throw Error('Unknown case ' + kind);
      }
      close(result, row.expected, `${kind} ${JSON.stringify(a)}`);
    }
  });
