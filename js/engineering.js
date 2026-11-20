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

function renderRpd() {
  const title = 'Расчёт цикла УПР',
    fields = [
      ['rpdCasing', 'Внутренний диаметр ЭК, мм'],
      ['rpdTubing', 'Наружный диаметр НКТ, мм'],
      ['rpdOil', 'Плотность пластовой нефти, г/см³'],
      ['rpdWater', 'Плотность пластовой воды, г/см³'],
      ['rpdWatercut', 'Обводнённость, %'],
      ['rpdInflow', 'Приток при проектном давлении, м³/сут'],
      ['rpdPump', 'Расчётная подача УЭЦН, м³/сут'],
      ['rpdIntake', 'Проектное давление на приёме, ат'],
      ['rpdPower', 'Мощность установки, кВт'],
      ['rpdCycle', 'Заданное время полного цикла, мин'],
      ['rpdMaxAccum', 'Максимальное время накопления, мин'],
    ];
  app.innerHTML = screen(
    `${topbar(title)}<main class="content stack"><p class="hint">Расчёт времени работы и накопления, диапазона уровня, ориентировочных уставок давления и средней мощности.</p><div class="row">${field(...fields[0])}${field(...fields[1])}</div><div class="row">${field(...fields[2])}${field(...fields[3])}</div>${fields.slice(4).map(([id, label]) => field(id, label)).join('')}<div id="liveResult">${resultCard(title, '', 'Введите исходные параметры')}</div><button class="btn secondary full" id="clearRpd">Очистить</button><p class="hint">Максимальное время накопления выбирается по допустимому времени до замерзания. Итоговые уставки проверяются по действующей технологии и конфигурации ТМС/СУ.</p></main>`,
    'technologist',
  );
  function calc() {
    const values = fields.map(([id]) => engineeringNumber(document.getElementById(id).value));
    state._last = null;
    if (values.some((value) => value === null))
      return setResult(title, '', 'Заполните все параметры');
    const r = DngMath.rpdCycle({
      casingDiameter: values[0],
      tubingDiameter: values[1],
      oilDensity: values[2],
      waterDensity: values[3],
      watercut: values[4],
      inflow: values[5],
      pumpRate: values[6],
      intakePressure: values[7],
      unitPower: values[8],
      cycleTime: values[9],
      maxAccumulationTime: values[10],
    });
    if (!r)
      return setResult(
        title,
        '',
        'Проверьте геометрию, плотности, обводнённость, давление и время; подача УЭЦН должна быть больше притока',
      );
    const value =
      `Время работы: ${fmt(r.adjustedRunTime)} мин\n` +
      `Время накопления: ${fmt(r.adjustedAccumulationTime)} мин\n` +
      `Объём откачки исходного цикла: ${fmt(r.volume)} м³\n` +
      `Диапазон уровня исходного цикла: ${fmt(r.deltaLevel)} м\n` +
      `Плотность смеси: ${fmt(r.mixtureDensity)} кг/м³\n` +
      `Перепад давления: ${fmt(r.adjustedDeltaPressure)} ат\n` +
      `Давление отключения: ${fmt(r.offPressure)} ат\n` +
      `Давление запуска: ${fmt(r.startPressure)} ат\n` +
      `Средняя мощность: ${fmt(r.averagePower)} кВт`;
    setResult(title, value);
    const restrictions = [];
    if (r.adjustedRunTime < 3) restrictions.push('Время работы менее 3 минут');
    if (r.adjustedDeltaPressure < 1) restrictions.push('Диапазон давлений менее 1 ат');
    if (restrictions.length) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = restrictions.join('. ') + '. Результат не соответствует рекомендациям раздела 11.11.4 ВНР; режим требует проверки.';
      document.getElementById('liveResult').append(note);
    }
    state.last = {
      title: 'Цикл УПР по времени и давлению',
      method: 'Цикл УПР по времени и давлению',
      result: `Tраб=${fmt(r.adjustedRunTime)} мин; Tнак=${fmt(r.adjustedAccumulationTime)} мин; Pоткл=${fmt(r.offPressure)} ат; Pзап=${fmt(r.startPressure)} ат`,
      details: `Цикл=${values[9]} мин; максимум накопления=${values[10]} мин; Qпр=${values[5]} м³/сут; Qэцн=${values[6]} м³/сут; средняя мощность=${fmt(r.averagePower)} кВт`,
    };
  }
  bind(
    fields.map(([id]) => id),
    calc,
  );
  document.getElementById('clearRpd').onclick = () => {
    fields.forEach(([id]) => (document.getElementById(id).value = ''));
    resetHistoryDraft();
    calc();
    snapshotRoute();
  };
}

