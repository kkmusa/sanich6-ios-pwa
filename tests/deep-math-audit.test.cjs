const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const math = require('../js/math.js');
const close = (a,b,t=1e-10) => assert.ok(Math.abs(a-b)<t, `${a} != ${b}`);

test('independent fluids hollow-cylinder published example confirms mm/metre conversion', () => {
  // Caleb Bell, fluids.geometry.V_hollow_cylinder(0.005, 0.01, 0.1).
  // Source: https://github.com/CalebBell/fluids/blob/master/fluids/geometry.py
  close(math.annularVolume(5,12,1)*0.1,5.890486225480862e-6,1e-18);
  // fluids.core.head_from_P(98066.5,1000) = 10 metres: one technical atmosphere.
  assert.equal(math.liquidLevel(100,0,1,1000),90);
});
test('139.7/73 old capacity violates even the largest available annulus; tubing order is physical', () => {
  for(const wall of [6.2,7,7.7,9.2,10.5]) {
    const volumes=[60,73,89].map(t=>math.annularVolume(t,139.7,wall));
    assert.ok(volumes[0]>volumes[1] && volumes[1]>volumes[2]);
    assert.ok(volumes[1]<0.01);
  }
  close(math.annularVolume(73,139.7,6.2),0.008542218190578032);
});
test('cable displaces its entire outer area and can never create a negative annular volume', () => {
  const plain=math.annularVolume(73,139.7,6.2);
  close(plain-math.annularVolume(73,139.7,6.2,200),0.0002);
  for(const cable of [-1,null,Infinity,100000])
    assert.equal(math.annularVolume(73,139.7,6.2,cable),null);
});
test('negative raw drainage remains detectable when source display rounding gives zero', () => {
  assert.ok(math.wellFlowRaw('drain',0,.0136,60,.003,.000001)<0);
  assert.equal(Math.abs(math.wellFlow('drain',0,.0136,60,.003,.000001)),0);
});
test('RPD rejects overflowing intermediate values instead of returning a zero working period', () => {
  assert.equal(math.rpd(.15,.073,870,1015,80,1,1e308,30,1e308,20),null);
  const r=math.rpd(.15,.073,870,1015,80,17,57,30,10,20);
  close(r.volume + 17*r.actualRun/1440,57*r.actualRun/1440);
  close(r.volume*1440,17*r.accumulation);
  close(r.deltaLevel * Math.PI/4*(.15**2-.073**2),r.volume);
});
test('four cable-loss examples match the supplied Word instruction after its whole-volt rounding', () => {
  for(const [material,motor,expected] of [['cu','async',51],['al','async',78],['cu','pm',57],['al','pm',87]]) {
    const r=math.tapVoltage({mode:'no',input:380,supply:380,motorVoltage:1000,
      current:26,length:1000,section:16,temperature:80,material,motor});
    assert.equal(Math.round(r.loss),expected);
    assert.equal(r.temperatureCoefficient,1.258);
  }
});
test('temperature examples match Word instruction and manual debit preserves daily litre balance', () => {
  assert.equal(math.temperatureSetpoint(70,'Д1'),73.5);
  assert.equal(math.temperatureSetpoint(100,'Д1'),102);
  close(math.temperatureSetpoint(113,'Д2'),118.65);
  assert.equal(math.manualDebitInterval(100,60),2.4);
  assert.equal(math.manualDebit(100,3600),2.4);
  assert.equal(math.manualDebitInterval(1000,1440),1);
});
test('frequency estimate satisfies affinity within its explicitly fixed-head model', () => {
  for(const level of [0,100,607.6,1500]) for(const head of [500,1000,2100]) {
    const f=math.startFrequency(level,head);
    close(math.headAtFrequency(head,f),level+392.4,1e-8);
  }
});
test('only confirmed obsolete reference-history records are marked for recalculation', () => {
  const context={};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/calculators.js'),'utf8'),context);
  const details='ΔH=100 м; время=60 мин; ЭК=139.7 мм; НКТ=73 мм; Vкп=0.010000 м³/м';
  assert.match(context.historyCalculationNotice({method:'По справочнику',details}),/Требует пересчёта/);
  assert.equal(context.historyCalculationNotice({method:'По геометрии',details}), '');
  assert.equal(context.historyCalculationNotice({method:'По справочнику',details:details.replace('139.7','146')}), '');
});
test('station instruction clocks cannot silently round a positive duration to zero or to another minute', () => {
  const context = {DngMath:math, num:v=>Number(v), fmt:v=>Number(v).toFixed(2).replace(/\.?0+$/,''),
    sessionStorage:{getItem:()=>null}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/operator-data.js'),'utf8')+'\nglobalThis.steps=operatorSteps;',context);
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/operators.js'),'utf8'),context);
  const short={start:'40',end:'41',delta:'1',stepMinutes:'1',station:'ТРИОЛ (УМКА)'};
  assert.equal(context.opCalc('ramp',short),null);
  assert.match(context.opInputIssue('ramp',short),/целыми минутами/);
  assert.ok(context.opCalc('ramp',{...short,stepMinutes:'60'}));
  assert.ok(context.opCalc('ramp',{...short,station:'Борец КАСКАД-НТ'}));
  const station=Object.keys(context.steps.rich).find(k=>context.steps.rich[k].some(s=>s.description.includes('minutesClock(')));
  assert.ok(station);
  const rich={high:'50',low:'40',highMinutes:'0.1',lowMinutes:'5',station};
  assert.equal(context.opCalc('rich',rich),null);
  assert.ok(context.opCalc('rich',{...rich,highMinutes:'10'}));
});
