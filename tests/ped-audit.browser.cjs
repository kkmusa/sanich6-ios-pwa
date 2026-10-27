// Run after npm run build. Verify the same PED safety checks in every published edition.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
let server, browser, base;

before(async () => {
  const built = path.resolve(process.env.PWA_TEST_ROOT || path.join(__dirname, '../dist'));
  assert.ok(fs.existsSync(path.join(built, 'reglament/index.html')), 'Build all editions first');
  server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: path.dirname(built), stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.resume();
  const origin = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', (code) => reject(Error('Server exited: ' + code)));
    server.stdout.on('data', (chunk) => {
      const m = chunk.toString().match(/port (\d+)/);
      if (m) resolve('http://127.0.0.1:' + m[1]);
    });
  });
  base = `${origin}/${path.basename(built)}/`;
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
});
after(async () => {
  await browser?.close();
  if (server && !server.killed) {
    const closed = once(server, 'exit');
    server.kill();
    await closed;
  }
});

for (const edition of ['', 'reglament/', 'bez/']) {
  test(`PED compatibility, sorted valid rows and current validation in ${edition || 'author'}`, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(15000);
      await page.goto(base + edition);
      await page.waitForFunction(() => document.querySelector('.hero, #continueFirst'));
      if (await page.locator('#continueFirst').isVisible()) await page.locator('#continueFirst').click();
      await page.locator('.hero').waitFor();
      await page.evaluate(() => go('ped'));
      await page.locator('#pedDia').selectOption('117');
      await page.locator('#pedPower').selectOption('12');
      await page.locator('#pedCasing').selectOption('114');
      assert.match(await page.locator('#pedBody').innerText(), /подходящие варианты не найдены/);
      assert.equal(await page.locator('#pedWall').count(), 0);
      assert.equal(await page.locator('[data-ped]').count(), 0);
      assert.equal(await page.locator('#pedWork').count(), 0);

      await page.locator('#pedCasing').selectOption('140');
      await page.locator('#pedWall').selectOption('6.2');
      assert.deepEqual(await page.locator('.ped-result .ped-flow b').allTextContents(),
        ['14.08 м³/сут', '8.8 м³/сут', '8.8 м³/сут', '8.8 м³/сут']);

      await page.locator('#pedDia').selectOption('95');
      await page.locator('#pedPower').selectOption('16');
      await page.locator('#pedCasing').selectOption('114');
      await page.locator('#pedWall').selectOption('5.2');
      await page.locator('[data-ped]').first().click();
      await page.locator('#pedNom').fill('100');
      for (const [working, expected] of [['50', '2.9 м³/сут'], ['81', '7.6 м³/сут'], ['0', '0 м³/сут']]) {
        await page.locator('#pedWork').fill(working);
        assert.equal(await page.locator('#pedCalc .value').innerText(), expected);
      }
      for (const [working, nominal] of [['50', '0'], ['-1', '100'], ['', '100'], ['1e308', '1e-308']]) {
        await page.locator('#pedWork').fill(working);
        await page.locator('#pedNom').fill(nominal);
        assert.equal(await page.locator('#pedCalc .error').count(), 1);
        assert.equal(await page.locator('#pedCalc .value').count(), 0);
        assert.equal(await page.evaluate(() => state.last), null);
      }
      await page.locator('#pedWork').fill('81');
      await page.locator('#pedNom').fill('100');
      assert.equal(await page.locator('#pedCalc .value').innerText(), '7.6 м³/сут');
      // EZ-Line's 90 kW exception is distinct from the adjacent range.
      await page.locator('#pedDia').selectOption('115.8');
      await page.locator('#pedPower').selectOption('90');
      await page.locator('#pedCasing').selectOption('146');
      await page.locator('#pedWall').selectOption('7.7');
      assert.equal(await page.locator('.ped-result .ped-flow b').first().innerText(), '86.61 м³/сут');
      await page.locator('#pedPower').selectOption('70 - 125 (кроме 90)');
      await page.locator('#pedCasing').selectOption('146');
      await page.locator('#pedWall').selectOption('7.7');
      assert.equal(await page.locator('.ped-result .ped-flow b').first().innerText(), '74.24 м³/сут');
      await page.locator('[data-ped]').first().click();
      await page.evaluate(() => go('home'));
      await page.evaluate(() => go('ped'));
      assert.equal(await page.locator('#pedPower').inputValue(), '70 - 125 (кроме 90)');
      await page.locator('#pedDia').selectOption('130');
      await page.locator('#pedPower').selectOption('400');
      await page.locator('#pedCasing').selectOption('168');
      await page.locator('#pedWall').selectOption('8');
      assert.match(await page.locator('#pedBody').innerText(), /ПЭДМТ 400-130/);
      // Universal source row uses actual passport geometry, never a fabricated motor.
      await page.locator('#pedMode').click();
      for (const [id,value] of Object.entries({genericDiameter:'117',genericPower:'100',
        genericCasing:'146',genericWall:'7.7',genericWorking:'81',genericNominal:'100'}))
        await page.locator('#'+id).fill(value);
      assert.equal(await page.locator('#genericNominalResult').innerText(), 'Номинальный приток: 70.84 м³/сут');
      assert.equal(await page.locator('#pedCalc .value').innerText(), '46.48 м³/сут');
      const lastGood = await page.evaluate(() => calculationHistory()[0].result);
      await page.locator('#genericCasing').fill('114');
      assert.equal(await page.locator('#pedCalc .value').count(),0);
      assert.equal(await page.evaluate(() => state.last),null);
      assert.equal(await page.evaluate(() => calculationHistory()[0].result),lastGood);
      await page.locator('#genericCasing').fill('146');
      await page.locator('#genericNominal').fill('0');
      assert.equal(await page.locator('#pedCalc .value').count(),0);
      await page.locator('#genericNominal').fill('100');
      await page.evaluate(() => go('home'));
      await page.evaluate(() => go('ped'));
      assert.equal(await page.locator('#genericWall').inputValue(),'7.7');
      await page.locator('#resetPed').click();
      assert.equal(await page.locator('#pedDia').inputValue(),'');
      await page.evaluate(async () => { await DngOfflineWorker.ready(); });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await context.setOffline(true);
      await page.reload();
      await page.locator('.hero').waitFor();
      await page.evaluate(() => go('ped'));
      await page.locator('#pedDia').selectOption('115.8');
      await page.locator('#pedPower').selectOption('90');
      await page.locator('#pedCasing').selectOption('146');
      await page.locator('#pedWall').selectOption('7.7');
      assert.equal(await page.locator('.ped-flow b').first().innerText(),'86.61 м³/сут');
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
}
