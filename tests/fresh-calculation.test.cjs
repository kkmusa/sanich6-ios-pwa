// Calculator entry is a new task. Back/Forward also start a new calculation;
// history and a currently running manual measurement are separate lifetimes.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
let server, browser, base;

before(async () => {
  const root = path.resolve(process.env.PWA_TEST_ROOT || path.join(__dirname, '..'));
  server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.resume();
  base = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', code => reject(Error('HTTP server exited: ' + code)));
    server.stdout.on('data', chunk => {
      const match = chunk.toString().match(/port (\d+)/);
      if (match) resolve('http://127.0.0.1:' + match[1]);
    });
  });
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
    executablePath: process.env.CHROMIUM_PATH ||
      (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
});
after(async () => {
  await browser?.close();
  if (server && !server.killed) {
    const closed = once(server, 'exit');
    server.kill();
    await closed;
  }
});
async function withPage(run) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.goto(base);
    await page.locator('#continueFirst').click();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}
async function go(page, route) {
  await page.evaluate(route => go(route), route);
  if (await page.locator('#opOfflineClose').isVisible())
    await page.locator('#opOfflineClose').click();
}
async function fill(page, values) {
  for (const [id, value] of Object.entries(values)) await page.locator('#' + id).fill(value);
}
async function browserMove(page, direction, route) {
  await page.evaluate(direction => window.history[direction](), direction);
  await page.waitForFunction(route => state.route === route, route);
}

test('fresh calculators: every numeric calculator starts clean on a new menu entry', () => withPage(async page => {
  const routes = {
    level: 'depth', frequency: 'head', headAtFrequency: 'passportHead', flow: 'dh',
    upr: 'operatingRate', apv: 'operatingRate', sko: 'skoDepth', tap: 'trIn',
    motorCoefficient: 'motorRpm', temperatureSetpoint: 'workingTemperature',
    wellPotential: 'potentialRate', rpd: 'rpdCasing',
  };
  for (const [route, field] of Object.entries(routes)) {
    await go(page, route);
    assert.equal(await page.locator('#' + field).inputValue(), '', route);
    await page.locator('#' + field).fill('123');
    await go(page, 'home');
    await go(page, route);
    assert.equal(await page.locator('#' + field).inputValue(), '', route);
    assert.equal(await page.locator('#liveResult .value').count(), 0, route);
  }
}));

test('fresh calculators: Back and Forward clear results while saved history remains intact', () => withPage(async page => {
  await go(page, 'headAtFrequency');
  await fill(page, { passportHead: '2100', workingFrequency: '54' });
  assert.equal(await page.locator('#liveResult .value').innerText(), '2449 м');
  await go(page, 'history');
  const history = await page.evaluate(() => calculationHistory());
  assert.equal(history.length, 1);
  await browserMove(page, 'back', 'headAtFrequency');
  assert.equal(await page.locator('#passportHead').inputValue(), '');
  assert.equal(await page.locator('#liveResult .value').count(), 0);
  await page.locator('#passportHead').fill('1900');
  await browserMove(page, 'back', 'home');
  await browserMove(page, 'forward', 'headAtFrequency');
  assert.equal(await page.locator('#passportHead').inputValue(), '');
  assert.deepEqual(await page.evaluate(() => calculationHistory()), history);
}));

test('fresh calculators: reload ignores legacy stored drafts and starts with no result', () => withPage(async page => {
  await go(page, 'flow');
  await fill(page, { dh: '100', time: '60' });
  await page.evaluate(() => document.activeElement?.blur());
  const history = await page.evaluate(() => calculationHistory());
  await page.evaluate(() => sessionStorage.setItem('operator_dng_route_drafts_v2', JSON.stringify({
    flow: { dh: { value: '999' }, time: { value: '60' } },
    level: { depth: { value: '3000' }, density: { value: '0.8' } },
  })));
  await page.reload();
  await page.locator('.hero').waitFor();
  await go(page, 'flow');
  assert.equal(await page.locator('#dh').inputValue(), '');
  assert.equal(await page.locator('#time').inputValue(), '');
  assert.equal(await page.locator('#liveResult .value').count(), 0);
  await go(page, 'level');
  assert.equal(await page.locator('#depth').inputValue(), '');
  assert.equal(await page.locator('#density').inputValue(), '');
  assert.deepEqual(await page.evaluate(() => calculationHistory()), history);
}));

