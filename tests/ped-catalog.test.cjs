const {test} = require('node:test');
const assert = require('node:assert/strict');
const math = require('../js/math.js');
const catalog = require('../assets/PedCoolingCatalog-v7.json');
const db = require('../assets/PedCoolingDatabase.json');
test('Appendix 19 Excel calculation and wall changes preserve units and actual geometry', () => {
  assert.ok(Math.abs(math.pedNominalFlow(146,7.7,117,.12)-27.420439951275572)<1e-10);
  assert.ok(Math.abs(math.pedNominalFlow(146,8.5,117,.12)-24.038160082725184)<1e-10);
  for (const args of [[114,5.2,117,.1],[146,73,117,.1],[146,0,117,.1],
    [146,-1,117,.1],[146,7,0,.1],[146,7,117,0],[null,7,117,.1],
    [1e308,1,1,.1],[146,7,117,Infinity]]) assert.equal(math.pedNominalFlow(...args), null);
});
test('every generated nominal is recalculable and no incompatible combination has a numeric flow', () => {
  assert.equal(catalog.models.length,551);
  for (const p of db) assert.equal(p.flow, math.pedNominalFlow(p.casing,p.wall,p.diameter,p.speed));
  assert.equal(catalog.models.filter(p=>p.manufacturer==='СЦ ЭПУ (EZ-Line)').length,8);
  assert.equal(catalog.models.filter(p=>p.manufacturer==='СЦ ЭПУ (TPS-Line)').length,17);
  assert.equal(catalog.models.find(p=>p.name==='EZ-Line' && p.power===90).speed,.35);
  assert.equal(catalog.models.find(p=>p.name==='EZ-Line' && p.power==='70 - 125 (кроме 90)').speed,.3);
  assert.equal(catalog.generic[0].speed,.31);
  assert.equal(catalog.incomplete.length,1);
  assert.equal(catalog.incomplete[0].diameter,81);
  assert.equal(catalog.models.some(p=>p.name===null),false);
});
