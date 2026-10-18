const operatorSteps = {
  ramp: {
    'ОРИОН-01': [
      {
        title: 'Управление режимами',
        description: 'В корневом каталоге открыть «Управление режимами».',
        image: 'assets/operators/orion_ramp_01.jpg',
      },
      {
        title: 'Программное изменение частоты',
        description: 'Открыть «Программное изменение частоты».',
        image: 'assets/operators/orion_ramp_02.jpg',
      },
      {
        title: 'Конечная частота',
        description: 'Установить НАШУ конечную частоту: $en Гц.',
        image: 'assets/operators/orion_ramp_03.jpg',
      },
      {
        title: 'Начальная частота',
        description: 'Установить НАШУ начальную частоту: $st Гц.',
        image: 'assets/operators/orion_ramp_04.jpg',
      },
      {
        title: 'Темп изменения',
        description: 'Установить НАШ темп изменения: $rt Гц/ч.',
        image: 'assets/operators/orion_ramp_05.jpg',
      },
      {
        title: 'Включение',
        description: 'Вернуться к «Программное изменение частоты» и выбрать «Вкл».',
        image: 'assets/operators/orion_ramp_06.jpg',
      },
    ],
    ЭЛЕКТОН: [
      {
        title: 'Технологические настройки',
        description: 'В главном меню открыть «6. Технол. настройки».',
        image: 'assets/operators/elekton_ramp_01.jpg',
      },
      {
        title: 'Программное изменение частоты',
        description: 'Открыть «6.5 Прогр. изм. част.».',
        image: 'assets/operators/elekton_ramp_02.jpg',
      },
      {
        title: 'Начальная частота',
        description: 'Параметр 230: установить НАШУ начальную частоту $st Гц.',
        image: 'assets/operators/elekton_ramp_03.jpg',
      },
      {
        title: 'Конечная частота и темп',
        description: 'Параметр 231: $en Гц. Параметр 232: $rt Гц/ч.',
        image: 'assets/operators/elekton_ramp_04.jpg',
      },
      {
        title: 'Включение',
        description: 'Параметр 229 «Прогр. изм. част.» установить «Вкл».',
        image: 'assets/operators/elekton_ramp_05.jpg',
      },
    ],
    'Борец КАСКАД-НТ': [
      {
        title: 'Вход в меню',
        description: 'Нажать «Ввод / Enter».',
        image: 'assets/operators/borets_cascade_01.jpg',
      },
      {
        title: 'Уставки',
        description: 'Открыть «Уставки».',
        image: 'assets/operators/borets_cascade_02.jpg',
      },
      {
        title: 'Уставки другие',
        description: 'Открыть «Уставки другие».',
        image: 'assets/operators/borets_cascade_03.jpg',
      },
      {
        title: 'Начальная частота',
        description: 'В «Nн разг» установить $st Гц.',
        image: 'assets/operators/borets_cascade_04.jpg',
      },
      {
        title: 'Время разгона',
        description: 'Установить НАШЕ время разгона ${formatNumber(totalMinutes)} мин.',
        image: 'assets/operators/borets_cascade_05.jpg',
      },
      {
        title: 'Способ изменения',
        description: 'Выбрать «время».',
        image: 'assets/operators/borets_cascade_06.jpg',
      },
      {
        title: 'Программное изменение',
        description: 'Выбрать «1раз».',
        image: 'assets/operators/borets_cascade_07.jpg',
      },
      {
        title: 'Конечная частота',
        description: 'В первом пункте «N» установить $en Гц.',
        image: 'assets/operators/borets_cascade_n_final.jpg',
      },
      {
        title: 'Главный экран',
        description: 'Вернуться на главный экран и проверить индикацию программы.',
        image: 'assets/operators/borets_cascade_09.jpg',
      },
    ],
    'Эталон ЧР': [
      {
        title: 'Параметры ЧРП',
        description: 'Зайти в «Параметры ЧРП».',
        image: 'assets/operators/etalon_new_ramp_01.jpg',
      },
      {
        title: 'Прогр. изм F',
        description: 'Зайти в «Прогр. изм F».',
        image: 'assets/operators/etalon_new_ramp_02.jpg',
      },
      {
        title: 'Частоты',
        description: 'Установить начальную $st Гц и конечную $en Гц.',
        image: 'assets/operators/etalon_new_ramp_03.jpg',
      },
      {
        title: 'Шаг по регл.',
        description: 'Установить шаг ${formatNumber(dv!!)} Гц.',
        image: 'assets/operators/etalon_new_ramp_04.jpg',
      },
      {
        title: 'Задерж. по регл.',
        description: 'Установить задержку ${formatNumber(sm!!)} с.',
        image: 'assets/operators/etalon_new_ramp_05.jpg',
      },
      {
        title: 'Вывод на режим',
        description: 'Выбрать «Однокр».',
        image: 'assets/operators/etalon_new_ramp_06.jpg',
      },
    ],
    'ТРИОЛ (УМКА)': [
      {
        title: 'Режимы работы',
        description: 'Зайти в «Режимы работы».',
        image: 'assets/operators/triol_ramp_01.jpg',
      },
      {
        title: 'Программный режим',
        description: 'Зайти в «Программный режим».',
        image: 'assets/operators/triol_ramp_02.jpg',
      },
      {
        title: 'Начальная частота',
        description: 'Установить $st Гц.',
        image: 'assets/operators/triol_ramp_03.jpg',
      },
      {
        title: 'Конечная частота',
        description: 'Установить $en Гц.',
        image: 'assets/operators/triol_ramp_04.jpg',
      },
      {
        title: 'Время на переход',
        description: 'Установить время $duration (ч:мин).',
        image: 'assets/operators/triol_ramp_05.jpg',
      },
      {
        title: 'Регулятор техн. параметра',
        description: 'Вернуться назад и открыть «Регулятор техн. параметра».',
        image: 'assets/operators/triol_ramp_06.jpg',
      },
      {
        title: 'Поддерживаемый параметр',
        description: 'Выбрать «Прогр. F».',
        image: 'assets/operators/triol_ramp_07.jpg',
      },
    ],
  },
  rich: {
    'Эталон ЧР': [
      {
        title: 'Уставки и защиты',
        description: 'Зайти в «Уставки и защиты».',
        image: 'assets/operators/etalon_new_rich_01.jpg',
      },
      {
        title: 'Уставки',
        description: 'Зайти в «Уставки».',
        image: 'assets/operators/etalon_new_rich_02.jpg',
      },
      {
        title: 'Время работы',
        description: 'Повышенная: $htime мин; пониженная: $ltime мин.',
        image: 'assets/operators/etalon_new_rich_03.jpg',
      },
      {
        title: 'Нижняя частота',
        description: '«Уставка низк. F»: $lo Гц.',
        image: 'assets/operators/etalon_new_rich_04.jpg',
      },
      {
        title: 'Токовые защиты',
        description: 'Нажать «Отмена» и зайти в «Токовые защиты».',
        image: 'assets/operators/etalon_new_rich_05.jpg',
      },
      {
        title: 'Задержка отключения',
        description: 'Установить ${formatNumber(uv!!)} с.',
        image: 'assets/operators/etalon_new_rich_06.jpg',
      },
      {
        title: 'Уставки',
        description: 'Нажать «Отмена» и зайти в «Уставки».',
        image: 'assets/operators/etalon_new_rich_07.jpg',
      },
      {
        title: 'Пониженная частота',
        description: 'Выбрать «Да».',
        image: 'assets/operators/etalon_new_rich_08.jpg',
      },
    ],
    'ТРИОЛ (УМКА)': [
      {
        title: 'Защиты',
        description: 'Зайти в «Защиты».',
        image: 'assets/operators/triol_rich_01.jpg',
      },
      {
        title: 'ЗСП',
        description: 'Зайти в «ЗСП».',
        image: 'assets/operators/triol_rich_02.jpg',
      },
      {
        title: 'Время ЗСП',
        description: 'Установить ${formatNumber(uv!!)} с.',
        image: 'assets/operators/triol_rich_03.jpg',
      },
      {
        title: 'Режимы работы',
        description: 'Дважды нажать стрелку влево и зайти в «Режимы работы».',
        image: 'assets/operators/triol_rich_05.jpg',
      },
      {
        title: 'Работа по таймеру',
        description: 'Зайти в «Работа по таймеру».',
        image: 'assets/operators/triol_rich_06.jpg',
      },
      {
        title: 'Работа по программе',
        description: 'Выбрать «С 2 частотой» вместо «С остановом».',
        image: 'assets/operators/triol_rich_07.jpg',
      },
      {
        title: 'Время на Fзад',
        description: 'Установить $htime мин.',
        image: 'assets/operators/triol_rich_08.jpg',
      },
      {
        title: 'Время на F2',
        description: 'Установить $ltime мин.',
        image: 'assets/operators/triol_rich_09.jpg',
      },
      {
        title: 'Частота F2',
        description: 'Установить $lo Гц.',
        image: 'assets/operators/triol_rich_10.jpg',
      },
    ],
    'ОРИОН-01': [
      {
        title: 'Защиты',
        description: 'В корневом каталоге открыть «Защиты».',
        image: 'assets/operators/orion_rich_01.jpg',
      },
      {
        title: 'Недогрузка',
        description: 'Открыть «Недогрузка».',
        image: 'assets/operators/orion_rich_02.jpg',
      },
      {
        title: 'Время срабатывания',
        description: 'Установить НАШЕ время срабатывания недогрузки ${formatNumber(uv!!)} с.',
        image: 'assets/operators/orion_rich_03.jpg',
      },
      {
        title: 'Управление режимами',
        description: 'Дважды нажать стрелку влево и открыть «Управление режимами».',
        image: 'assets/operators/orion_rich_04.jpg',
      },
      {
        title: 'Две частоты',
        description: 'Открыть «Режим работы на двух частотах».',
        image: 'assets/operators/orion_rich_05.jpg',
      },
      {
        title: 'Рабочая частота',
        description: 'Установить НАШУ рабочую частоту $hi Гц.',
        image: 'assets/operators/orion_rich_06.jpg',
      },
      {
        title: 'Пониженная частота',
        description: 'Установить НАШУ пониженную частоту $lo Гц.',
        image: 'assets/operators/orion_rich_07.jpg',
      },
      {
        title: 'Время на пониженной',
        description: 'Установить НАШЕ время $ltime мин.',
        image: 'assets/operators/orion_rich_08.jpg',
      },
      {
        title: 'Время на рабочей',
        description: 'Установить НАШЕ время $htime мин.',
        image: 'assets/operators/orion_rich_09.jpg',
      },
      {
        title: 'Включение',
        description: 'Кнопкой «−» вернуться к «Режим двух частот» и выбрать «Вкл».',
        image: 'assets/operators/orion_rich_10.jpg',
      },
    ],
    ЭЛЕКТОН: [
      {
        title: 'Уставки и защиты',
        description: 'Открыть «Уставки и защиты».',
        image: 'assets/operators/elekton_rich_01.jpg',
      },
      {
        title: 'Недогруз двигателя',
        description: 'Параметр 103: установить НАШЕ время ${secondsClock(uv!!)}.',
        image: 'assets/operators/elekton_rich_02.jpg',
      },
      {
        title: 'Технологические настройки',
        description: 'Открыть «Технол. настройки».',
        image: 'assets/operators/elekton_rich_03.jpg',
      },
      {
        title: 'Периодический режим',
        description: 'Открыть «6.2 Периодич. режим».',
        image: 'assets/operators/elekton_rich_04.jpg',
      },
      {
        title: 'Времена работы',
        description: 'Параметр 209: ${minutesClock(hm!!)}; параметр 210: ${minutesClock(lm!!)}.',
        image: 'assets/operators/elekton_rich_05.jpg',
      },
      {
        title: 'Выходная частота останова',
        description: 'Параметр 218: установить НАШУ пониженную частоту $lo Гц.',
        image: 'assets/operators/elekton_rich_06.jpg',
      },
      {
        title: 'Работа по программе',
        description: 'Параметр 208: выбрать «Режим с измен. част.».',
        image: 'assets/operators/elekton_rich_07.jpg',
      },
    ],
    'Борец КАСКАД-НТ': [
      {
        title: 'Вход в меню',
        description: 'Нажать «Ввод / Enter».',
        image: 'assets/operators/borets_cascade_01.jpg',
      },
      {
        title: 'Уставки',
        description: 'Открыть «Уставки».',
        image: 'assets/operators/borets_cascade_02.jpg',
      },
      {
        title: 'Уставки I',
        description: 'Открыть «Уставки I».',
        image: 'assets/operators/borets_rich_03.jpg',
      },
      {
        title: 'ЗСП',
        description: 'Установить ЗСП ${formatNumber((lm!! + 1.0) * 60.0)} с. ',
        image: 'assets/operators/borets_rich_04.jpg',
      },
      {
        title: 'Уставки другие',
        description: 'Открыть «Уставки другие».',
        image: 'assets/operators/borets_cascade_03.jpg',
      },
      {
        title: 'Пониженная частота',
        description: 'В «NminПРГ» установить $lo Гц.',
        image: 'assets/operators/borets_rich_06.jpg',
      },
      {
        title: 'ПРГ пауза',
        description: 'Установить НАШЕ время на пониженной частоте $ltime мин.',
        image: 'assets/operators/borets_rich_06.jpg',
      },
      {
        title: 'ПРГ работа',
        description: 'Установить НАШЕ время на рабочей частоте $htime мин и включить ПРГ.',
        image: 'assets/operators/borets_rich_08.jpg',
      },
    ],
  },
};
