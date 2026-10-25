const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
const playwright = require('playwright');
let server, browser, base;
before(async () => {
  server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: process.env.PWA_TEST_SUBPATH
      ? path.dirname(
          process.env.PWA_TEST_ROOT
            ? path.resolve(process.env.PWA_TEST_ROOT)
            : path.resolve(__dirname, '..'),
        )
      : process.env.PWA_TEST_ROOT
        ? path.resolve(process.env.PWA_TEST_ROOT)
        : path.resolve(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', (code) => reject(Error('HTTP server exited: ' + code)));
    server.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/port (\d+)/);
      if (match) resolve('http://127.0.0.1:' + match[1]);
    });
  });
  server.stderr.resume();
  base = await ready;
  if (process.env.PWA_TEST_SUBPATH)
    base +=
      '/' +
      path.basename(
        process.env.PWA_TEST_ROOT
          ? path.resolve(process.env.PWA_TEST_ROOT)
          : path.resolve(__dirname, '..'),
      ) +
      '/';
  const engine = process.env.PWA_BROWSER || 'chromium';
  const executable =
    process.env.CHROMIUM_PATH ||
    (engine === 'chromium' && fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : null);
  browser = await playwright[engine].launch({
    headless: true,
    ...(executable ? { executablePath: executable } : {}),
    args: ['--no-sandbox'],
  });
});
after(async () => {
  await browser?.close();
  if (server && !server.killed) {
    server.kill();
    await once(server, 'exit');
  }
});
async function withPage(run, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ...options,
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.locator('#continueFirst').click();
    await run(page, context);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
async function go(page, route) {
  await page.evaluate((route) => go(route), route);
  if (await page.locator('#opOfflineClose').isVisible())
    await page.locator('#opOfflineClose').click();
}
async function fill(page, values) {
  for (const [id, value] of Object.entries(values)) await page.locator('#' + id).fill(value);
}
async function result(page, text) {
  await page.waitForFunction(
    (text) => document.querySelector('#liveResult .value')?.textContent === text,
    text,
    { timeout: 10000 },
  );
}
test('calculator navigation preserves result, and history persists across reload', () =>
  withPage(async (page) => {
    await go(page, 'level');
    await fill(page, { depth: '1000', pz: '10', pd: '20', density: '1' });
    await result(page, '900 м');
    await go(page, 'home');
    await page.evaluate(() => goBack());
    await result(page, '900 м');
    await go(page, 'history');
    assert.equal(await page.locator('.history-item').count(), 1);
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'history');
    assert.equal(await page.locator('.history-result').textContent(), '900 м');
  }));
test('manual stopwatch suspends UI updates on navigation, interval wheels survive navigation and reload', () =>
  withPage(async (page) => {
    await go(page, 'frequency');
    await go(page, 'manual');
    await fill(page, { liters: '100', seconds: '60' });
    await result(page, '144 м³/сут');
    await page.locator('#timerBtn').click();
    await go(page, 'frequency');
    assert.equal(await page.evaluate(() => manualTimerHandle), null);
    await go(page, 'manual');
    await page.locator('#timerBtn').click();
    await page.waitForFunction(() => Number(document.getElementById('seconds').value) > 60);
    await page.locator('#timerBtn').click();
    if (await page.evaluate(() => manualTimerRunning)) await page.locator('#timerBtn').click();
    await page.waitForFunction(() =>
      calculationHistory().some((entry) => entry.title === 'Ручной замер дебита'),
    );
    await go(page, 'history');
    assert.equal(await page.locator('.history-item').count(), 1);
    await go(page, 'manual');
    await page.locator('#manualIntervalMode').check();
    await page.locator('[data-day="0"]').click();
    for (const [id, value] of Object.entries({
      startHours: 23,
      startMinutes: 50,
      endHours: 0,
      endMinutes: 10,
    })) {
      await page.locator('#' + id).focus();
      await page.evaluate(
        ({ id, value }) => document.querySelector(`#${id} [data-value="${value}"]`).click(),
        { id, value },
      );
    }
    await result(page, '7.2 м³/сут');
    await go(page, 'home');
    assert.equal(await page.evaluate(() => manualTimerHandle), null);
    await go(page, 'manual');
    await result(page, '7.2 м³/сут');
    assert.equal(await page.locator('#manualInterval').isVisible(), true);
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'manual');
    await result(page, '7.2 м³/сут');
  }));
test('flow static level can be entered without clearing itself; casing selector works', () =>
  withPage(async (page) => {
    await go(page, 'flow');
    await page.locator('#flowType').selectOption('Негерметичный ОК в период слива');
    await fill(page, { dh: '10', time: '60', hst: '5' });
    assert.equal(await page.locator('#hst').inputValue(), '5');
    await result(page, '2.9 м³/сут');
    await page.locator('#casing').selectOption('146');
    assert.equal(await page.locator('#hst').inputValue(), '5');
    await page.locator('#source').selectOption('По геометрии');
    await page.locator('#casingOuter').selectOption('168');
    assert.ok(await page.locator('#wall').count());
  }));
test('shell, VNR index and every station photo work offline', () =>
  withPage(async (page, context) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await go(page, 'vnr');
    await page.frameLocator('iframe').locator('#vnr-search').waitFor();
    await go(page, 'operators');
    await page.locator('#opOfflineOpen').click();
    await page.locator('#opOfflineDownload').click();
    await page.waitForFunction(
      () => document.getElementById('opOfflineStatus').textContent.includes('Доступны офлайн.'),
      {},
      { timeout: 30000 },
    );
    const expected = await page.evaluate(() => OPERATOR_PHOTOS.length);
    assert.ok(expected > 50);
    await context.setOffline(true);
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'headAtFrequency');
    await fill(page, { passportHead: '2100', workingFrequency: '54' });
    await result(page, '2449 м');
    const assets = await page.evaluate(async () => {
      const results = [];
      for (const url of OPERATOR_PHOTOS) {
        const r = await fetch(url);
        results.push(r.ok && r.headers.get('content-type').startsWith('image/'));
      }
      return results;
    });
    assert.equal(assets.length, expected);
    assert.ok(assets.every(Boolean));
    const documentAvailable = await page.evaluate(async () => {
      const r = await fetch('vnr/index.html');
      return r.ok && (await r.text()).includes('page-207');
    });
    assert.equal(documentAvailable, true);
    const layoutAvailable = await page.evaluate(async () => {
      const css = await fetch(`vnr/layout.css?v=${APP_VERSION}`);
      const js = await fetch(`vnr/layout.js?v=${APP_VERSION}`);
      return (
        css.ok &&
        css.headers.get('content-type').includes('text/css') &&
        js.ok &&
        /javascript/.test(js.headers.get('content-type'))
      );
    });
    assert.equal(layoutAvailable, true);
    const db = await page.evaluate(async () => {
      const r = await fetch('assets/PedCoolingDatabase.json');
      return Object.keys(await r.json()).length;
    });
    assert.ok(db > 0);
    await go(page, 'manual');
    await fill(page, { liters: '100', seconds: '60' });
    await result(page, '144 м³/сут');
    await page.getByRole('button', { name: 'Пояснения и формулы' }).click();
    assert.equal(await page.locator('#calculationHelpDialog math mfrac').count(), 1);
    await page.getByRole('button', { name: 'Понятно', exact: true }).click();
    await result(page, '144 м³/сут');
  }));