function renderPeriodicCorrection() {
  const title = 'Корректировка периодической программы',
    fields = [
      ['pcElapsedDays', 'Прошло после установки программы, суток'],
      ['pcLevelDifference', 'Изменение уровня остановки, м'],
      ['pcAccumulation', 'Текущее время накопления, мин'],
      ['pcRun', 'Текущее время работы насоса, мин'],
    ],
    casingOptions = [139.7, 146, 168, 178],
    rateOptions = [20, 30, 35, 50, 80, 125, 160, 200, 250, 400, 500],
    tubingOptions = [60, 73, 89];
  app.innerHTML = screen(
    `${topbar(title)}<main class="content stack"><p class="hint">Справочная скорость снижения уровня подбирается автоматически по ЭК, номинальной подаче УЭЦН и НКТ. Значение за 10 минут приложение само переводит в м/ч.</p>${field(...fields[0])}${field(...fields[1])}<div class="card stack"><h3 style="margin:0">Параметры для скорости снижения уровня</h3><div class="row">${selectField('pcCasing', 'Наружный диаметр ЭК, мм', casingOptions, 146)}${selectField('pcTubing', 'Наружный диаметр НКТ, мм', tubingOptions, 73)}</div>${selectField('pcNominalRate', 'Номинальная подача УЭЦН, м³/сут', rateOptions, 80)}<div class="hint" id="pcSpeedSource" role="status"></div><details><summary>Использовать скорость по архивному тренду</summary><p class="hint">Заполнять только при наличии достоверной фактической скорости. Она заменит справочное значение.</p>${field('pcManualSpeed', 'Фактическая скорость, м/ч (необязательно)')}</details></div>${field(...fields[2])}${field(...fields[3])}<div id="liveResult">${resultCard(title, '', 'Введите исходные параметры')}</div><button class="btn secondary full" id="clearPeriodicCorrection">Очистить</button></main>`,
    'technologist',
  );
  function calc() {
    const values = fields.map(([id]) => num(document.getElementById(id).value)),
      casing = num(document.getElementById('pcCasing').value),
      tubing = num(document.getElementById('pcTubing').value),
      nominalRate = num(document.getElementById('pcNominalRate').value),
      tableSpeed = DngMath.periodicLevelDrop(casing, nominalRate, tubing),
      manualText = document.getElementById('pcManualSpeed').value.trim(),
      manualSpeed = manualText === '' ? null : num(manualText),
      speed = manualSpeed ?? tableSpeed?.perHour,
      speedSource = document.getElementById('pcSpeedSource');
    state._last = null;
    speedSource.textContent = tableSpeed
      ? `Справочное значение: ${fmt(tableSpeed.perTenMinutes)} м за 10 мин = ${fmt(tableSpeed.perHour)} м/ч${manualSpeed === null ? '' : `; в расчёте используется фактическая скорость ${fmt(manualSpeed)} м/ч`}`
      : 'Для выбранных параметров справочное значение не найдено';
    if (!tableSpeed) return setResult(title, '', 'Проверьте параметры ЭК, УЭЦН и НКТ');
    if (manualText !== '' && (manualSpeed === null || manualSpeed <= 0))
      return setResult(title, '', 'Фактическая скорость должна быть положительным числом');
    if (values.some((value) => value === null))
      return setResult(title, '', 'Заполните период, изменение уровня и действующую программу');
    const result = DngMath.periodicProgramCorrection(
      values[0],
      values[1],
      speed,
      values[2],
      values[3],
    );
    if (!result) return setResult(title, '', 'Все значения должны быть больше нуля');
    const text =
      `Циклов за период: ${fmt(result.cycles)}\n` +
      `Изменение уровня за цикл: ${fmt(result.levelPerCycle)} м\n` +
      `Увеличить время работы на: ${fmt(result.runIncrease)} мин\n` +
      `Новое время работы: ${fmt(result.correctedRun)} мин`;
    setResult(title, text);
    state.last = {
      title,
      method: 'Корректировка периодической эксплуатации',
      result: `Увеличение=${fmt(result.runIncrease)} мин; новое Tраб=${fmt(result.correctedRun)} мин`,
      details: `Период=${values[0]} сут; ΔH=${values[1]} м; скорость=${fmt(speed)} м/ч (${manualSpeed === null ? `ЭК=${casing} мм; Qном=${nominalRate} м³/сут; НКТ=${tubing} мм` : 'по архивному тренду'}); Tнак=${values[2]} мин; Tраб=${values[3]} мин`,
    };
  }
  bind(
    [...fields.map(([id]) => id), 'pcCasing', 'pcTubing', 'pcNominalRate', 'pcManualSpeed'],
    calc,
  );
  document.getElementById('clearPeriodicCorrection').onclick = () => {
    fields.forEach(([id]) => (document.getElementById(id).value = ''));
    document.getElementById('pcManualSpeed').value = '';
    document.getElementById('pcCasing').value = '146';
    document.getElementById('pcTubing').value = '73';
    document.getElementById('pcNominalRate').value = '80';
    resetHistoryDraft();
    calc();
    snapshotRoute();
  };
  calc();
}

