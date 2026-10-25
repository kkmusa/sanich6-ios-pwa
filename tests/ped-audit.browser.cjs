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
        ['13.66 м³/сут', '8.8 м³/сут', '8.8 м³/сут', '8.54 м³/сут']);

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
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
}