test('all five stations provide ramp and RICH instructions with existing photographs', () =>
  withPage(async (page) => {
    const coverage = await page.evaluate(() =>
      Object.entries(operatorSteps).flatMap(([mode, stations]) =>
        Object.entries(stations).map(([station, steps]) => ({
          mode,
          station,
          count: steps.length,
          photos: steps.map((s) => s.image).filter(Boolean),
        })),
      ),
    );
    assert.equal(coverage.length, 10);
    for (const row of coverage) {
      assert.ok(row.count > 0);
      for (const photo of row.photos)
        assert.ok(fs.existsSync(path.resolve(__dirname, '..', photo)), photo);
    }
    const descriptions = await page.evaluate(() =>
      Object.entries(operatorSteps).flatMap(([mode, stations]) =>
        Object.entries(stations).flatMap(([station, steps]) => {
          const values =
            mode === 'ramp'
              ? { start: '40', end: '50', delta: '1', stepMinutes: '60' }
              : { high: '50', low: '40', highMinutes: '10', lowMinutes: '5' };
          return steps.map((step) => opDescription(step.description, opCalc(mode, values)));
        }),
      ),
    );
    for (const text of descriptions)
      assert.doesNotMatch(text, /\$\{|\$(st|en|rt|hi|lo|htime|ltime|duration)\b/);
    await go(page, 'operators');
    await fill(page, { 'op-start': '40', 'op-end': '50', 'op-delta': '1', 'op-stepMinutes': '60' });
    await page.locator('#opStart').click();
    await page.locator('#opNext').waitFor();
  }));
test('all routes render; operating screens use existing mathematical functions', () =>
  withPage(async (page) => {
    for (const route of [
      'frequency',
      'headAtFrequency',
      'sko',
      'tap',
      'reference',
      'assistant',
      'pipes',
      'skoref',
      'about',
      'privacy',
      'ped',
    ]) {
      await go(page, route);
      assert.ok(await page.locator('.screen').count(), route);
    }
    await go(page, 'upr');
    await fill(page, {
      operatingRate: '100',
      inflowRate: '50',
      startupMinutes: '1',
      cycleMinutes: '60',
    });
    await result(page, 'Работа: 31 мин\nОстановка: 29 мин');
    await go(page, 'apv');
    await fill(page, {
      operatingRate: '100',
      inflowRate: '50',
      startupMinutes: '10',
      drainMinutes: '60',
      cycleMinutes: '360',
    });
    await result(
      page,
      'Работа: 190 мин\nОтстой: 170 мин\nВремя слива: 60 мин\nМинимальный цикл: 180 мин\nВыбранный цикл подходит',
    );
  }));
test('VNR index: 207 sections, 338 links, phrase search, highlight, arrows and clearing', () =>
  withPage(async (page) => {
    await go(page, 'vnr');
    const frame = page.frameLocator('iframe');
    await frame.locator('#vnr-search').waitFor();
    await page.waitForFunction(
      () => document.querySelector('iframe')?.contentDocument.readyState === 'complete',
    );
    assert.equal(await frame.locator('section.page').count(), 207);
    assert.equal(await frame.locator('.link-hotspot').count(), 338);
    await frame.locator('#vnr-search').fill('ТЕХНОЛОГИЧЕСКАЯ ИНСТРУКЦИЯ');
    await page.waitForFunction(() => {
      const f = document.querySelector('iframe')?.contentDocument;
      return f?.querySelector('#vnr-count')?.textContent !== '0/0';
    });
    const count = await frame.locator('#vnr-count').textContent();
    assert.ok(Number(count.split('/')[1]) > 1);
    assert.ok((await frame.locator('.hit.current').count()) > 1);
    await frame.locator('#vnr-next').click();
    assert.match(await frame.locator('#vnr-count').textContent(), /^2\//);
    await frame.locator('#vnr-prev').click();
    assert.match(await frame.locator('#vnr-count').textContent(), /^1\//);
    await frame.locator('#clear-vnr').click();
    assert.equal(await frame.locator('#vnr-search').inputValue(), '');
    assert.equal(await frame.locator('.hit').count(), 0);
    await frame.locator('#vnr-search').fill('НесуществующееСловоXYZ');
    assert.equal(await frame.locator('#vnr-count').textContent(), '0/0');
    await frame.locator('#vnr-toc').click();
    // Validate link targets in the supplied index without pretending missing images were rendered.
    const invalid = await page.evaluate(() =>
      [...document.querySelector('iframe').contentDocument.querySelectorAll('[onclick]')]
        .map((el) => el.getAttribute('onclick'))
        .filter((code) => /jumpPage\(/.test(code))
        .filter((code) => {
          const n = Number(code.match(/jumpPage\((\d+)\)/)?.[1]);
          return !Number.isInteger(n) || n < 1 || n > 207;
        }),
    );
    assert.deepEqual(invalid, []);
  }));
test('Android engineering calculators: motor swap, temperature cap, potential and persistent inputs', () =>
  withPage(async (page) => {
    await page.locator('.menu-card').filter({ hasText: 'Коэффициент двигателя 2А' }).click();
    await fill(page, { motorRpm: '6000', motorPoles: '2', motorFrequency: '50' });
    await result(page, '100 Гц');
    await page.locator('#motorSwap').click();
    assert.equal(await page.locator('#motorFrequency').inputValue(), '100');
    await result(page, '50 Гц');
    await go(page, 'home');
    await page.evaluate(() => goBack());
    await result(page, '50 Гц');
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'motorCoefficient');
    await result(page, '50 Гц');
    assert.equal(await page.locator('#motorReverse').isChecked(), true);
    await go(page, 'temperatureSetpoint');
    await fill(page, { workingTemperature: '150' });
    await page.locator('#temperatureGroup').selectOption('Д2');
    await result(page, '127.5 °C');
    await go(page, 'wellPotential');
    await fill(page, { potentialRate: '100', potentialOn: '60', potentialOff: '60' });
    await result(page, '50 м³/сут');
    await page.locator('#potentialDelay').fill('12');
    await result(page, '40 м³/сут');
    await go(page, 'history');
    assert.ok((await page.locator('.history-item').count()) >= 3);
  }));
test(
  'complete VNR: download 207 pages, reload offline and decode every image',
  { timeout: 120000 },
  () =>
    withPage(async (page, context) => {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
      await go(page, 'vnr');
      const frame = page.frameLocator('iframe');
      await frame.locator('#vnr-download').waitFor();
      await page.waitForFunction(
        () => document.querySelector('iframe')?.contentDocument.readyState === 'complete',
      );
      await frame.locator('#vnr-download').click();
      await page.waitForFunction(
        () =>
          document.querySelector('iframe')?.contentDocument.querySelector('#vnr-download-status')
            ?.textContent === 'Готово: 207 страниц доступны офлайн',
        null,
        { timeout: 90000 },
      );
      assert.equal(
        await page.evaluate(
          async () => (await (await caches.open('operator-dng-vnr-pages-v1')).keys()).length,
        ),
        207,
      );
      await context.setOffline(true);
      await page.reload();
      await page.locator('.hero').waitFor();
      await go(page, 'vnr');
      await page.frameLocator('iframe').locator('#vnr-search').waitFor();
      await page.waitForFunction(
        () => document.querySelector('iframe')?.contentDocument.readyState === 'complete',
      );
      const decoded = await page.evaluate(async () => {
        const images = [
            ...document.querySelector('iframe').contentDocument.querySelectorAll('.page img'),
          ],
          results = [];
        for (const image of images) {
          const response = await fetch(image.src);
          const bitmap = await createImageBitmap(await response.blob());
          results.push({
            page: image.alt,
            ok: response.ok,
            width: bitmap.width,
            height: bitmap.height,
            expectedWidth: image.width ? Number(image.getAttribute('width')) : 0,
            expectedHeight: Number(image.getAttribute('height')),
          });
          bitmap.close();
        }
        return results;
      });
      assert.equal(decoded.length, 207);
      for (const image of decoded) {
        assert.equal(image.ok, true, image.page);
        assert.equal(image.width, image.expectedWidth, image.page);
        assert.equal(image.height, image.expectedHeight, image.page);
      }
      const reader = page.frameLocator('iframe');
      await reader.locator('#vnr-search').fill('технологическая инструкция');
      await reader.locator('.hit.current').first().waitFor();
      // Click every supplied internal hyperlink and verify it scrolls to the stated page.
      const links = await page.evaluate(() => {
        const doc = document.querySelector('iframe').contentDocument,
          win = doc.defaultView;
        let checked = 0;
        for (const link of doc.querySelectorAll('.link-hotspot')) {
          const code = link.getAttribute('onclick') || '',
            target = code.match(/jumpPage\((\d+)\)/);
          if (!target) continue;
          link.click();
          const page = doc.getElementById('page-' + target[1]);
          if (
            !page ||
            (Math.abs(
              page.getBoundingClientRect().top -
                parseFloat(win.getComputedStyle(page).scrollMarginTop),
            ) > 3 &&
              !(
                win.scrollY + win.innerHeight >= doc.documentElement.scrollHeight - 3 &&
                page.getBoundingClientRect().top >=
                  parseFloat(win.getComputedStyle(page).scrollMarginTop) - 3 &&
                page.getBoundingClientRect().top < win.innerHeight
              ))
          )
            return { checked, error: code, top: page?.getBoundingClientRect().top };
          checked++;
        }
        return { checked, error: null };
      });
      assert.equal(links.error, null, JSON.stringify(links));
      assert.equal(links.checked, 335);
      const external = await page.evaluate(() =>
        [...document.querySelector('iframe').contentDocument.querySelectorAll('.link-hotspot')]
          .filter((el) => (el.getAttribute('onclick') || '').startsWith('openExternal'))
          .map((el) => el.getAttribute('onclick')),
      );
      assert.equal(external.length, 3);
      for (const handler of external) assert.match(handler, /openExternal\("(?:https?:|mailto:)/);
    }),
);
test('manual timer continues across navigation/reload, units convert, reset pauses it', () =>
  withPage(async (page) => {
    await go(page, 'manual');
    await fill(page, { liters: '100', seconds: '60' });
    await page.locator('[data-minutes="true"]').click();
    assert.equal(await page.locator('#seconds').inputValue(), '1');
    await result(page, '144 м³/сут');
    await page.locator('[data-minutes="false"]').click();
    assert.equal(await page.locator('#seconds').inputValue(), '60');
    await page.locator('#timerBtn').click();
    await go(page, 'home');
    assert.equal(await page.evaluate(() => manualTimerRunning), true);
    const before = await page.evaluate(() => manualElapsed());
    await page.waitForFunction((before) => manualElapsed() > before + 150, before);
    await go(page, 'manual');
    await page.waitForFunction(() => document.getElementById('seconds').disabled);
    assert.equal(await page.locator('#timerBtn').textContent(), 'Стоп');
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'manual');
    await page.waitForFunction(() => document.getElementById('seconds').disabled);
    await page.locator('#resetBtn').click();
    assert.equal(await page.evaluate(() => manualTimerRunning), false);
    assert.equal(await page.locator('#seconds').inputValue(), '');
  }));
test('PED selection survives navigation and resets on reload; operator station/mode survives reload', () =>
  withPage(async (page) => {
    await go(page, 'ped');
    await page.locator('#pedDia').waitFor();
    await page.locator('#pedDia').selectOption('95');
    await page.locator('#pedPower').selectOption('16');
    await page.locator('#pedCasing').selectOption('114');
    await page.locator('#pedWall').selectOption('5.2');
    await page.locator('[data-ped]').first().click();
    await fill(page, { pedWork: '50', pedNom: '100' });
    const expected = await page.locator('#pedCalc .value').textContent();
    await go(page, 'home');
    await go(page, 'ped');
    await page.locator('#pedCalc .value').waitFor();
    assert.equal(await page.locator('#pedCalc .value').textContent(), expected);
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'ped');
    await page.locator('#pedDia').waitFor();
    assert.equal(await page.locator('#pedDia').inputValue(), '');
    assert.equal(await page.locator('#pedWork').count(), 0);
    assert.equal(await page.locator('#pedCalc').count(), 0);
    await go(page, 'operators');
    await page.locator('[data-opmode="rich"]').click();
    await fill(page, {
      'op-high': '50',
      'op-low': '40',
      'op-highMinutes': '10',
      'op-lowMinutes': '5',
    });
    await page.locator('#opStation').selectOption('Эталон ЧР');
    await page.locator('#opStart').click();
    await page.locator('#opNext').click();
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'operators');
    await page.locator('#opNext').waitFor();
    assert.ok((await page.locator('h1').textContent()).includes('Эталон ЧР'));
    assert.ok((await page.locator('.subtle').first().textContent()).includes('Шаг 2'));
    await page.locator('.topbar .back').click();
    assert.equal(await page.locator('#opStation').inputValue(), 'Эталон ЧР');
    assert.equal(await page.locator('#op-high').inputValue(), '50');
  }));
test('SKO and tap choices and geometry survive reload; level extension and original density units', () =>
  withPage(async (page) => {
    await go(page, 'sko');
    await page.locator('[data-v="reverse"]').click();
    await page.locator('[data-t="89"]').click();
    await page.locator('#skoCasing').selectOption('168');
    await page.locator('#skoWall').selectOption('8');
    await page.locator('#skoDepth').fill('1000');
    const expected = await page.locator('#liveResult .value').textContent();
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'sko');
    await result(page, expected);
    assert.equal(await page.locator('#skoWall').inputValue(), '8');
    assert.equal(
      await page
        .locator('[data-t="89"]')
        .getAttribute('class')
        .then((x) => x.includes('active')),
      true,
    );
    await go(page, 'tap');
    await page.locator('[data-mode="vfd"]').click();
    await page.locator('[data-mat="al"]').click();
    await fill(page, {
      trIn: '380',
      supplyV: '380',
      motorV: '1000',
      motorI: '20',
      cableL: '1000',
      cableS: '16',
      temp: '20',
      vfdV: '380',
      fmax: '60',
      fnom: '50',
    });
    await page.locator('#filter').check();
    const tap = await page.locator('#liveResult .value').textContent();
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'tap');
    await result(page, tap);
    assert.equal(await page.locator('#filter').isChecked(), true);
    await go(page, 'level');
    await fill(page, { depth: '1000', extension: '20', pz: '10', pd: '20', density: '1' });
    await result(page, '880 м');
    await page.locator('#density').fill('1xyz');
    assert.equal(await page.locator('#liveResult .value').count(), 0);
  }));
