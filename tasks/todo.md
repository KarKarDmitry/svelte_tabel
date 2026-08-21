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
- [ ] 5. calendar/*
- [ ] 6. schedules/*
- [ ] 7. turnstile + worktime + import-load + перенос import-process/native-import
- [ ] 8. Ядро табеля: month load, actions, export-пара, зачистка

## Чекпоинты

- [ ] После 1: check+lint+build, смоук, XP-смоук (пользователь)
- [x] После 4: check+lint+build (`7c3be97`; check: 1 ошибка punycode — окружение, не код)
- [ ] После 8: check+lint+build, grep-аудит прав, XP-смоук (пользователь), обновить AGENTS.md (п.14–15)