function renderEnergyConsumption() {
  const title = 'Потребляемая мощность и УРЭ',
    fields = [
      ['energyTapVoltage', 'Напряжение отпайки ТМПН, В'],
      ['energyCurrent', 'Рабочий ток ПЭД, А'],
      ['energyPowerFactor', 'Коэффициент мощности cos φ'],
      ['energyControlVoltage', 'Выходное напряжение СУ, В'],
      ['energyNetworkVoltage', 'Номинальное напряжение сети, В'],
      ['energyHours', 'Время работы за сутки, ч'],
      ['energyRate', 'Дебит жидкости за сутки, м³/сут'],
      ['energyDays', 'Дней в расчётном месяце'],
    ];
  app.innerHTML = screen(
    `${topbar(title)}<main class="content stack">${fields.map(([id, label]) => field(id, label)).join('')}<div id="liveResult">${resultCard(title, '', 'Введите исходные параметры')}</div><button class="btn secondary full" id="clearEnergy">Очистить</button><p class="hint">УРЭ выводится в кВт·ч/м³, месячное потребление — в кВт·ч.</p></main>`,
    'technologist',
  );
  function calc() {
    const values = fields.map(([id]) => num(document.getElementById(id).value));
    state._last = null;
    if (values.some((value) => value === null))
      return setResult(title, '', 'Заполните все параметры');
    const result = DngMath.energyConsumption({
      tapVoltage: values[0],
      workingCurrent: values[1],
      powerFactor: values[2],
      controlOutputVoltage: values[3],
      networkVoltage: values[4],
      workingHoursPerDay: values[5],
      dailyLiquidRate: values[6],
      daysInMonth: values[7],
    });
    if (!result)
      return setResult(title, '', 'Проверьте положительные значения, cos φ, часы и число дней');
    const text =
      `Активная мощность: ${fmt(result.activePower)} кВт\n` +
      `УРЭ: ${fmt(result.specificEnergy)} кВт·ч/м³\n` +
      `Энергия за месяц: ${fmt(result.monthlyEnergy)} кВт·ч`;
    setResult(title, text);
    state.last = {
      title,
      method: 'Потребляемая мощность и УРЭ',
      result: text,
      details: `Uотп=${values[0]} В; I=${values[1]} А; cosφ=${values[2]}; Uвых=${values[3]} В; Uсети=${values[4]} В; T=${values[5]} ч/сут; Q=${values[6]} м³/сут; дней=${values[7]}`,
    };
  }
  bind(fields.map(([id]) => id), calc);
  document.getElementById('clearEnergy').onclick = () => {
    fields.forEach(([id]) => (document.getElementById(id).value = ''));
    resetHistoryDraft();
    calc();
    snapshotRoute();
  };
}