test('RPD original example and unsuitable APV cycle can be corrected', () =>
  withPage(async (page) => {
    await go(page, 'rpd');
    await fill(page, {
      rpdCasing: '0.15',
      rpdTubing: '0.073',
      rpdOil: '870',
      rpdWater: '1015',
      rpdWatercut: '80',
      rpdInflow: '17',
      rpdPump: '57',
      rpdIntake: '30',
      rpdRun: '10',
      rpdMaxAccum: '20',
    });
    assert.match(await page.locator('#liveResult .value').textContent(), /Время работы: 8.5 мин/);
    assert.match(
      await page.locator('#liveResult .value').textContent(),
      /Давление отключения: 28.33 ат/,
    );
    await go(page, 'apv');
    await fill(page, {
      operatingRate: '100',
      inflowRate: '50',
      startupMinutes: '10',
      cycleMinutes: '120',
      drainMinutes: '60',
    });
    await result(page, 'Минимально допустимый цикл: 180 мин');
    await page.locator('#useMinimumCycle').click();
    assert.equal(await page.locator('#cycleMinutes').inputValue(), '180');
    assert.match(await page.locator('#liveResult .value').textContent(), /Выбранный цикл подходит/);
  }));
test('VNR zoom/page controls and search survive reload', () =>
  withPage(async (page) => {
    await go(page, 'vnr');
    const reader = page.frameLocator('iframe');
    await reader.locator('#vnr-search').fill('технологическая инструкция');
    await reader.locator('#vnr-next').click();
    await reader.locator('#vnr-zoom-in').click();
    assert.equal(await reader.locator('#vnr-zoom-value').textContent(), '125%');
    await reader.locator('#vnr-page').fill('100');
    await reader.locator('#vnr-page-go').click();
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'vnr');
    await page.frameLocator('iframe').locator('#vnr-search').isEnabled();
    await page.waitForFunction(
      () => document.querySelector('iframe')?.contentDocument.readyState === 'complete',
    );
    assert.equal(
      await page.frameLocator('iframe').locator('#vnr-search').inputValue(),
      'технологическая инструкция',
    );
    assert.match(await page.frameLocator('iframe').locator('#vnr-count').textContent(), /^2\//);
    assert.equal(
      await page.frameLocator('iframe').locator('#vnr-zoom-value').textContent(),
      '125%',
    );
  }));
