// Ported from the supplied Android part01. See ANDROID_PARITY_RU.md.
function engineeringNumber(value) {
  return num(value);
}
function renderMotorCoefficient() {
  const title = 'Коэффициент двигателя 2А';
  app.innerHTML = screen(`${topbar(title)}<main class="content stack">
    ${field('motorRpm', 'Паспортные обороты, об/мин')}
    ${field('motorPoles', 'Число полюсов 2p', 'value="2"')}
    <div id="motorCoefficientResult" class="card" role="status"></div>
    <label class="switchline card"><span>Станция → обычная частота</span><input id="motorReverse" type="checkbox"></label>
    <div class="field"><label id="motorFrequencyLabel" for="motorFrequency">Обычная частота, Гц</label><input id="motorFrequency" inputmode="decimal" autocomplete="off"></div>
    <button class="btn secondary full" id="motorSwap" disabled>Поменять местами ↔</button>
    <div id="liveResult">${resultCard('Частота для станции', '', 'Введите параметры')}</div>
    <p class="hint">КФ = n × (2p / 2) / 3000. Перед изменением частоты сверяйте допустимый диапазон с паспортом двигателя и настройками станции.</p>
  </main>`);
  const byId = (id) => document.getElementById(id);
  let calculation = null;
  function calc() {
    const rpm = engineeringNumber(byId('motorRpm').value),
      poles = engineeringNumber(byId('motorPoles').value),
      frequency = engineeringNumber(byId('motorFrequency').value),
      reverse = byId('motorReverse').checked;
    calculation = DngMath.motorCoefficient(rpm, poles, frequency, reverse);
    byId('motorFrequencyLabel').textContent = reverse
      ? 'Частота станции, Гц'
      : 'Обычная частота, Гц';
    byId('motorCoefficientResult').textContent = calculation
      ? `Базовая частота: ${fmt(calculation.base)} Гц; КФ=${fmt(calculation.coefficient)}`
      : 'Укажите положительные обороты и чётное число полюсов (2, 4, 6…).';
    const converted = calculation?.converted;
    byId('motorSwap').disabled = converted === null || converted === undefined;
    setResult(
      reverse ? 'Обычная частота' : 'Частота для станции',
      converted !== null && converted !== undefined ? `${fmt(converted)} Гц` : '',
      'Введите корректную частоту от 0 Гц',
    );
    if (calculation)
      state.last = {
        title,
        method: 'Расчёт',
        result:
          `КФ=${fmt(calculation.coefficient)}` +
          (converted === null
            ? ''
            : `; ${reverse ? 'Обычная' : 'Частота станции'}=${fmt(converted)} Гц`),
        details:
          `Обороты=${rpm} об/мин; полюсов=${poles}` +
          (converted === null ? '' : `; входная частота=${frequency} Гц`),
      };
  }
  bind(['motorRpm', 'motorPoles', 'motorFrequency', 'motorReverse'], calc);
  byId('motorSwap').onclick = () => {
    if (calculation?.converted === null || !calculation) return;
    byId('motorFrequency').value = fmt(calculation.converted);
    byId('motorReverse').checked = !byId('motorReverse').checked;
    calc();
    snapshotRoute();
  };
  calc();
}
function renderTemperatureSetpoint() {
  const title = 'Уставка температуры ТМС';
  app.innerHTML = screen(`${topbar(title)}<main class="content stack">
    <p class="hint">После выхода на установившийся режим. Уставка = меньшее из Tраб × 1,05 и Tмакс × 0,85.</p>
    ${field('workingTemperature', 'Рабочая температура Tраб, °C')}
    <div class="field"><label for="temperatureGroup">Группа исполнения двигателя</label><select id="temperatureGroup"><option value="Д1">Д1 — 120 °C</option><option value="Д2">Д2 — 150 °C</option><option value="Д3">Д3 — 170 °C</option></select></div>
    <div id="liveResult">${resultCard(title, '', 'Введите рабочую температуру')}</div>
  </main>`);
  function calc() {
    const working = engineeringNumber(document.getElementById('workingTemperature').value),
      group = document.getElementById('temperatureGroup').value;
    const value = DngMath.temperatureSetpoint(working, group);
    setResult(
      title,
      value === null ? '' : `${fmt(value)} °C`,
      'Введите рабочую температуру от 0 °C',
    );
    if (value !== null)
      state.last = {
        title,
        method: 'Расчёт',
        result: `${fmt(value)} °C`,
        details: `Tраб=${working} °C; группа=${group}; Tмакс=${{ Д1: 120, Д2: 150, Д3: 170 }[group]} °C`,
      };
  }
  bind(['workingTemperature', 'temperatureGroup'], calc);
}
function renderWellPotential() {
  const title = 'Потенциал скважины';
  app.innerHTML = screen(`${topbar(title)}<main class="content stack">
    <p class="hint">Ожидаемая суточная добыча с учётом цикла и задержки появления подачи.</p>
    ${field('potentialRate', 'Непрерывный дебит, м³/сут')}
    ${field('potentialOn', 'Время работы, мин')}
    ${field('potentialOff', 'Время простоя, мин')}
    ${field('potentialDelay', 'Задержка подачи после запуска, мин')}
    <div id="liveResult">${resultCard('Ожидаемая добыча', '', 'Введите параметры')}</div>
  </main>`);
  function calc() {
    const q = engineeringNumber(document.getElementById('potentialRate').value),
      on = engineeringNumber(document.getElementById('potentialOn').value),
      off = engineeringNumber(document.getElementById('potentialOff').value),
      delayText = document.getElementById('potentialDelay').value;
    const delay = delayText.trim() === '' ? 0 : engineeringNumber(delayText),
      value = DngMath.wellPotential(q, on, off, delay);
    setResult(
      'Ожидаемая добыча',
      value === null ? '' : `${fmt(value)} м³/сут`,
      'Введите корректные значения; задержка должна быть меньше времени работы',
    );
    if (value !== null)
      state.last = {
        title,
        method: 'Расчёт',
        result: `${fmt(value)} м³/сут`,
        details: `Дебит=${q} м³/сут; работа=${on} мин; простой=${off} мин; задержка=${delay} мин`,
      };
  }
  bind(['potentialRate', 'potentialOn', 'potentialOff', 'potentialDelay'], calc);
}

