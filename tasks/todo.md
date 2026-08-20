# Todo: Безопасность п.8 + п.9 (экспорт/импорт, /admin)

План: см. `tasks/plan.md`.

## Phase 1: Быстрый харденинг
- [x] Task 1: Экспорт — `requireEdit` на 3 эндпоинтах + скрыть кнопки в UI
- [x] Task 2: Статус импорта — `requireAdmin`
- [x] Task 3: `import-process.ts` — UUID + автоочистка по TTL

### Checkpoint T1–T3
- [x] `npm run check:compile` / `npm run check` зелёные
- [x] Экспорт недоступен `user`, статус импорта недоступен `user`
- [x] Ревью с автором перед рефакторингом

## Phase 2: Рефакторинг импорта
- [x] Task 4: Вынести конвейер импорта в `services/turnstile-import.service.ts`
- [x] Task 5: Native — импорт без self-HTTP и без cookie

### Checkpoint T4–T5
- [ ] Современный и нативный импорт пройдены вручную (оба флоу)
- [x] `grep cookie` в `import-process`/`native-import` → 0
- [x] Ревью с автором

## Phase 3: /admin
- [x] Task 6: `/admin` — `denyIfNotAdmin` в createUser/setAccess/deleteUser

## Финал
- [x] `npm run check`, `build`, `lint`, `check:compile` зелёные
- [x] Dead code audit (deleteProcess вызывается, fetch-код удалён, logger перенесён)
- [x] Проверка безопасности отдельным субагентом
- [ ] Все acceptance criteria выполнены