test('VNR zoom preserves the actual reading location after scrolling, page jumps and search', () =>
  withPage(async (page) => {
    await page.goto(base + '/vnr/');
    await page.locator('#vnr-search').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#vnr-search').disabled);
    const position = (number) =>
      page.evaluate((number) => {
        const p = document.getElementById('page-' + number);
        const line = document.querySelector('.vnr-position').getBoundingClientRect().bottom + 8;
        return (scrollY + line - p.offsetTop) / p.offsetHeight;
      }, number);
    // Ordinary scrolling deliberately leaves the old reader page variable stale.
    await page.evaluate(() => {
      const p = document.getElementById('page-87');
      const line = document.querySelector('.vnr-position').getBoundingClientRect().bottom + 8;
      scrollTo(0, p.offsetTop + p.offsetHeight * 0.37 - line);
    });
    await page.waitForFunction(
      () => document.querySelector('#vnr-position-label').textContent === '87/207',
    );
    const before = await position(87);
    for (const control of [
      '#vnr-zoom-in',
      '#vnr-zoom-in',
      '#vnr-zoom-in',
      '#vnr-zoom-out',
      '#vnr-zoom-out',
    ]) {
      await page.locator(control).click();
      assert.ok(
        Math.abs((await position(87)) - before) < 0.015,
        'same paragraph stays beneath the toolbar',
      );
      assert.equal(await page.locator('#vnr-page').inputValue(), '87');
    }
    await page.locator('#vnr-page').fill('120');
    await page.locator('#vnr-page-go').click();
    const jumped = await position(120);
    await page.locator('#vnr-zoom-in').click();
    assert.ok(Math.abs((await position(120)) - jumped) < 0.015);
    await page.locator('#vnr-search').fill('технологическая инструкция');
    await page.locator('#vnr-next').click();
    const activePage = Number(await page.locator('#vnr-page').inputValue());
    const searchPosition = await position(activePage);
    const count = await page.locator('#vnr-count').textContent();
    await page.locator('#vnr-zoom-out').click();
    assert.ok(Math.abs((await position(activePage)) - searchPosition) < 0.015);
    assert.equal(await page.locator('#vnr-count').textContent(), count);
    assert.ok((await page.locator('.hit.current').count()) > 0);
  }));
test('new shell activation preserves existing VNR, photos and unrelated caches', async () => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      window.registerRealWorker = original;
      navigator.serviceWorker.register = () => Promise.resolve({});
    });
    const page = await context.newPage();
    await page.goto(base);
    await page.locator('#continueFirst').click();
    await page.evaluate(async () => {
      const old = await caches.open('operator-dng-pwa-v21');
      await old.put('old-shell-marker', new Response('old'));
      const unrelated = await caches.open('unrelated-app');
      await unrelated.put('other-marker', new Response('keep'));
      for (const [name, url] of [
        ['operator-dng-vnr-pages-v1', 'vnr/pages/001.jpg'],
        ['operator-dng-photos-v1', 'assets/operators/orion_ramp_01.jpg'],
      ]) {
        const cache = await caches.open(name);
        await cache.put(url, await fetch(url));
      }
      await window.registerRealWorker('sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const keys = await page.evaluate(() => caches.keys());
    assert.ok(!keys.includes('operator-dng-pwa-v21'));
    assert.ok(keys.includes('operator-dng-pwa-v3.0.12'));
    assert.ok(keys.includes('unrelated-app'));
    const present = await page.evaluate(async () => {
      const a = await (await caches.open('operator-dng-vnr-pages-v1')).match('vnr/pages/001.jpg'),
        b = await (
          await caches.open('operator-dng-photos-v1')
        ).match('assets/operators/orion_ramp_01.jpg');
      return a?.ok && b?.ok;
    });
    assert.equal(present, true);
  } finally {
    await context.close();
  }
});
test('blocked storage does not crash startup or calculations and reports history failure', async () => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      for (const key of ['getItem', 'setItem', 'removeItem'])
        Storage.prototype[key] = () => {
          throw new DOMException('Storage unavailable', 'SecurityError');
        };
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.locator('#continueFirst').click();
    await go(page, 'level');
    await fill(page, { depth: '1000', pz: '10', pd: '20', density: '1' });
    await result(page, '900 м');
    assert.ok(await page.locator('#storageNotice').isVisible());
    await go(page, 'history');
    assert.equal(await page.locator('.history-item').count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
test('manual calendar dates save complete interval history and survive reload', () =>
  withPage(async (page) => {
    await go(page, 'manual');
    await page.locator('#manualIntervalMode').check();
    await fill(page, { liters: '100', manualStartDate: '2026-10-18', manualEndDate: '2026-10-19' });
    for (const [id, value] of Object.entries({
      startHours: 23,
      startMinutes: 50,
      endHours: 0,
      endMinutes: 10,
    }))
      await page.evaluate(
        ({ id, value }) => document.querySelector(`#${id} [data-value="${value}"]`).click(),
        { id, value },
      );
    await result(page, '7.2 м³/сут');
    await page.locator('#manualIntervalMode').uncheck();
    await page.locator('#manualIntervalMode').check();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.time-wheel')].every(
        (wheel) =>
          Math.abs(
            wheel.scrollTop -
              Number(wheel.querySelector('[aria-selected="true"]').dataset.value) * 44,
          ) < 2,
      ),
    );
    if (await page.evaluate(() => manualTimerRunning)) await page.locator('#timerBtn').click();
    await page.waitForFunction(() =>
      calculationHistory().some(
        (entry) => entry.method === 'Временной интервал' && entry.result === '7.2 м³/сут',
      ),
    );
    await go(page, 'history');
    assert.match(await page.locator('.history-item .hint').textContent(), /2026-10-18.*2026-10-19/);
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'manual');
    await result(page, '7.2 м³/сут');
    assert.equal(await page.locator('#manualStartDate').inputValue(), '2026-10-18');
    assert.equal(await page.locator('#manualEndDate').inputValue(), '2026-10-19');
  }));
test('history retains older entries beyond 150, paginates and deletes individual records', () =>
  withPage(async (page) => {
    await page.evaluate(() =>
      localStorage.setItem(
        historyKey,
        JSON.stringify(
          Array.from({ length: 151 }, (_, i) => ({
            id: 'saved-' + i,
            title: 'Замер ' + i,
            result: i + ' м³/сут',
            ts: Date.now() - i,
            details: 'Сохранённая запись',
          })),
        ),
      ),
    );
    await go(page, 'history');
    assert.equal(await page.locator('.history-item').count(), 50);
    await page.locator('#moreHistory').click();
    await page.locator('#moreHistory').click();
    await page.locator('#moreHistory').click();
    assert.equal(await page.locator('.history-item').count(), 151);
    await go(page, 'level');
    await fill(page, { depth: '1000', pz: '10', pd: '20', density: '1' });
    await result(page, '900 м');
    await go(page, 'history');
    assert.equal(await page.locator('.history-item').count(), 152);
    await page.locator('[data-history-delete]').first().click();
    assert.equal(await page.evaluate(() => calculationHistory().length), 151);
    assert.equal(
      await page.evaluate(() => calculationHistory().some((entry) => entry.id === 'saved-150')),
      true,
    );
  }));