function renderCablePowerLoss() {
  const title = 'Потери мощности в кабеле',
    fields = [
      ['cableLossLength', 'Длина кабельной линии, м'],
      ['cableLossSection', 'Текущее сечение жилы, мм²'],
      ['cableLossTemperature', 'Пластовая температура, °C'],
      ['cableLossCurrent', 'Рабочий ток, А'],
      ['cableLossDensity', 'Экономичная плотность тока, А/мм²'],
    ];
  app.innerHTML = screen(
    `${topbar(title)}<main class="content stack">${fields.map(([id, label]) => field(id, label)).join('')}<div id="liveResult">${resultCard(title, '', 'Введите исходные параметры')}</div><button class="btn secondary full" id="clearCableLoss">Очистить</button><p class="hint">Экономичную плотность тока брать из принятого электротехнического норматива. Если значение неизвестно — уточнить у ЭПУ‑Сервис. Рекомендация сечения не заменяет электротехнический подбор кабеля.</p></main>`,
    'technologist',
  );
  function calc() {
    const values = fields.map(([id]) => num(document.getElementById(id).value));
    state._last = null;
    if (values.some((value) => value === null))
      return setResult(title, '', 'Заполните все параметры');
    const result = DngMath.cablePowerLoss(...values);
    if (!result) return setResult(title, '', 'Проверьте положительные значения и температуру');
    const sectionText = result.standardSection
      ? `${result.standardSection} мм²`
      : `более 35 мм² — требуется отдельный подбор`;
    const text =
      `Температура жилы: ${fmt(result.conductorTemperature)} °C\n` +
      `Сопротивление при 20 °C: ${fmt(result.resistanceAt20, 3)} Ом\n` +
      `Рабочее сопротивление: ${fmt(result.resistance, 3)} Ом\n` +
      `Потери активной мощности: ${fmt(result.powerLoss)} кВт\n` +
      `Расчётное сечение: ${fmt(result.requiredSection)} мм²\n` +
      `Стандартное сечение: ${sectionText}`;
    setResult(title, text);
    state.last = {
      title,
      method: 'Потери мощности в кабеле',
      result: `Потери=${fmt(result.powerLoss)} кВт; сечение=${sectionText}`,
      details: `L=${values[0]} м; S=${values[1]} мм²; Tпл=${values[2]} °C; I=${values[3]} А; J=${values[4]} А/мм²`,
    };
  }
  bind(fields.map(([id]) => id), calc);
  document.getElementById('clearCableLoss').onclick = () => {
    fields.forEach(([id]) => (document.getElementById(id).value = ''));
    resetHistoryDraft();
    calc();
    snapshotRoute();
  };
}

function renderOptimalTubing() {
  const title = 'Оптимальный диаметр НКТ',
    fields = [
      ['optimalTubingRate', 'Дебит жидкости, м³/сут'],
      ['optimalTubingDepth', 'Глубина спуска, м'],
      ['optimalTubingCasing', 'Внутренний диаметр ЭК, мм'],
    ];
  app.innerHTML = screen(
    `${topbar(title)}<main class="content stack">${fields.map(([id, label]) => field(id, label)).join('')}<div id="liveResult">${resultCard(title, '', 'Введите исходные параметры')}</div><button class="btn secondary full" id="clearOptimalTubing">Очистить</button><p class="hint">60 мм выбирается при Q &lt; 120 м³/сут и H &lt; 1800 м; 89 мм — при Q &gt; 450 м³/сут и Dвн ЭК ≥ 132 мм; в остальных случаях — 73 мм.</p></main>`,
    'technologist',
  );
  function calc() {
    const values = fields.map(([id]) => num(document.getElementById(id).value));
    state._last = null;
    if (values.some((value) => value === null))
      return setResult(title, '', 'Заполните все параметры');
    const result = DngMath.optimalTubingDiameter(...values);
    if (result === null) return setResult(title, '', 'Проверьте исходные параметры');
    const text = `${result} мм`;
    setResult('Рекомендуемый диаметр НКТ', text);
    state.last = {
      title,
      method: 'Выбор диаметра НКТ',
      result: text,
      details: `Q=${values[0]} м³/сут; Hсп=${values[1]} м; Dвн ЭК=${values[2]} мм`,
    };
  }
  bind(fields.map(([id]) => id), calc);
  document.getElementById('clearOptimalTubing').onclick = () => {
    fields.forEach(([id]) => (document.getElementById(id).value = ''));
    resetHistoryDraft();
    calc();
    snapshotRoute();
  };
}

