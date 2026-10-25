// Run after npm run build: exercises all three independently installed editions on one origin.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const built = path.resolve(process.env.PWA_TEST_ROOT || path.join(root, 'dist'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const editionNames = { author: 'Оператор ДНГ', reglament: 'Опер ДНГ рег', bez: 'Опер ДНГ без' };
const authorExtraTitles = ['Запуск скважины ВНР', 'ППД замер давления', 'Остановка водовода зимой', 'Промывка'];
const paragraphs = topic => topic.steps.map((step, i) => topic.preserve ? step : `${i + 1}. ${step}`);
let server, browser, base, official, withoutAssistant;

before(async () => {
  for (const entry of ['index.html', 'reglament/index.html', 'bez/index.html'])
    assert.ok(fs.existsSync(path.join(built, entry)), 'Build all three editions before running: ' + entry);
  server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: path.dirname(built),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const origin = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', code => reject(Error('HTTP server exited: ' + code)));
    server.stdout.on('data', chunk => {
      const match = chunk.toString().match(/port (\d+)/);
      if (match) resolve('http://127.0.0.1:' + match[1]);
    });
  });
  server.stderr.resume();
  base = `${origin}/${path.basename(built)}/`;
  official = base + 'reglament/';
  withoutAssistant = base + 'bez/';
  const executablePath = process.env.CHROMIUM_PATH ||
    (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
});
after(async () => {
  await browser?.close();
  if (server && !server.killed) {
    const closed = once(server, 'exit');
    server.kill();
    await closed;
  }
});
async function withContext(run, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    ...options,
  });
  const errors = [];
  context.on('page', page => {
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
  });
  try {
    await run(context);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
async function openApp(page, url, accept = true) {
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('.hero, #continueFirst'));
  if (accept && await page.locator('#continueFirst').isVisible())
    await page.locator('#continueFirst').click();
  if (accept) await page.locator('.hero').waitFor();
}
async function go(page, route) {
  await page.evaluate(route => go(route), route);
  if (await page.locator('#opOfflineClose').isVisible())
    await page.locator('#opOfflineClose').click();
}
async function calculateHead(page) {
  await go(page, 'headAtFrequency');
  await page.locator('#passportHead').fill('2100');
  await page.locator('#workingFrequency').fill('54');
  await page.waitForFunction(() => document.querySelector('#liveResult .value')?.textContent === '2449 м');
}
async function ownWorker(page, expectedBase) {
  assert.equal(await page.evaluate(async () => (await DngOfflineWorker.ready()).scriptURL), expectedBase + 'sw.js');
  await page.waitForFunction(expected => navigator.serviceWorker.controller?.scriptURL === expected,
    expectedBase + 'sw.js');
  const registration = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration(location.href);
    return { scope: registration?.scope, script: registration?.active?.scriptURL };
  });
  assert.deepEqual(registration, { scope: expectedBase, script: expectedBase + 'sw.js' });
}
async function showReaderControls(page) {
  // A real wheel gesture inside the document reveals the auto-hiding toolbar.
  const box = await page.locator('iframe').boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(200, box.height - 20));
  await page.mouse.wheel(0, 1);
  await page.frameLocator('iframe').locator('.vnr-position:not(.vnr-position-idle)').waitFor();
  // Enter keyboard interaction so focus keeps the toolbar visible while images settle.
  // Shift changes neither the slider value nor the document's reading position.
  const slider = page.frameLocator('iframe').locator('#vnr-position');
  await slider.focus();
  await slider.press('Shift');
}
async function reader(page) {
  await go(page, 'vnr');
  const frame = page.frameLocator('iframe');
  await frame.locator('#vnr-position').waitFor();
  await showReaderControls(page);
  // Explicitly dismiss the prompt: the initial asynchronous status may reveal it
  // after the toolbar is ready, so an isVisible() snapshot is insufficient.
  await frame.locator('#vnr-offline-open').click();
  await frame.locator('.vnr-download-close').click();
  return frame;
}
async function addBookmark(page, number) {
  const frame = await reader(page);
  await frame.locator('#vnr-page').fill(String(number));
  await frame.locator('#vnr-page-go').click();
  await showReaderControls(page);
  await frame.locator('#vnr-bookmarks-toggle').click();
  await frame.locator('#vnr-bookmark-add').click();
  assert.equal(await frame.locator('.vnr-bookmark-row').count(), 1);
  await frame.locator('#vnr-bookmarks-close').click();
}