test('version 3: fifth Technologist tab contains all six Android tools; level units and order match', () =>
  withPage(async (page) => {
    assert.equal(await page.locator('.bottom-nav .nav-btn').count(), 5);
    await page.locator('.bottom-nav button').filter({ hasText: 'Технолог' }).click();
    for (const route of ['rpd', 'flow', 'upr', 'apv', 'sko', 'temperatureSetpoint'])
      assert.equal(await page.locator(`[onclick="go('${route}')"]`).count(), 1);
    await go(page, 'level');
    assert.equal(await page.locator('#densityUnit').count(), 0);
    assert.deepEqual(
      await page.locator('main input').evaluateAll((nodes) => nodes.map((n) => n.id)),
      ['depth', 'pz', 'pd', 'density', 'extension'],
    );
    assert.match(await page.locator('label[for="density"]').textContent(), /г\/см³/);
    await fill(page, { depth: '1000', pz: '10', pd: '20', density: '1', extension: '20' });
    await result(page, '880 м');
    await page.goBack();
    await page.waitForFunction(() => state.route === 'technologist');
    await page.goForward();
    await result(page, '880 м');
  }));

test('manual laps stay on screen; final result saves only on stop without a save button; timer survives reopening', () =>
  withPage(async (page, context) => {
    await go(page, 'manual');
    await fill(page, { liters: '100', seconds: '60' });
    await page.waitForTimeout(2200);
    assert.equal(await page.evaluate(() => calculationHistory().length), 0);
    assert.equal(await page.locator('#lapBtn').isEnabled(), false);
    await page.locator('#timerBtn').click();
    assert.equal(await page.locator('#saveManual').count(), 0);
    const elapsedBeforeLap = await page.evaluate(() => manualElapsed());
    await page.locator('#lapBtn').click();
    assert.ok(
      (await page.evaluate(() => manualElapsed())) >= elapsedBeforeLap,
      'lap must not reset elapsed time',
    );
    assert.match(
      await page.locator('#manualLapList li').first().textContent(),
      /Круг 1:.*100 л.*м³\/сут/,
    );
    assert.equal(await page.locator('#liters').inputValue(), '100');
    assert.equal(await page.evaluate(() => manualTimerRunning), true);
    await page.locator('#liters').fill('150');
    const secondLapStart = await page.evaluate(() => manualElapsed());
    await page.locator('#lapBtn').click();
    assert.ok((await page.evaluate(() => manualElapsed())) >= secondLapStart);
    assert.equal(await page.locator('#liters').inputValue(), '150');
    assert.equal(await page.locator('#manualLapList li').count(), 2);
    assert.equal(await page.evaluate(() => calculationHistory().length), 0);
    await page.locator('#manualIntervalMode').check();
    assert.equal(await page.locator('#manualLaps').isVisible(), false);
    assert.equal(await page.locator('#lapBtn').isVisible(), false);
    assert.equal(await page.locator('#manualLapList li').count(), 2);
    await page.locator('#manualIntervalMode').uncheck();
    assert.equal(await page.locator('#manualLaps').isVisible(), true);
    assert.equal(await page.locator('#manualLapList li').count(), 2);
    assert.ok((await page.evaluate(() => manualElapsed())) >= secondLapStart);
    assert.equal(await page.evaluate(() => calculationHistory().length), 0);
    await page.locator('#timerBtn').click();
    await page.locator('#liters').fill('100');
    await go(page, 'home');
    await page.locator('#manualMini:not([hidden])').waitFor();
    assert.equal(await page.evaluate(() => calculationHistory().length), 0);
    const before = await page.evaluate(() => manualElapsed());
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(base);
    await reopened.locator('.hero').waitFor();
    await reopened.locator('#manualMini:not([hidden])').click();
    await reopened.waitForFunction(() => manualTimerRunning && manualElapsed() > 0);
    assert.ok((await reopened.evaluate(() => manualElapsed())) >= before);
    await reopened.locator('#timerBtn').click();
    assert.equal(await reopened.evaluate(() => calculationHistory().length), 1);
    assert.equal(await reopened.locator('#saveManual').count(), 0);
    await reopened.locator('#timerBtn').click();
    await reopened.locator('#timerBtn').click();
    assert.equal(await reopened.evaluate(() => calculationHistory().length), 1);
    await reopened.locator('#manualIntervalMode').check();
    assert.equal(await reopened.locator('#lapBtn').isEnabled(), false);
    await reopened.close();
  }));

test('manual time readout is large and all three control buttons match on narrow phones', () =>
  withPage(async (page) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await go(page, 'manual');
    const controls = await page.locator('.manual-actions > button').evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node),
          box = node.getBoundingClientRect();
        return { width: box.width, height: box.height, top: box.top, font: style.fontSize };
      }),
    );
    assert.equal(controls.length, 3);
    assert.ok(
      controls.every(
        (control) =>
          Math.abs(control.width - controls[0].width) < 1 &&
          control.height === 46 &&
          Math.abs(control.top - controls[0].top) < 1 &&
          control.font === '15px',
      ),
    );
    assert.equal(
      await page.locator('#seconds').evaluate((node) => getComputedStyle(node).fontSize),
      '42px',
    );
    assert.ok(
      await page.locator('#seconds').evaluate((node) => node.getBoundingClientRect().height >= 84),
    );
    assert.equal(await page.locator('#saveManual').count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#manualIntervalMode').check();
    assert.equal(await page.locator('#lapBtn').isVisible(), false);
    assert.equal(await page.locator('#timerBtn').isVisible(), false);
    await page.locator('#manualIntervalMode').uncheck();
    assert.equal(await page.locator('#lapBtn').isVisible(), true);
    assert.equal(await page.locator('#timerBtn').isVisible(), true);
  }));

test('version 3: wheels select nearest time during scroll, are compact, and highlight stays fixed', () =>
  withPage(async (page) => {
    await go(page, 'manual');
    await page.locator('#manualIntervalMode').check();
    const wheel = page.locator('#startMinutes');
    assert.equal(Math.round((await wheel.boundingBox()).height), 132);
    await wheel.evaluate((el) => {
      el.scrollTop = 20 * 44;
      el.dispatchEvent(new Event('scroll'));
    });
    assert.equal(await wheel.locator('[aria-selected="true"]').getAttribute('data-value'), '20');
    const frame = await page
      .locator('.time-wheel-column')
      .first()
      .evaluate((el) => ({
        height: getComputedStyle(el, '::after').height,
        bottom: getComputedStyle(el, '::after').bottom,
      }));
    assert.deepEqual(frame, { height: '44px', bottom: '44px' });
  }));

test('version 3: VNR slider, persistent bookmarks, duplicate prevention and dismissible download panel', () =>
  withPage(async (page) => {
    await go(page, 'vnr');
    const frame = page.frameLocator('iframe');
    await frame.locator('#vnr-position').waitFor();
    await frame.locator('#vnr-offline-open').click();
    await frame.locator('.vnr-download-close').click();
    assert.equal(await frame.locator('.vnr-offline').isVisible(), false);
    await frame.locator('#vnr-page').fill('80');
    await frame.locator('#vnr-page-go').click();
    await frame.locator('#vnr-bookmarks-toggle').click();
    await frame.locator('#vnr-bookmark-add').click();
    await frame.locator('#vnr-bookmark-add').click();
    assert.equal(await frame.locator('.vnr-bookmark-row').count(), 1);
    await frame.locator('#vnr-bookmarks-close').click();
    await frame.locator('#vnr-position').evaluate((el) => {
      el.value = '1000';
      el.dispatchEvent(new Event('input'));
    });
    await page.waitForFunction(() =>
      document
        .querySelector('iframe')
        .contentDocument.querySelector('#vnr-position-label')
        .textContent.startsWith('207/'),
    );
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'vnr');
    await frame.locator('#vnr-bookmarks-toggle').click();
    assert.equal(await frame.locator('.vnr-bookmark-row').count(), 1);
    await frame.locator('.open-bookmark').click();
    await page.waitForFunction(() =>
      document
        .querySelector('iframe')
        .contentDocument.querySelector('#vnr-position-label')
        .textContent.startsWith('80/'),
    );
    await frame.locator('#vnr-bookmarks-toggle').click();
    await frame.locator('[aria-label="Удалить закладку 80"]').click();
    assert.equal(await frame.locator('.vnr-bookmark-row').count(), 0);
    assert.equal(await frame.locator('.vnr-offline').isVisible(), false);
  }));

