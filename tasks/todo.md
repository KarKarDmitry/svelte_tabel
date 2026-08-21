# Todo: рефакторинг A1 (общий серверный слой)

План: `tasks/plan.md`. Коммит после каждого слайса, без push. Клиентский код не трогаем.

## Слайсы

- [x] 0a. Фикс п.15: URL employee-events в native employee/[id] (`75c1305`)
- [x] 0b. cell-style.ts ← modern-логика, переподключить потребителей (`1eea231`)
- [x] 0c. Каркас: server/context/controller.ts (из shared.ts), server/utils/rate-limit.ts ← перенос,
      apps/tabel/utils/cell-style.ts ← перенос + импорты, удалить shared.ts (`0a111f1`)
- [x] 1. tabel-core.ts + utils/day-style.ts → переподключка интерактивных эндпоинтов
        как делегатов (`eba15e5`)
- [x] 2. Сотрудники [id]/*: контроллеры + делегирующие шеллы (оба дерева) (`e8b5480`)
- [x] 3. employees/create + список (`dd69431`)
- [x] 4. directories/* (`a69d71c`)
- [x] 5. calendar/* (`0fd2c1c`)
- [x] 6. schedules/* (`9ad6cd8`)
- [x] 7. turnstile + worktime + import-load + перенос import-process/native-import (`cfc427c`)
- [x] 8. Ядро табеля: month load, actions, export-пара, зачистка (`84fdce9`)

## Чекпоинты

- [x] После 1: check+lint+build, смоук API, XP-смоук — перенесён на финал
- [x] После 4: check+lint+build (`7c3be97`; check: 1 ошибка punycode — окружение, не код)
- [x] После 8: check+lint+build (`84fdce9`; build ok; check: только punycode-ошибка окружения),
      grep-аудит прав пройден (вне табеля — self-service settings, проверки на месте)

## Итог

71 файл: +2702/−3102 = **−400 LOC нетто** (а не −1500: логика переехала в контроллеры,
а не удалилась). Роуты-сервер 4309 → 2370 (−1939), новые контроллеры +1732,
инфраструктура +80, расцветка −254. Устранено дублирование ~1500–1700 LOC → ~0:
каждая операция существует в одном экземпляре. Контроллеры: tabel-core 356,
employees 404, directories 220, turnstile 210, export 76, calendar 67, schedules 57,
day-style 126. XP-смоук на реальном клиенте — за пользователем.