function renderPumpFill() {
  const title = 'Коэффициент подачи насоса',
    fields = [
      ['pumpFillRate', 'Дебит жидкости за сутки, м³/сут'],
      ['pumpFillHours', 'Время работы за сутки, ч'],
      ['pumpFillNominal', 'Подача насоса на текущей частоте Qном, м³/сут'],
      ['pumpFillFvf', 'Объёмный коэффициент жидкости Bж, м³/м³'],
    ];
  app.innerHTML = screen(
    `${topbar(title)}<main class="content stack">${fields.map(([id, label]) => field(id, label)).join('')}<div id="liveResult">${resultCard(title, '', 'Введите исходные параметры')}</div><button class="btn secondary full" id="clearPumpFill">Очистить</button></main>`,
    'technologist',
  );
  function calc() {
    const values = fields.map(([id]) => num(document.getElementById(id).value));
    state._last = null;
    if (values.some((value) => value === null))
      return setResult(title, '', 'Заполните все параметры');
    const result = DngMath.pumpFillCoefficient(...values);
    if (!result) return setResult(title, '', 'Проверьте дебит, время работы, подачу и коэффициент');
    const text = `Коэффициент: ${fmt(result.coefficient, 3)}\nОценка: ${result.status}`;
    setResult(title, text);
    state.last = {
      title,
      method: 'Коэффициент подачи насоса',
      result: text,
      details: `Q=${values[0]} м³/сут; T=${values[1]} ч; Qном=${values[2]} м³/сут; Bж=${values[3]}`,
    };
  }
  bind(fields.map(([id]) => id), calc);
  document.getElementById('clearPumpFill').onclick = () => {
    fields.forEach(([id]) => (document.getElementById(id).value = ''));
    resetHistoryDraft();
    calc();
    snapshotRoute();
  };
}

function renderPumpDepthReduction() {
  const title = 'Уменьшение глубины спуска УЭЦН',
    fields = [
      ['depthReductionRate', 'Дебит жидкости, м³/сут'],
      ['depthReductionPumpDepth', 'Текущая глубина спуска, м'],
      ['depthReductionPumpExtension', 'Удлинение на глубине спуска, м'],
      ['depthReductionLevelExtension', 'Удлинение на динамическом уровне, м'],
      ['depthReductionGasFactor', 'Газовый фактор, м³/т'],
      ['depthReductionOilFvf', 'Объёмный коэффициент нефти, м³/м³'],
      ['depthReductionBubblepoint', 'Давление насыщения, ат'],
      ['depthReductionOilDensity', 'Плотность нефти, г/см³'],
      ['depthReductionAnnulus', 'Давление в затрубе, ат'],
      ['depthReductionLevel', 'Динамический уровень по стволу, м'],
    ];
  app.innerHTML = screen(
    `${topbar(title)}<main class="content stack">${fields.slice(0, 5).map(([id, label]) => field(id, label)).join('')}<label class="switchline card"><span><b>Газосепаратор установлен</b></span><input id="depthReductionGasSeparator" type="checkbox"></label>${fields.slice(5).map(([id, label]) => field(id, label)).join('')}<div id="liveResult">${resultCard(title, '', 'Введите исходные параметры')}</div><button class="btn secondary full" id="clearDepthReduction">Очистить</button><p class="hint">Расчёт предварительно оценивает возможность уменьшения глубины на 500 м. Окончательное решение требует проверки напора, охлаждения ПЭД, кавитационного запаса и компоновки.</p></main>`,
    'technologist',
  );
  function calc() {
    const values = fields.map(([id]) => num(document.getElementById(id).value));
    state._last = null;
    if (values.some((value) => value === null))
      return setResult(title, '', 'Заполните все параметры');
    const result = DngMath.pumpDepthReduction({
      liquidRate: values[0],
      pumpDepth: values[1],
      pumpExtension: values[2],
      levelExtension: values[3],
      gasFactor: values[4],
      hasGasSeparator: document.getElementById('depthReductionGasSeparator').checked,
      oilFvf: values[5],
      bubblepointPressure: values[6],
      oilDensity: values[7],
      annulusPressure: values[8],
      dynamicLevel: values[9],
    });
    if (!result) return setResult(title, '', 'Проверьте исходные параметры и единицы');
    const recommendation = result.canReduce
      ? 'Возможно уменьшить глубину спуска или увеличить отбор'
      : 'По расчётному критерию текущая глубина оптимальна';
    const text =
      `${recommendation}\n` +
      `Расчётная граница: ${fmt(result.criterionDepth)} м\n` +
      `Запас после уменьшения на 500 м: ${fmt(result.reserveAfterReduction)} м`;
    setResult(title, text);
    state.last = {
      title,
      method: 'Оценка глубины спуска УЭЦН',
      result: text,
      details: `Q=${values[0]} м³/сут; Hсп=${values[1]} м; ΔHсп=${values[2]} м; ΔHдин=${values[3]} м; ГФ=${values[4]} м³/т; ГС=${document.getElementById('depthReductionGasSeparator').checked ? 'есть' : 'нет'}; Bн=${values[5]}; Pнас=${values[6]} ат; ρн=${values[7]} г/см³; Pзатр=${values[8]} ат; Hдин=${values[9]} м`,
    };
  }
  bind([...fields.map(([id]) => id), 'depthReductionGasSeparator'], calc);
  document.getElementById('clearDepthReduction').onclick = () => {
    fields.forEach(([id]) => (document.getElementById(id).value = ''));
    document.getElementById('depthReductionGasSeparator').checked = false;
    resetHistoryDraft();
    calc();
    snapshotRoute();
  };
}