test('three editions have separate install identities, correct assistant access and identical calculations', () =>
  withContext(async context => {
    const authorPage = await context.newPage();
    await openApp(authorPage, base);
    await ownWorker(authorPage, base);
    const formalPage = await context.newPage();
    await openApp(formalPage, official);
    await ownWorker(formalPage, official);
    const withoutPage = await context.newPage();
    await openApp(withoutPage, withoutAssistant);
    await ownWorker(withoutPage, withoutAssistant);
    const identities = [];
    for (const [page, url, edition] of [
      [authorPage, base, 'author'], [formalPage, official, 'reglament'],
      [withoutPage, withoutAssistant, 'bez'],
    ]) {
      assert.equal(await page.locator('html').getAttribute('data-edition'), edition);
      const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
      identities.push(new URL(manifest.id, url).href);
      assert.equal(new URL(manifest.start_url, url).href, url);
      assert.equal(new URL(manifest.scope, url).href, url);
      assert.equal(manifest.name, editionNames[edition]);
      assert.equal(await page.title(), editionNames[edition]);
      await calculateHead(page);
      await go(page, 'assistant');
      assert.equal(await page.locator('.assistant-topic').count(), edition === 'bez' ? 0 : 12);
    }
    assert.equal(new Set(identities).size, 3);
    const original = await authorPage.evaluate(() => assistantTopics.map(t => ({ title: t.title, steps: t.steps, preserve: t.preserve })));
    const formal = await formalPage.evaluate(() => assistantTopics.map(t => ({ title: t.title, steps: t.steps, preserve: t.preserve })));
    assert.deepEqual(formal.map(t => t.title), original.map(t => t.title));
    assert.notDeepEqual(formal, original);
    assert.equal(await authorPage.locator('script[src*="assistant-reglament-data"]').count(), 0);
    assert.equal(await formalPage.locator('script[src*="assistant-reglament-data"]').count(), 1);
    assert.equal(await formalPage.locator('script[src*="assistant-author-extra"]').count(), 1);
    assert.equal(fs.existsSync(path.join(built, 'reglament/js/assistant-author-extra.js')), true);
    assert.deepEqual(
      await formalPage.evaluate(() => DNG_REG_AUTHOR_EXTRA.map(t => t.title).sort()),
      [...authorExtraTitles].sort(),
    );
    for (const [page, directory] of [[authorPage, ''], [withoutPage, 'bez']]) {
      assert.equal(await page.locator('script[src*="assistant-author-extra"]').count(), 0);
      assert.equal(fs.existsSync(path.join(built, directory, 'js/assistant-author-extra.js')), false);
    }
    assert.equal(await withoutPage.locator('script[src*="assistant-reglament-data"]').count(), 0);
    assert.equal(fs.existsSync(path.join(built, 'bez/js/assistant-reglament-data.js')), false);
    assert.equal(await withoutPage.evaluate(() => assistantTopics.length), 0);
    assert.equal(await withoutPage.evaluate(() => state.route), 'reference');
    assert.doesNotMatch(await withoutPage.locator('main').textContent(),
      /Аварийные остановки и нештатные режимы/);
    assert.ok(await withoutPage.locator('.menu-card').count() > 0,
      'Redirect from the removed assistant must show a usable reference screen');
    for (let index = 0; index < formal.length; index++) {
      await formalPage.evaluate(index => { state.assistantIndex = index; renderAssistant(); }, index);
      const text = await formalPage.locator('main').textContent();
      assert.ok(text.trim().length > 100, formal[index].title);
      assert.doesNotMatch(text, /материал — черновик|в черновике|для обсуждения|Источники:|PDF[- ]страниц/i);
      assert.equal(await formalPage.locator('main a, main .assistant-sources').count(), 0);
      assert.deepEqual(
        await formalPage.locator('.assistant-reglament p').allTextContents(),
        paragraphs(formal[index]),
        'Documentary paragraphs remain complete for ' + formal[index].title,
      );
      const authorBlock = formalPage.locator('.assistant-author');
      if (authorExtraTitles.includes(formal[index].title)) {
        const source = original.find(topic => topic.title === formal[index].title);
        assert.equal(await authorBlock.locator('h2').textContent(), 'Порядок работы');
        assert.equal(await formalPage.locator('.assistant-reglament h2').textContent(), 'Требования регламента');
        assert.deepEqual(await authorBlock.locator('p').allTextContents(), paragraphs(source),
          'Author text and paragraph order are preserved for ' + source.title);
        assert.equal(await authorBlock.evaluate(node => !!(node.compareDocumentPosition(
          document.querySelector('.assistant-reglament')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
      } else {
        assert.equal(await authorBlock.count(), 0, 'No added author block for ' + formal[index].title);
      }
    }
    for (const edition of ['reglament', 'bez'])
      assert.deepEqual(
        fs.readFileSync(path.join(built, 'js/math.js')),
        fs.readFileSync(path.join(built, edition, 'js/math.js')),
        'All editions must ship the same calculation implementation',
      );
  }));

test('privacy, history, stopwatch and bookmarks remain independent across all three editions on one origin', () =>
  withContext(async context => {
    const authorPage = await context.newPage();
    await openApp(authorPage, base);
    await calculateHead(authorPage);
    assert.equal(await authorPage.evaluate(() => calculationHistory().length), 1);
    const formalPage = await context.newPage();
    const withoutPage = await context.newPage();
    for (const [page, url] of [[formalPage, official], [withoutPage, withoutAssistant]]) {
      await openApp(page, url, false);
      assert.equal(await page.locator('#continueFirst').isVisible(), true,
        'Accepting privacy in another edition must not dismiss this notice');
      assert.equal(await page.evaluate(() => hasPrivacySeen()), false);
      await page.locator('#continueFirst').click();
      assert.equal(await page.evaluate(() => calculationHistory().length), 0);
      await calculateHead(page);
    }
    await go(formalPage, 'history');
    formalPage.once('dialog', dialog => dialog.accept());
    await formalPage.locator('#clearHistory').click();
    assert.equal(await formalPage.evaluate(() => calculationHistory().length), 0);
    assert.equal(await authorPage.evaluate(() => calculationHistory().length), 1);
    assert.equal(await withoutPage.evaluate(() => calculationHistory().length), 1);

    await go(authorPage, 'manual');
    await authorPage.locator('#liters').fill('100');
    await authorPage.locator('#seconds').fill('60');
    await authorPage.locator('#timerBtn').click();
    for (const [page, volume, seconds] of [[formalPage, '50', '120'], [withoutPage, '25', '180']]) {
      await go(page, 'manual');
      assert.equal(await page.locator('#liters').inputValue(), '');
      assert.equal(await page.locator('#seconds').inputValue(), '');
      assert.equal(await page.evaluate(() => manualTimerRunning), false);
      await page.locator('#liters').fill(volume);
      await page.locator('#seconds').fill(seconds);
      await page.locator('#timerBtn').click();
      await page.locator('#timerBtn').click();
      await page.locator('#resetBtn').click();
      assert.equal(await authorPage.evaluate(() => manualTimerRunning), true);
      assert.ok(await authorPage.evaluate(() => manualElapsed() >= 60000));
      assert.equal(await authorPage.locator('#liters').inputValue(), '100');
    }
    assert.equal(await formalPage.locator('#liters').inputValue(), '50');

    await addBookmark(authorPage, 80);
    await addBookmark(formalPage, 112);
    await addBookmark(withoutPage, 140);
    const authorFrame = authorPage.frameLocator('iframe');
    const formalFrame = formalPage.frameLocator('iframe');
    const withoutFrame = withoutPage.frameLocator('iframe');
    for (const [page, frame, number] of [[authorPage, authorFrame, 80], [formalPage, formalFrame, 112], [withoutPage, withoutFrame, 140]]) {
      await showReaderControls(page);
      await frame.locator('#vnr-bookmarks-toggle').click();
      assert.match(await frame.locator('.open-bookmark').textContent(), new RegExp('^' + number + '\\.'));
    }
    await formalFrame.locator('[aria-label="Удалить закладку 112"]').click();
    assert.equal(await formalFrame.locator('.vnr-bookmark-row').count(), 0);
    assert.equal(await authorFrame.locator('.vnr-bookmark-row').count(), 1);
    assert.equal(await withoutFrame.locator('.vnr-bookmark-row').count(), 1);
    for (const [page, volume] of [[formalPage, '50'], [withoutPage, '25']]) {
      await page.reload();
      await page.locator('.hero').waitFor();
      await go(page, 'manual');
      assert.equal(await page.evaluate(() => manualTimerRunning), false);
      assert.equal(await page.locator('#liters').inputValue(), volume);
      assert.equal(await authorPage.evaluate(() => manualTimerRunning), true);
    }
  }));

test('three workers preserve each other’s caches and serve their own edition and downloaded material offline', () =>
  withContext(async context => {
    const authorPage = await context.newPage();
    // A plain JSON page lets us seed previous child caches before the parent activates.
    await authorPage.goto(base + 'manifest.webmanifest');
    const childCaches = ['reglament', 'bez'].map(edition => `operator-dng-${edition}-pwa-v${version}`);
    await authorPage.evaluate(async names => {
      for (const name of names)
        await (await caches.open(name)).put('keep-child-marker', new Response('keep child'));
    }, childCaches);
    await openApp(authorPage, base);
    await ownWorker(authorPage, base);
    for (const cacheName of childCaches) {
      const preserved = await authorPage.evaluate(async name =>
        !!await (await caches.open(name)).match('keep-child-marker'), cacheName);
      assert.equal(preserved, true, 'Parent activation must preserve ' + cacheName);
    }
    const formalPage = await context.newPage();
    await openApp(formalPage, official);
    await ownWorker(formalPage, official);
    const withoutPage = await context.newPage();
    await openApp(withoutPage, withoutAssistant);
    await ownWorker(withoutPage, withoutAssistant);
    for (const page of [authorPage, formalPage, withoutPage]) {
      await page.evaluate(async () => {
        for (const asset of ['vnr/pages/080.jpg', 'assets/operators/orion_ramp_01.jpg']) {
          const response = await fetch(asset);
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
            throw Error('Missing offline material: ' + asset);
          const image = await createImageBitmap(await response.blob());
          image.close();
        }
      });
      await go(page, 'vnr');
      await page.frameLocator('iframe').locator('#vnr-position').waitFor();
      await go(page, 'home');
    }
    const keys = await authorPage.evaluate(() => caches.keys());
    for (const edition of ['', 'reglament-', 'bez-'])
      for (const name of [
        `operator-dng-${edition}pwa-v${version}`,
        `operator-dng-${edition}vnr-pages-v1`,
        `operator-dng-${edition}photos-v1`,
      ]) assert.ok(keys.includes(name), name);
    assert.equal(await authorPage.evaluate(async children => {
      const cache = await caches.open(`operator-dng-pwa-v${APP_VERSION}`);
      return (await cache.keys()).some(request => children.some(child => request.url.startsWith(child)));
    }, [official, withoutAssistant]), false, 'Parent worker must not intercept and cache either child');

    const washAuthor = await authorPage.evaluate(() => {
      const topic = assistantTopics.find(topic => topic.title === 'Промывка');
      return topic.steps.map((step, i) => topic.preserve ? step : `${i + 1}. ${step}`);
    });
    await context.setOffline(true);
    for (const [page, edition] of [[authorPage, 'author'], [formalPage, 'reglament'], [withoutPage, 'bez']]) {
      await page.reload();
      await page.locator('.hero').waitFor();
      assert.equal(await page.locator('html').getAttribute('data-edition'), edition);
      await calculateHead(page);
      await go(page, 'assistant');
      if (edition === 'bez') {
        assert.equal(await page.evaluate(() => state.route), 'reference');
        assert.equal(await page.locator('.assistant-topic').count(), 0);
        assert.doesNotMatch(await page.locator('main').textContent(), /Аварийные остановки и нештатные режимы/);
      } else {
        await page.locator('.assistant-topic').first().click();
        assert.ok((await page.locator('main').textContent()).trim().length > 100);
        if (edition === 'reglament') {
          await page.evaluate(() => {
            state.assistantIndex = null;
            renderAssistant();
          });
          await page.locator('.assistant-topic').filter({ hasText: /^Промывка/ }).click();
          assert.deepEqual(await page.locator('.assistant-author p').allTextContents(), washAuthor);
          assert.ok(await page.locator('.assistant-reglament p').count() > 0);
        }
      }
      const frame = await reader(page);
      assert.equal(await frame.locator('.page').count(), 207);
      const decoded = await page.evaluate(async () => {
        for (const asset of ['vnr/pages/080.jpg', 'assets/operators/orion_ramp_01.jpg']) {
          const response = await fetch(asset);
          if (!response.ok) return false;
          const image = await createImageBitmap(await response.blob());
          if (!image.width || !image.height) return false;
          image.close();
        }
        return true;
      });
      assert.equal(decoded, true);
    }
  }));

test('missing documentary assistant data shows a loading error instead of author instructions', () =>
  withContext(async context => {
    let blockedRequests = 0;
    await context.route(/\/reglament\/js\/assistant-reglament-data\.js(?:\?|$)/, route => {
      blockedRequests++;
      return route.abort('failed');
    });
    const page = await context.newPage();
    await openApp(page, official);
    assert.ok(blockedRequests > 0, 'The documentary data request must actually fail');
    assert.deepEqual(await page.evaluate(() => DNG_REG_AUTHOR_EXTRA.map(topic => topic.title).sort()),
      [...authorExtraTitles].sort(), 'Author additions load successfully despite missing documentary data');
    await go(page, 'assistant');
    assert.match(await page.locator('main [role="status"]').textContent(),
      /Не удалось загрузить инструкции/);
    assert.equal(await page.locator('.assistant-topic').count(), 0);
    assert.equal(await page.locator('main .ref-text').count(), 0);
    assert.equal(await page.locator('.assistant-author, .assistant-reglament').count(), 0);
    assert.doesNotMatch(await page.locator('main').textContent(),
      /Назначение: корректное определение обводнённости|В черновике|Выберите ситуацию/i);
  }, { serviceWorkers: 'block' }));

test('detailed RPD question appears only in the reglament edition, preserves inputs and result, fits a narrow phone and works offline', () =>
  withContext(async context => {
    const values = {
      rpdCasing: '0.150', rpdTubing: '0.073', rpdOil: '870', rpdWater: '1015',
      rpdWatercut: '80', rpdInflow: '17', rpdPump: '57', rpdIntake: '30',
      rpdRun: '10', rpdMaxAccum: '20',
    };
    let formalPage;
    for (const [url, edition] of [[base, 'author'], [official, 'reglament'], [withoutAssistant, 'bez']]) {
      const page = await context.newPage();
      await page.setViewportSize({ width: 320, height: 844 });
      await openApp(page, url);
      await ownWorker(page, url);
      await go(page, 'rpd');
      for (const [id, value] of Object.entries(values)) await page.locator('#' + id).fill(value);
      await page.waitForFunction(() => document.querySelector('#liveResult .value')?.textContent.includes('28.33'));
      const resultBefore = await page.locator('#liveResult .value').textContent();
      assert.match(resultBefore, /Время работы: 8\.5 мин/);
      const inputSnapshot = () => page.locator('main input').evaluateAll(inputs =>
        Object.fromEntries(inputs.map(input => [input.id, input.value])));
      const fieldsBefore = await inputSnapshot();
      await page.locator('#calculationHelpOpen').click();
      const dialog = page.locator('#calculationHelpDialog');
      await dialog.waitFor();
      assert.equal(await dialog.locator('math').count(), edition === 'reglament' ? 12 : 7);
      assert.equal(await dialog.locator('.help-step').count(), edition === 'reglament' ? 11 : 0);
      assert.equal(await dialog.locator('#rpd-time-explanation').count(), 0);
      assert.doesNotMatch(await dialog.innerText(), /Откуда брать|Если значение не задано, его нужно уточнить у специалиста/);
      const fits = await dialog.evaluate(node => {
        const rect = node.getBoundingClientRect();
        const body = node.querySelector('.help-body');
        return rect.left >= -1 && rect.right <= innerWidth + 1 &&
          body.scrollWidth <= body.clientWidth + 1;
      });
      assert.equal(fits, true, edition + ': help must fit within a 320px phone');
      if (edition === 'reglament') {
        formalPage = page;
        assert.equal(await dialog.locator('.help-section h3').first().innerText(), 'Что вводим в расчёт');
        assert.equal(await dialog.locator('.help-step .help-example').count(), 11);
        const text = await dialog.innerText();
        for (const expression of [/10\s*мин/, /8[,.]5\s*мин/, /20\s*мин/, /28[,.]33/, /30\s*ат/,
          /236(?:[,.]\d+)?\s*л/, /336(?:[,.]\d+)?\s*л/]) assert.match(text, expression);
        assert.match(text, /Верхнюю границу этот калькулятор не подбирает самостоятельно/);
        assert.match(text, /равной введённому проектному давлению/);
        assert.match(text, /236\s*л\s*— убыль накопленного запаса, а не вся поданная насосом жидкость/);
      }
      await dialog.locator('#calculationHelpDone').click();
      assert.equal(await page.locator('#calculationHelpDialog').count(), 0);
      assert.deepEqual(await inputSnapshot(), fieldsBefore);
      assert.equal(await page.locator('#liveResult .value').textContent(), resultBefore);
    }
    await context.setOffline(true);
    await formalPage.reload();
    await formalPage.locator('.hero').waitFor();
    await go(formalPage, 'rpd');
    assert.equal(await formalPage.locator('#rpdRun').inputValue(), '10');
    await formalPage.locator('#calculationHelpOpen').click();
    const offlineDialog = formalPage.locator('#calculationHelpDialog');
    assert.equal(await offlineDialog.locator('.help-step').count(), 11);
    assert.equal(await offlineDialog.locator('math').count(), 12);
    assert.equal(await offlineDialog.locator('#rpd-time-explanation').count(), 0);
    assert.doesNotMatch(await offlineDialog.innerText(), /Откуда брать/);
    assert.match(await offlineDialog.innerText(), /28[,.]33/);
    await offlineDialog.locator('#calculationHelpDone').click();
    assert.match(await formalPage.locator('#liveResult .value').textContent(), /Время работы: 8\.5 мин/);
  }));