test('version 3: station photo download prompt closes and stays dismissed, top button reopens it', () =>
  withPage(async (page) => {
    await page.evaluate(() => go('operators'));
    await page.locator('#opOfflineDialog[open]').waitFor();
    await page.locator('#opOfflineClose').click();
    await go(page, 'home');
    await page.evaluate(() => go('operators'));
    assert.equal(await page.locator('#opOfflineDialog').isVisible(), false);
    await page.locator('#opOfflineOpen').click();
    assert.equal(await page.locator('#opOfflineDownload').isVisible(), true);
    await page.locator('#opOfflineClose').click();
  }));

test('version 3: PED selection moves focus to revealed calculation; assistant topics always open at top', () =>
  withPage(async (page) => {
    await go(page, 'ped');
    await page.locator('#pedDia').selectOption('95');
    await page.locator('#pedPower').selectOption('16');
    await page.locator('#pedCasing').selectOption('114');
    await page.locator('#pedWall').selectOption('5.2');
    await page.locator('[data-ped]').first().click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'pedDetails');
    await page.waitForFunction(
      () => document.getElementById('pedDetails').getBoundingClientRect().top < innerHeight - 150,
    );
    await go(page, 'assistant');
    await page.locator('.assistant-topic').last().click();
    await page.waitForFunction(() => scrollY === 0);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.locator('.back').click();
    await page.waitForFunction(() => scrollY === 0);
    await page.locator('.assistant-topic').first().click();
    await page.waitForFunction(() => scrollY === 0);
  }));

test(
  'version 3: original Android document bookmark JS with simulated native storage',
  {
    skip: !fs.existsSync(
      path.resolve(__dirname, '../../sanich6-android/app/src/main/assets/vnr/reglament.html'),
    ),
  },
  () =>
    withPage(async (page, context) => {
      const androidRoot = path.resolve(__dirname, '../../sanich6-android/app/src/main/assets/vnr');
      // Browser verifies the actual Android HTML; native SharedPreferences and APK require Android tooling.
      const documentFile = path.join(androidRoot, 'reglament.html');
      const script = fs.readFileSync(path.join(androidRoot, 'bookmarks.js'), 'utf8');
      // Real JavascriptInterface is synchronous; simulate the same contract in localStorage across reload.
      await context.addInitScript(() => {
        window.SanichBookmarks = {
          read: () => localStorage.getItem('native_test_bookmarks') || '[]',
          write: (value) => {
            localStorage.setItem('native_test_bookmarks', value);
            return true;
          },
        };
      });
      await page.route('**/android-vnr/reglament.html', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: fs
            .readFileSync(documentFile, 'utf8')
            .replace(
              /<script src="bookmarks.js[^\"]*"><\/script>/,
              '<script src="bookmarks.js"></script>',
            ),
        }),
      );
      await page.route('**/android-vnr/viewer-controls.js', (route) =>
        route.fulfill({
          contentType: 'text/javascript',
          body: fs.readFileSync(path.join(androidRoot, 'viewer-controls.js'), 'utf8'),
        }),
      );
      await page.route('**/android-vnr/bookmarks.js', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: script }),
      );
      await page.route('**/android-vnr/pages/*', (route) =>
        route.fulfill({
          contentType: 'image/jpeg',
          body: fs.readFileSync(
            path.resolve(__dirname, '../vnr/pages', route.request().url().split('/').pop()),
          ),
        }),
      );
      await page.goto('http://sanich-android.test/android-vnr/reglament.html');
      await page.evaluate(() => jumpPage(15));
      await page.locator('#vnr-bookmarks-toggle').click();
      await page.locator('#vnr-bookmark-add').click();
      assert.equal(await page.locator('.vnr-bookmark-row').count(), 1);
      await page.reload();
      await page.locator('#vnr-bookmarks-toggle').click();
      assert.equal(await page.locator('.vnr-bookmark-row').count(), 1);
      await page.locator('.open-bookmark').click();
      await page.waitForFunction(() =>
        document.getElementById('vnr-position-label').textContent.startsWith('15/'),
      );
    }),
);

test('home is compact, product identity is Operator DNG, and technologist tools have one menu location', () =>
  withPage(async (page) => {
    assert.equal(await page.title(), 'Оператор ДНГ');
    assert.equal(
      await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'),
      'Оператор ДНГ',
    );
    const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
    assert.equal(manifest.name, 'Оператор ДНГ');
    assert.equal(manifest.short_name, 'Оператор ДНГ');
    const routes = () =>
      page
        .locator('.menu-card')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute('onclick').match(/go\('([^']+)'\)/)[1]),
        );
    const homeRoutes = await routes();
    assert.deepEqual(homeRoutes, [
      'level',
      'frequency',
      'manual',
      'headAtFrequency',
      'tap',
      'ramp',
      'rich',
      'motorCoefficient',
      'wellPotential',
    ]);
    assert.equal(await page.locator('.hero h1').textContent(), 'Расчёты');
    assert.equal(await page.locator('.hero p, .menu-card p').count(), 0);
    const technologyTab = page.locator('.bottom-nav button').filter({ hasText: 'Технолог' });
    assert.equal(await technologyTab.count(), 1);
    await technologyTab.click();
    const techRoutes = await routes();
    assert.deepEqual(techRoutes, ['rpd', 'flow', 'upr', 'apv', 'sko', 'temperatureSetpoint']);
    assert.equal(techRoutes.filter((route) => homeRoutes.includes(route)).length, 0);
    for (const route of techRoutes) {
      await page.locator(`.menu-card[onclick="go('${route}')"]`).click();
      assert.equal(await page.evaluate(() => state.route), route);
      await page.locator('.back').click();
      assert.equal(await page.evaluate(() => state.route), 'technologist');
    }
  }));

test('VNR position controls hide after idle and return after touch and keyboard input', () =>
  withPage(async (page) => {
    await go(page, 'vnr');
    const frame = page.frameLocator('iframe');
    await frame.locator('#vnr-position').waitFor();
    await frame.locator('#vnr-offline-open').click();
    await frame.locator('.vnr-download-close').click();
    const bar = frame.locator('.vnr-position');
    await frame.locator('.vnr-position-idle').waitFor({ state: 'attached' });
    const before = await bar.boundingBox();
    await frame.locator('#page-1 img').tap({ position: { x: 40, y: 260 } });
    assert.equal(await bar.evaluate((node) => node.classList.contains('vnr-position-idle')), false);
    const after = await bar.boundingBox();
    assert.equal(after.y, before.y);
    await frame.locator('.vnr-position-idle').waitFor({ state: 'attached' });
    await frame.locator('#vnr-position').press('ArrowRight');
    await page.waitForTimeout(1700);
    assert.equal(await bar.evaluate((node) => node.classList.contains('vnr-position-idle')), false);
    await frame.locator('#page-1 img').tap({ position: { x: 40, y: 260 } });
    await frame.locator('.vnr-position-idle').waitFor({ state: 'attached' });
    assert.equal(await frame.locator('#vnr-search').isVisible(), true);
    assert.equal(await frame.locator('#vnr-zoom-in').isVisible(), true);
  }));

