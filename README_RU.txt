Саныч-6 — PWA, версия 2.8.1-web.22

Полная инструкция запуска, проверки, публикации и установки на iPhone: README_RU.md.
Результаты и ограничения: DELIVERY_RU.md.
Сверка Android и PWA: ANDROID_PARITY_RU.md.

Запуск приложения: python3 -m http.server 8081 --bind 127.0.0.1
Проверки: npm ci --ignore-scripts && npm run check && npm test
Сборка для HTTPS-хостинга: npm run build (каталог dist/).
Электронный уровень исключён по заданию.
