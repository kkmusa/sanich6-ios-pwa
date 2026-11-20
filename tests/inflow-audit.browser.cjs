// Run after npm run build. Checks the actual input/result wiring in all
// three production directories and both reference/geometry volume sources.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const built = path.resolve(process.env.PWA_TEST_ROOT || path.join(__dirname, '../dist'));
let server, browser, origin;

before(async () => {
  for (const directory of ['', 'reglament', 'bez'])
    assert.ok(fs.existsSync(path.join(built, directory, 'index.html')), 'Build all editions first');
  server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: path.dirname(built), stdio: ['ignore', 'pipe', 'pipe'],
  });
  origin = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', code => reject(Error('HTTP server exited: ' + code)));
    server.stdout.on('data', chunk => {
      const match = chunk.toString().match(/port (\d+)/);
      if (match) resolve('http://127.0.0.1:' + match[1] + '/' + path.basename(built) + '/');
    });
  });
  server.stderr.resume();
  const executablePath = process.env.CHROMIUM_PATH ||
    (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
});
after(async () => {
  await browser?.close();
  if (server && !server.killed) {
    const stopped = once(server, 'exit');
    server.kill();
    await stopped;
  }
});
async function result(page, expected) {
  await page.waitForFunction(text => document.querySelector('#liveResult .value')?.textContent === text,
    expected, { timeout: 10000 });
}
async function fill(page, fields) {
  for (const [id, value] of Object.entries(fields)) await page.locator('#' + id).fill(value);
}