test('Android question buttons show formulas and terms, retain inputs and close accessibly', () =>
  withPage(async (page) => {
    const topics = [
      ['level', 1, 'Плотность'],
      ['frequency', 1, 'частота'],
      ['headAtFrequency', 1, 'напор'],
      ['motorCoefficient', 4, 'полюсов'],
      ['manual', 1, 'время'],
      ['flow', 3, 'Vкп'],
      ['tap', 5, 'кабел'],
      ['rpd', 7, 'давление'],
      ['upr', 4, 'потенциал'],
      ['apv', 4, 'потенциал'],
      ['temperatureSetpoint', 3, 'температур'],
      ['wellPotential', 1, 'потенциал'],
      ['ped', 0, 'номинальн'],
    ];
    for (const [route, count, term] of topics) {
      await go(page, route);
      await page.getByRole('button', { name: 'Пояснения и формулы' }).click();
      const dialog = page.getByRole('dialog', { name: 'Как выполняется расчёт' });
      assert.equal(await dialog.isVisible(), true);
      assert.equal(await dialog.locator('math').count(), count);
      assert.match((await dialog.textContent()).toLowerCase(), new RegExp(term.toLowerCase()));
      await dialog.getByRole('button', { name: 'Понятно', exact: true }).click();
      assert.equal(await dialog.count(), 0);
      assert.equal(
        await page.locator('#calculationHelpOpen').evaluate((e) => e === document.activeElement),
        true,
      );
    }
    await go(page, 'level');
    await fill(page, { depth: '1800', pz: '10', pd: '50', density: '0.9' });
    const value = await page.locator('#liveResult').textContent();
    await page.getByRole('button', { name: 'Пояснения и формулы' }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#calculationHelpDialog').count(), 0);
    assert.equal(await page.locator('#depth').inputValue(), '1800');
    assert.equal(await page.locator('#liveResult').textContent(), value);
    await page.setViewportSize({ width: 320, height: 568 });
    await go(page, 'tap');
    await page.getByRole('button', { name: 'Пояснения и формулы' }).click();
    assert.equal(await page.locator('#calculationHelpDialog math mfrac').count(), 4);
    assert.ok(
      await page
        .locator('#calculationHelpDialog')
        .evaluate((e) => e.getBoundingClientRect().width <= innerWidth),
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'Закрыть пояснения' }).click();
    await go(page, 'ramp');
    assert.equal(await page.locator('#calculationHelpOpen').count(), 0);
  }));

test('head at frequency retains data, records one result and uses distinct RICH letters and compass', () =>
  withPage(async (page) => {
    const sizes = await page
      .locator('.menu-card[onclick="go(\'rich\')"] svg text')
      .evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute('font-size'))));
    assert.equal(sizes.length, 2);
    assert.ok(sizes[0] > sizes[1]);
    assert.equal(
      await page
        .locator('.bottom-nav button')
        .filter({ hasText: 'Технолог' })
        .locator('svg path')
        .count(),
      1,
    );
    await go(page, 'headAtFrequency');
    assert.equal(await page.locator('#liveResult .value').count(), 0);
    await fill(page, { passportHead: '2100', workingFrequency: '54' });
    await result(page, '2449 м');
    assert.equal(
      await page.evaluate(
        () => calculationHistory().filter((x) => x.title === 'Напор на частоте').length,
      ),
      1,
    );
    await go(page, 'home');
    await page.evaluate(() => goBack());
    await result(page, '2449 м');
    await page.reload();
    await page.locator('.hero').waitFor();
    await go(page, 'headAtFrequency');
    await result(page, '2449 м');
    assert.equal(await page.locator('#passportHead').inputValue(), '2100');
    await fill(page, { workingFrequency: '0' });
    await result(page, '0 м');
    await fill(page, { workingFrequency: '-1' });
    assert.equal(await page.locator('#liveResult .value').count(), 0);
    await fill(page, { workingFrequency: '50' });
    await result(page, '2100 м');
    await go(page, 'history');
    const entries = await page.evaluate(() =>
      calculationHistory().filter((x) => x.title === 'Напор на частоте'),
    );
    assert.equal(entries[0].result, '2100 м');
    await go(page, 'headAtFrequency');
    await page.locator('#clearHead').click();
    assert.equal(await page.locator('#passportHead').inputValue(), '');
    assert.equal(await page.locator('#workingFrequency').inputValue(), '');
  }));