// Android part02, screens/RpdScreen.kt: original equations and unit conversion.
function renderRpd() {
  const title = 'Расчёт РПД',
    fields = [
      ['rpdCasing', 'D внутренний ЭК, м'],
      ['rpdTubing', 'd наружный НКТ, м'],
      ['rpdOil', 'ρ нефти, кг/м³'],
      ['rpdWater', 'ρ воды, кг/м³'],
      ['rpdWatercut', 'Обводнённость, %'],
      ['rpdInflow', 'Приток, м³/сут'],
      ['rpdPump', 'Подача ЭЦН, м³/сут'],
      ['rpdIntake', 'Проектное давление на приёме, ат'],
      ['rpdRun', 'Исходное время работы, мин'],
      ['rpdMaxAccum', 'Максимальное время накопления, мин'],
    ];
  app.innerHTML = screen(
    `${topbar(title)}<main class="content stack"><p class="hint">Периодическая откачка: расчёт цикла и ориентировочных уставок давления на приёме.</p>${fields.map(([id, label]) => field(id, label)).join('')}<div id="liveResult">${resultCard(title, '', 'Введите исходные параметры')}</div><p class="hint">Итоговые уставки проверяются по действующему регламенту и фактической конфигурации ТМС/СУ. Давления указаны в ат.</p></main>`,
  );
  function calc() {
    const values = fields.map(([id]) => engineeringNumber(document.getElementById(id).value)),
      r = DngMath.rpd(...values);
    if (!r)
      return setResult(
        title,
        '',
        'Проверьте геометрию, плотности, обводнённость, давления и время; подача ЭЦН должна быть больше притока',
      );
    const value = `Время работы: ${fmt(r.actualRun)} мин\nОбъём откачки: ${fmt(r.volume)} м³\nНакопление: ${fmt(r.accumulation)} мин\nИзменение уровня: ${fmt(r.deltaLevel)} м\nПлотность: ${fmt(r.rho)} кг/м³\nПерепад давления: ${fmt(r.deltaP)} ат\nДавление отключения: ${fmt(r.off)} ат\nДавление запуска: ${fmt(r.start)} ат`;
    setResult(title, value);
    state.last = {
      title,
      method: 'Периодическая откачка',
      result: `Pоткл=${fmt(r.off)} ат; Pзап=${fmt(r.start)} ат`,
      details: `Tработы=${fmt(r.actualRun)} мин; Tнакопления=${fmt(r.accumulation)} мин; V=${fmt(r.volume)} м³; ΔL=${fmt(r.deltaLevel)} м; Qпр=${values[5]} м³/сут; Qэцн=${values[6]} м³/сут`,
    };
  }
  bind(
    fields.map(([id]) => id),
    calc,
  );
}