function renderTwoAParameters() {
  const title = 'Подача, напор и частота 2А',
    fields = [
      ['twoARpm', 'Номинальные обороты насоса по ПСИ, об/мин'],
      ['twoAPolePairs', 'Пары полюсов ВЭД (2 пары = 4 полюса)'],
      ['twoATargetEquivalentFrequency', 'Требуемая обычная частота, Гц'],
      ['twoACurrentEquivalentFrequency', 'Текущая обычная частота, Гц'],
      ['twoANominalHead', 'Номинальный напор при 50 Гц, м'],
      ['twoANominalRate', 'Номинальная подача при 50 Гц, м³/сут'],
    ];
  app.innerHTML = screen(
    `${topbar(title)}<main class="content stack"><p class="hint">Введите текущую и требуемую частоты в привычном диапазоне обычной УЭЦН — например 44 и 42 Гц. Приложение само рассчитает соответствующие частоты станции 2А, подачу и напор до и после изменения режима.</p>${fields.map(([id, label]) => field(id, label)).join('')}<div id="liveResult">${resultCard(title, '', 'Введите основные параметры')}</div><button class="btn secondary full" id="clearTwoA">Очистить</button></main>`,
    'technologist',
  );
  function calc() {
    const values = fields.map(([id]) => num(document.getElementById(id).value));
    state._last = null;
    if (values.some((value) => value === null))
      return setResult(title, '', 'Заполните основные параметры');
    const result = DngMath.twoAParameters({
      pumpRpm: values[0],
      polePairs: values[1],
      targetEquivalentFrequency: values[2],
      currentEquivalentFrequency: values[3],
      nominalHead: values[4],
      nominalRate: values[5],
    });
    if (!result)
      return setResult(title, '', 'Проверьте обороты, целое число пар полюсов, частоты и номинальные параметры');
    const text =
      `Номинальная частота станции: ${fmt(result.nominalStationFrequency)} Гц\n` +
      `\nТекущий режим (${fmt(values[3])} Гц):\n` +
      `Частота станции 2А: ${fmt(result.currentStationFrequency)} Гц\n` +
      `Подача: ${fmt(result.currentRate)} м³/сут\n` +
      `Напор: ${fmt(result.currentHead)} м\n` +
      `\nПосле перехода на ${fmt(values[2])} Гц:\n` +
      `Частота станции 2А: ${fmt(result.targetStationFrequency)} Гц\n` +
      `Подача: ${fmt(result.targetRate)} м³/сут\n` +
      `Напор: ${fmt(result.targetHead)} м` +
      (result.exceedsLimit ? '\nВнимание: частота выше 200 Гц' : '');
    setResult(title, text);
    state.last = {
      title,
      method: 'Подача, напор и частота ВЭД 2А',
      result: text,
      details: `nПСИ=${values[0]} об/мин; пар полюсов=${values[1]}; Fтреб.обыч=${values[2]} Гц; Fтек.обыч=${values[3]} Гц; Hном=${values[4]} м; Qном=${values[5]} м³/сут`,
    };
  }
  bind(fields.map(([id]) => id), calc);
  document.getElementById('clearTwoA').onclick = () => {
    fields.forEach(([id]) => (document.getElementById(id).value = ''));
    resetHistoryDraft();
    calc();
    snapshotRoute();
  };
}