test('fresh calculators: same active screen and formula help keep the current process', () => withPage(async page => {
  await go(page, 'flow');
  await fill(page, { dh: '100', time: '60' });
  const before = await page.locator('#liveResult .value').innerText();
  await go(page, 'flow');
  assert.equal(await page.locator('#dh').inputValue(), '100');
  await page.locator('#calculationHelpOpen').click();
  await page.locator('#calculationHelpDone').click();
  assert.equal(await page.locator('#dh').inputValue(), '100');
  assert.equal(await page.locator('#liveResult .value').innerText(), before);
}));

test('fresh calculators: PED steps and station instruction preserve their process but reentry clears it', () => withPage(async page => {
  await go(page, 'ped');
  await page.locator('#pedDia').selectOption('95');
  await page.locator('#pedPower').selectOption('16');
  await page.locator('#pedCasing').selectOption('114');
  await page.locator('#pedWall').selectOption('5.2');
  await page.locator('[data-ped]').first().click();
  await fill(page, { pedWork: '50', pedNom: '100' });
  assert.equal(await page.locator('#pedCalc .value').innerText(), '2.9 м³/сут');
  await go(page, 'home');
  await browserMove(page, 'back', 'ped');
  assert.equal(await page.locator('#pedDia').inputValue(), '');
  assert.equal(await page.locator('#pedWork').count(), 0);

  await go(page, 'ramp');
  await fill(page, { 'op-start': '40', 'op-end': '50', 'op-delta': '1', 'op-stepMinutes': '60' });
  await page.locator('#opStart').click();
  await page.locator('#opNext').click();
  await page.evaluate(() => goBack()); // internal instruction Back, same route
  assert.equal(await page.locator('#op-start').inputValue(), '40');
  await go(page, 'home');
  await browserMove(page, 'back', 'ramp');
  assert.equal(await page.locator('#op-start').inputValue(), '');
  assert.equal(await page.locator('#opStart').isDisabled(), true);
}));

test('fresh calculators: completed manual measurement clears but an active stopwatch survives Back and reload', () => withPage(async page => {
  await go(page, 'manual');
  await fill(page, { liters: '100', seconds: '60' });
  await page.locator('#timerBtn').click();
  assert.equal(await page.locator('#timerBtn').innerText(), 'Стоп');
  const started = await page.evaluate(() => manualElapsed());
  await go(page, 'home');
  await browserMove(page, 'back', 'manual');
  assert.equal(await page.locator('#liters').inputValue(), '100');
  assert.equal(await page.locator('#timerBtn').innerText(), 'Стоп');
  assert.ok(await page.evaluate(() => manualElapsed()) >= started);
  await page.reload();
  await page.locator('.hero').waitFor();
  await go(page, 'manual');
  assert.equal(await page.locator('#liters').inputValue(), '100');
  assert.equal(await page.locator('#timerBtn').innerText(), 'Стоп');
  assert.ok(await page.evaluate(() => manualElapsed()) >= started);
  await page.locator('#timerBtn').click();
  const history = await page.evaluate(() => calculationHistory());
  assert.equal(history.length, 1);
  await go(page, 'home');
  await go(page, 'manual');
  assert.equal(await page.locator('#liters').inputValue(), '');
  assert.equal(await page.locator('#seconds').inputValue(), '');
  assert.equal(await page.locator('#liveResult .value').count(), 0);
  assert.equal(await page.evaluate(() => manualElapsed()), 0);
  assert.deepEqual(await page.evaluate(() => calculationHistory()), history);
}));
