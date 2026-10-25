function refCard(icon, title, subtitle, action) {
  return `<div class="card menu-card pressable" role="button" tabindex="0" onclick="${action}"><div class="emoji">${iconSvg(icon)}</div><div class="grow"><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div><div class="chev">›</div></div>`;
}
function openRefInfo(title, text) {
  state.refInfo = { title, text };
  go('refinfo');
}
function renderRefInfo() {
  const x = state.refInfo || { title: 'Справочник', text: '' };
  app.innerHTML = screen(
    `${topbarTo(x.title)}<main class="content"><div class="card ref-text">${esc(x.text).replace(/\n/g, '<br>')}</div></main>`,
    'reference',
  );
}

const referenceInfo = {
  pedLowFlow: {
    title: 'Работа ПЭД при недостаточном притоке',
    text: 'До 32 кВт включительно:\nне более 2 часов работы + 1,5 часа охлаждения.\n\nБолее 32 до 45 кВт включительно:\nне более 1 часа работы + 1,5 часа охлаждения.\n\nСвыше 45 кВт:\nне более 30 минут работы + 1,5 часа охлаждения.',
  },
  pedTemp: {
    title: 'Температурные группы ПЭД',
    text: 'Д1 (первая группа) — до 120 °C.\n\nД2 (вторая группа) — до 150 °C.\n\nД3 (третья группа) — до 170 °C.',
  },
  zsp: {
    title: 'Уставки ЗСП',
    text: 'Загрузка ПЭД 70% и более — 85–88%.\n\nЗагрузка ПЭД от 50 до 70% — 90–92%.\n\nЗагрузка ПЭД менее 50% — 92–95%.',
  },
  vnr: {
    title: 'Данные при передаче запуска ВНР',
    get text() {
      return vnrText;
    },
  },
};
function openRefKey(key) {
  const x = referenceInfo[key];
  if (!x) return;
  state.refInfo = { title: x.title, text: x.text };
  go('refinfo');
}

async function renderVnr() {
  app.innerHTML = screen(
    `${topbarTo('Регламент ВНР')}<main class="content" id="vnrAvailability" role="status">Проверка доступности регламента…</main>`,
    'reference',
  );
  app.querySelector('.screen').classList.add('vnr-screen');
  const host = document.getElementById('vnrAvailability');
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('vnr/index.html', { signal: controller.signal });
    if (!response.ok) throw Error('HTTP ' + response.status);
    if (!host.isConnected) return;
    host.className = 'vnr-host';
    host.removeAttribute('role');
    host.innerHTML =
      '<iframe src="vnr/index.html" title="Регламент ВНР, 207 страниц" loading="eager" referrerpolicy="same-origin"></iframe>';
  } catch {
    if (host.isConnected)
      host.textContent =
        'Регламент ВНР недоступен. Подключитесь к интернету, откройте документ и скачайте его для офлайн-доступа.';
  } finally {
    clearTimeout(timeout);
  }
}
function renderReference() {
  app.innerHTML = screen(
    `${topbar('Справочник')}<main class="content stack">
${refCard('📖', 'Регламент ВНР', 'Полный документ: 207 страниц, ссылки и поиск', "go('vnr')")}
${refCard('pedCooling', 'Необходимый приток для охлаждения ПЭД', 'Расчёт притока при номинальной и фактической загрузке', "go('ped')")}
${refCard('⏱', 'Работа ПЭД при недостаточном притоке', 'Допустимое время работы и охлаждения', "openRefKey('pedLowFlow')")}
${refCard('🌡', 'Температурные группы ПЭД', 'Допустимая температура пластовой жидкости', "openRefKey('pedTemp')")}
${refCard('zsp', 'Уставки защиты от срыва подачи', 'Рекомендуемые значения ЗСП по загрузке ПЭД', "openRefKey('zsp')")}
${APP_EDITION === 'bez' ? '' : refCard('⚠', 'Аварийные остановки и нештатные режимы', 'Алгоритмы действий по производственным ситуациям', "go('assistant')")}
${refCard('ℹ', 'Данные при передаче запуска ВНР', 'Справочная информация для передачи запуска на пульт', "openRefKey('vnr')")}
${refCard('pipeLarge', 'Обсадные трубы — ГОСТ 632-80', 'Диаметры ЭК, толщины стенок и внутренние диаметры', "go('casingReference')")}
${refCard('pipeSmall', 'НКТ — ГОСТ 633-80', 'НКТ 60, 73, 89 мм: стенки и внутренние диаметры', "go('tubingReference')")}
${refCard('sko', 'Соляно-кислотная обработка УЭЦН', 'Формулы, объёмы, ограничения и критерии СКО', "go('skoref')")}
${refCard('ⓘ', 'О приложении', 'Версия, сведения и политика конфиденциальности', "go('about')")}
<div class="install-note"><b>Установка на iPhone:</b> Safari → «Поделиться» → «На экран Домой». После первой полной загрузки приложение работает офлайн.</div>
</main>`,
    'reference',
  );
}

function renderPipes() {
  const tubing = state.pipeType === 'tubing';
  const data = tubing ? tubingGost633 : casingGost632Full;
  const title = tubing ? 'НКТ' : 'Обсадные трубы';
  const standard = tubing
    ? 'ГОСТ 633-80 — трубы насосно-компрессорные и муфты к ним. Для НКТ 60, 73 и 89 мм показаны наружный диаметр, толщины стенок и внутренний диаметр.'
    : 'ГОСТ 632-80 — трубы обсадные и муфты к ним. В справочнике приведены используемые в приложении ЭК 114–194 мм; 219 мм не включена.';
  app.innerHTML = screen(
    `${topbarTo(title)}<main class="content stack"><div class="card"><b>${standard}</b></div>${Object.entries(
      data,
    )
      .map(
        ([nom, p]) =>
          `<div class="card pipe-card"><h3>${nom} мм</h3>${p.walls.map((w) => `<div class="pipe-row"><span>Стенка ${fmt(w, 1)} мм</span><b>Dвн ${fmt(p.outside - 2 * w, 1)} мм</b></div>`).join('')}</div>`,
      )
      .join('')}</main>`,
    'reference',
  );
}