test('operating modes round work and stop to whole minutes, retain the cycle and save the displayed result', () =>
  withPage(async (page) => {
    for (const mode of ['apv', 'upr']) {
      await go(page, mode);
      const values = {
        operatingRate: '70',
        inflowRate: '24',
        startupMinutes: '20',
        cycleMinutes: '120',
      };
      if (mode === 'apv') values.drainMinutes = '43';
      await fill(page, values);
      const text =
        mode === 'apv'
          ? 'Работа: 61 мин\nОтстой: 59 мин\nВремя слива: 43 мин\nМинимальный цикл: 120 мин\nВыбранный цикл подходит'
          : 'Работа: 61 мин\nОстановка: 59 мин';
      await result(page, text);
      await go(page, 'home');
      await page.evaluate(() => goBack());
      await result(page, text);
      await fill(page, { operatingRate: '100', inflowRate: '50', startupMinutes: '0.5' });
      assert.match(
        await page.locator('#liveResult .value').textContent(),
        /Работа: 61 мин\n(?:Отстой|Остановка): 59 мин/,
      );
      await fill(page, { cycleMinutes: '120.5' });
      assert.match(await page.locator('#liveResult .error').textContent(), /целым числом минут/);
      assert.equal(await page.locator('#liveResult .value').count(), 0);
      if (mode === 'apv') {
        await fill(page, { cycleMinutes: '120', startupMinutes: '0.8', drainMinutes: '59.1' });
        assert.match(
          await page.locator('#liveResult .error').textContent(),
          /После округления отстой меньше/,
        );
      } else {
        await fill(page, { cycleMinutes: '1', startupMinutes: '0', inflowRate: '24' });
        assert.match(await page.locator('#liveResult .error').textContent(), /целыми минутами/);
      }
      await fill(page, values);
      await result(page, text);
    }
    await page.setViewportSize({ width: 320, height: 568 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await go(page, 'history');
    const entries = await page.evaluate(() => calculationHistory());
    for (const [title, label] of [
      ['Перевод ПР в УПР', 'Остановка'],
      ['Перевод УПР в АПВ', 'Отстой'],
    ]) {
      const entry = entries.find((x) => x.title === title);
      assert.ok(entry);
      assert.match(entry.result, new RegExp(`Работа: 61 мин\\n${label}: 59 мин`));
    }
  }));

test('flow selectors list casing, tubing and every wall thickness in ascending numeric order', () =>
  withPage(async (page) => {
    await go(page, 'flow');
    const options = (id) =>
      page.locator(`#${id} option`).evaluateAll((nodes) => nodes.map((n) => Number(n.value)));
    assert.deepEqual(await options('casing'), [139.7, 146, 168, 178]);
    assert.deepEqual(await options('tubing'), [60, 73, 89]);
    await page.locator('#source').selectOption('По геометрии');
    const casings = await options('casingOuter');
    assert.deepEqual(casings, [102, 114, 139.7, 146, 168, 178, 194]);
    assert.deepEqual(await options('tubing'), [60, 73, 89]);
    for (const casing of casings) {
      await page.locator('#casingOuter').selectOption(String(casing));
      const walls = await options('wall');
      assert.ok(walls.length > 0);
      assert.deepEqual(
        walls,
        [...walls].sort((a, b) => a - b),
      );
    }
    await page.locator('#casingOuter').selectOption('139.7');
    await page.locator('#wall').selectOption('9.2');
    await page.locator('#tubing').selectOption('60');
    await go(page, 'home');
    await page.evaluate(() => goBack());
    assert.equal(await page.locator('#casingOuter').inputValue(), '139.7');
    assert.equal(await page.locator('#wall').inputValue(), '9.2');
    assert.equal(await page.locator('#tubing').inputValue(), '60');
  }));

test('manual interval starts with today at both ends in local time and preserves explicitly edited dates on return', () =>
  withPage(
    async (page) => {
      // UTC still says October 24, while the operator's local date is October 25.
      await page.clock.setFixedTime(new Date('2026-10-24T20:30:00Z'));
      await go(page, 'manual');
      await page.locator('#manualIntervalMode').check();
      assert.equal(await page.locator('#manualStartDate').inputValue(), '2026-10-25');
      assert.equal(await page.locator('#manualEndDate').inputValue(), '2026-10-25');
      await page.locator('#manualStartDate').fill('2026-10-23');
      await page.locator('#manualEndDate').fill('2026-10-24');
      await go(page, 'home');
      await go(page, 'manual');
      assert.equal(await page.locator('#manualStartDate').inputValue(), '2026-10-23');
      assert.equal(await page.locator('#manualEndDate').inputValue(), '2026-10-24');
      await page.reload();
      await page.locator('.hero').waitFor();
      await go(page, 'manual');
      assert.equal(await page.locator('#manualStartDate').inputValue(), '2026-10-23');
      assert.equal(await page.locator('#manualEndDate').inputValue(), '2026-10-24');
      await page.locator('#manualIntervalMode').uncheck();
      await page.locator('#manualIntervalMode').check();
      assert.equal(await page.locator('#manualStartDate').inputValue(), '2026-10-23');
      assert.equal(await page.locator('#manualEndDate').inputValue(), '2026-10-24');
      await page.locator('#clear').click();
      assert.equal(await page.locator('#manualStartDate').inputValue(), '2026-10-25');
      assert.equal(await page.locator('#manualEndDate').inputValue(), '2026-10-25');
      // Even a screen kept open across midnight must use the new local day.
      await page.clock.setFixedTime(new Date('2026-10-25T20:30:00Z'));
      await page.locator('#manualIntervalMode').uncheck();
      await page.locator('#manualIntervalMode').check();
      assert.equal(await page.locator('#manualStartDate').inputValue(), '2026-10-26');
      assert.equal(await page.locator('#manualEndDate').inputValue(), '2026-10-26');
      await page.locator('#startDayChoices [data-day="0"]').click();
      assert.equal(await page.locator('#manualStartDate').inputValue(), '2026-10-25');
      assert.equal(await page.locator('#manualEndDate').inputValue(), '2026-10-26');
      await page.locator('#startDayChoices [data-day="1"]').click();
      assert.equal(await page.locator('#manualStartDate').inputValue(), '2026-10-26');
    },
    { timezoneId: 'Asia/Yekaterinburg' },
  ));

test('PED reset clears partial or complete selections and currents while keeping completed history', () =>
  withPage(async (page) => {
    await go(page, 'ped');
    await page.locator('#pedDia').selectOption('95');
    await page.locator('#resetPed').click();
    assert.equal(await page.locator('#pedDia').inputValue(), '');
    assert.equal(await page.locator('#pedPower').count(), 0);
    await page.locator('#pedDia').selectOption('95');
    await page.locator('#pedPower').selectOption('16');
    await page.locator('#pedCasing').selectOption('114');
    await page.locator('#pedWall').selectOption('5.2');
    await page.locator('[data-ped]').first().click();
    await fill(page, { pedWork: '50', pedNom: '100' });
    const expected = await page.locator('#pedCalc .value').textContent();
    const name = await page.locator('#pedDetails h3').textContent();
    await go(page, 'home');
    await go(page, 'ped');
    await page.locator('#pedWork').waitFor();
    assert.equal(await page.locator('#pedWork').inputValue(), '50');
    assert.equal(await page.locator('#pedNom').inputValue(), '100');
    assert.equal(await page.locator('#pedDetails h3').textContent(), name);
    assert.equal(await page.locator('#pedCalc .value').textContent(), expected);
    const historyBeforeReset = await page.evaluate(() => calculationHistory());
    await page.locator('#resetPed').click();
    assert.equal(await page.locator('#pedDia').inputValue(), '');
    for (const id of [
      'pedPower',
      'pedCasing',
      'pedWall',
      'pedDetails',
      'pedCalc',
      'pedWork',
      'pedNom',
    ])
      assert.equal(await page.locator('#' + id).count(), 0, id);
    assert.deepEqual(await page.evaluate(() => calculationHistory()), historyBeforeReset);
    await go(page, 'home');
    await go(page, 'ped');
    assert.equal(await page.locator('#pedDia').inputValue(), '');
    assert.equal(await page.evaluate(() => sessionStorage.getItem(PED_STATE_KEY)), null);
  }));

test('VNR landscape keeps the reading paragraph and zoom, with compact controls and usable document height', () =>
  withPage(async (page) => {
    const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
    assert.equal(manifest.orientation, 'any');
    await go(page, 'vnr');
    const reader = page.frameLocator('iframe');
    await reader.locator('#vnr-offline-open').click();
    await reader.getByRole('button', { name: 'Закрыть загрузку' }).click();
    await reader.locator('#vnr-zoom-in').click();
    await reader.locator('#vnr-zoom-in').click();
    const frame = page.frames().find((f) => f.url().includes('/vnr/index.html'));
    await frame.evaluate(() => {
      const p = document.getElementById('page-87');
      const line = document.querySelector('.vnr-position').getBoundingClientRect().bottom + 8;
      scrollTo(0, p.offsetTop + p.offsetHeight * 0.35 - line);
    });
    const settle = () =>
      frame.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
    await settle();
    const position = () =>
      frame.evaluate(() => {
        const p = document.getElementById('page-87');
        const rect = p.getBoundingClientRect();
        const line = document.querySelector('.vnr-position').getBoundingClientRect().bottom + 8;
        return {
          fraction: (line - rect.top) / rect.height,
          zoom: viewerZoom,
          documentHeight: innerHeight - line,
        };
      });
    const before = await position();
    assert.ok(Math.abs(before.fraction - 0.35) < 0.01);
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 568, height: 320 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await settle();
      const after = await position();
      assert.ok(
        Math.abs(after.fraction - before.fraction) < 0.015,
        JSON.stringify({ viewport, before, after }),
      );
      assert.equal(after.zoom, 1.5);
      if (viewport.width > viewport.height) {
        assert.equal(await page.locator('.bottom-nav').isVisible(), false);
        assert.equal(await page.locator('.topbar .back').isVisible(), true);
        assert.ok(after.documentHeight > viewport.height - 150);
        const controlsFit = await frame.evaluate(() =>
          [
            ...document.querySelectorAll(
              '.vnr-tools button, .vnr-page-tools button, .vnr-position button',
            ),
          ].every((button) => {
            const r = button.getBoundingClientRect();
            return (
              r.left >= 0 && r.right <= document.documentElement.clientWidth + 1 && r.bottom <= 90
            );
          }),
        );
        assert.ok(controlsFit, 'Landscape buttons fit the screen');
      } else assert.equal(await page.locator('.bottom-nav').isVisible(), true);
    }
    await reader.locator('#vnr-search').fill('технологическая инструкция');
    const count = await reader.locator('#vnr-count').textContent();
    await page.setViewportSize({ width: 844, height: 390 });
    await settle();
    assert.equal(await reader.locator('#vnr-count').textContent(), count);
    assert.ok(await reader.locator('.hit.current').count());
    await reader.locator('#vnr-bookmarks-toggle').click();
    assert.equal(await reader.locator('.vnr-bookmarks').isVisible(), true);
    await reader.locator('#vnr-bookmarks-close').click();
  }));