for (const directory of ['', 'reglament/', 'bez/'])
  test(`inflow audit ${directory || 'author'}: three modes, reference table, geometry, invalid inputs and history`, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.setDefaultTimeout(10000);
    try {
      await page.goto(origin + directory);
      await page.locator('#continueFirst').click();
      await page.evaluate(() => go('flow'));

      // Set the complete inconsistent measurement without transient valid
      // results: a negative signed volume is an error, not a saved inflow.
      await page.locator('#flowType').selectOption('Негерметичный ОК в период слива');
      await fill(page, { hst: '100', dh: '10', time: '60' });
      assert.match(await page.locator('#liveResult').innerText(), /отрицательный приток/i);
      assert.equal(await page.locator('#liveResult .value').count(), 0);
      assert.equal(await page.evaluate(() => calculationHistory().length), 0);
      await page.locator('#hst').fill('5');
      await result(page, '2.9 м³/сут');
      assert.match(await page.evaluate(() => calculationHistory()[0].details), /Hст=5/);
      await page.locator('#hst').fill('100');
      assert.match(await page.locator('#liveResult').innerText(), /отрицательный приток/i);
      assert.equal(await page.evaluate(() => calculationHistory().length), 1);
      assert.equal(await page.evaluate(() => calculationHistory()[0].result), '2.9 м³/сут');

      // Missing Hст, zero time, negative ΔH and malformed input never
      // produce a displayed or saved numeric result.
      await page.locator('#hst').fill('');
      assert.equal(await page.locator('#liveResult .value').count(), 0);
      await fill(page, { hst: '0', time: '0' });
      assert.equal(await page.locator('#liveResult .value').count(), 0);
      await fill(page, { dh: '-1', time: '60' });
      assert.equal(await page.locator('#liveResult .value').count(), 0);
      await page.locator('#dh').fill('abc');
      assert.equal(await page.locator('#liveResult .value').count(), 0);
      await page.locator('#dh').fill('0');
      await result(page, '0 м³/сут');

      // VNR material balance examples, using the 168/73 reference pair.
      await page.locator('#flowType').selectOption('Герметичный ОК');
      await fill(page, { dh: '100', time: '60' });
      await result(page, '32.64 м³/сут');
      await page.locator('#flowType').selectOption('Негерметичный ОК в период слива');
      await page.locator('#hst').fill('200');
      await result(page, '18.24 м³/сут');
      await page.locator('#flowType').selectOption('Негерметичный ОК после слива');
      await result(page, '39.84 м³/сут');

      // The user stays in the selected reference mode. The corrected pair
      // explicitly identifies the wall/cable assumptions behind its estimate.
      await page.locator('#casing').selectOption('139.7');
      assert.equal(await page.locator('#source').inputValue(), 'По справочнику');
      assert.equal(await page.locator('#casing').inputValue(), '139.7');
      assert.equal(await page.locator('#tubing').inputValue(), '73');
      assert.deepEqual(await page.locator('#vkpBox .row select').evaluateAll(nodes => nodes.map(n => n.id)), ['casing','tubing']);
      assert.equal(await page.locator('#vkpText').innerText(), 'Vкп: 0.007700 м³/м');
      assert.match(await page.locator('#vkpAssumption').innerText(), /7 мм.*КПБП 3×16.*14,7 × 35,3/);
      await page.locator('#flowType').selectOption('Герметичный ОК');
      await result(page, '18.48 м³/сут');
      const calculatedRecord = await page.evaluate(() => calculationHistory()[0]);
      assert.match(calculatedRecord.details,/расчётное приближение/);
      assert.equal(await page.evaluate(record => historyCalculationNotice(record), calculatedRecord),'');
      await page.locator('#tubing').selectOption('60');
      await result(page,'21.84 м³/сут');
      assert.equal(await page.locator('#vkpAssumption').isVisible(),false);
      await page.locator('#tubing').selectOption('89');
      await result(page,'13.92 м³/сут');
      await page.locator('#tubing').selectOption('73');
      await result(page,'18.48 м³/сут');

      // Changing the source is explicit and never swaps casing/tubing.
      await page.locator('#source').selectOption('По геометрии');
      assert.equal(await page.locator('#casingOuter').inputValue(), '139.7');
      assert.equal(await page.locator('#tubing').inputValue(), '73');
      assert.deepEqual(await page.locator('#vkpBox .row select').evaluateAll(nodes => nodes.map(n => n.id)), ['casingOuter','tubing']);
      await page.locator('#wall').selectOption('6.2');
      assert.equal(await page.locator('#vkpText').innerText(), 'Vкп: 0.008542 м³/м');
      await page.locator('#flowType').selectOption('Герметичный ОК');
      await result(page, '20.5 м³/сут');
      await page.locator('#flowCableArea').fill('200');
      await result(page, '20.02 м³/сут');
      await page.locator('#wall').selectOption('7');
      await page.locator('#flowCableType').selectOption('kpbp');
      assert.equal(await page.locator('#flowCableArea').inputValue(), '518.91');
      assert.equal(await page.locator('#flowCableArea').evaluate(node => node.readOnly), true);
      assert.match(await page.locator('#flowCableHint').innerText(), /14,7 × 35,3 мм.*таблицы 9.*518[.,]91/);
      await result(page,'18.49 м³/сут');
      assert.match(await page.evaluate(() => calculationHistory()[0].details), /КПБП 3×16, приблизительно.*518[.,]91/);
      await page.locator('#flowCableType').selectOption('kppbpt');
      assert.equal(await page.locator('#flowCableArea').inputValue(), '561');
      await result(page,'18.39 м³/сут');
      assert.match(await page.evaluate(() => calculationHistory()[0].details), /КППБПТ 3×16, приблизительно.*561/);
      await page.locator('#flowCableType').selectOption('custom');
      assert.equal(await page.locator('#flowCableArea').evaluate(node => node.readOnly), false);
      assert.equal(await page.locator('#flowCableArea').inputValue(), '200');
      assert.match(await page.locator('#flowCableHint').innerText(), /ни 16, ни 48 мм²/);
      await result(page,'19.26 м³/сут');
      await page.locator('#flowCableType').selectOption('kpbp');
      await page.locator('#source').selectOption('По справочнику');
      await result(page,'18.48 м³/сут');
      await page.locator('#source').selectOption('По геометрии');
      assert.equal(await page.locator('#flowCableType').inputValue(),'kpbp');
      assert.equal(await page.locator('#flowCableArea').inputValue(),'518.91');
      assert.equal(await page.locator('#flowCableArea').evaluate(node => node.readOnly),true);
      await result(page,'18.49 м³/сут');
      await page.locator('#flowCableType').selectOption('custom');
      assert.equal(await page.locator('#flowCableArea').inputValue(),'200');
      await page.locator('#flowCableArea').fill('518.91');
      await result(page,'18.49 м³/сут');
      await page.locator('#source').selectOption('По справочнику');
      assert.equal(await page.locator('#casing').inputValue(),'139.7');
      await result(page,'18.48 м³/сут');
      await page.locator('#source').selectOption('По геометрии');
      assert.equal(await page.locator('#wall').inputValue(),'7');
      assert.equal(await page.locator('#flowCableArea').inputValue(),'518.91');
      await result(page,'18.49 м³/сут');
      await page.locator('#casingOuter').selectOption('146');
      await page.locator('#wall').selectOption('8.5');
      await page.locator('#casingOuter').selectOption('139.7');
      assert.equal(await page.locator('#wall').inputValue(),'7');
      await page.evaluate(() => go('home'));
      await page.evaluate(() => goBack());
      // A new visit (including Back) starts a clean calculation. Only source
      // changes inside this currently open form retain its geometry draft.
      assert.equal(await page.locator('#source').inputValue(),'По справочнику');
      assert.equal(await page.locator('#casing').inputValue(),'168');
      assert.equal(await page.locator('#tubing').inputValue(),'73');
      assert.equal(await page.locator('#dh').inputValue(),'');
      assert.equal(await page.locator('#time').inputValue(),'');
      assert.equal(await page.locator('#liveResult .value').count(),0);
      await page.locator('#source').selectOption('По геометрии');
      await page.locator('#casingOuter').selectOption('139.7');
      await page.locator('#wall').selectOption('6.2');
      await fill(page,{dh:'100',time:'60'});
      await page.locator('#flowCableArea').fill('100000');
      assert.equal(await page.locator('#liveResult .value').count(), 0);
      await page.locator('#flowCableArea').fill('');
      await result(page, '20.5 м³/сут');

      // Geometry is available only for a hermetic check valve.  A change to
      // either non-hermetic method immediately returns to the reference
      // source, so the screen cannot retain the wrong geometry form.
      await page.locator('#flowType').selectOption('Негерметичный ОК после слива');
      assert.equal(await page.locator('#source').inputValue(), 'По справочнику');
      assert.equal(await page.locator('#casing').count(), 1);
      assert.equal(await page.locator('#casingOuter').count(), 0);
      await page.locator('#flowType').selectOption('Герметичный ОК');

      // 146 mm outer casing / 7 mm wall / 73 mm outer tubing.
      await page.locator('#source').selectOption('По геометрии');
      await page.locator('#casingOuter').selectOption('146');
      await page.locator('#wall').selectOption('7');
      assert.doesNotMatch(await page.locator('main').innerText(), /требует уточнения/);
      await page.locator('#calculationHelpOpen').click();
      assert.match(await page.locator('#calculationHelpDialog').innerText(), /Если поле пустое, геометрический расчёт не учитывает объём кабеля/);
      assert.match(await page.locator('#calculationHelpDialog').innerText(), /статический уровень в затрубном пространстве и НКТ в момент окончания слива/);
      await page.locator('#calculationHelpDone').click();
      await page.locator('#flowType').selectOption('Герметичный ОК');
      await result(page, '22.8 м³/сут');
      await page.locator('#flowType').selectOption('Негерметичный ОК в период слива');
      await page.locator('#hst').fill('200');
      assert.equal(await page.locator('#source').inputValue(), 'По справочнику');
      assert.equal(await page.locator('#casingOuter').count(), 0);
      await result(page, '6.48 м³/сут');
      await page.locator('#flowType').selectOption('Негерметичный ОК после слива');
      await result(page, '28.08 м³/сут');
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
