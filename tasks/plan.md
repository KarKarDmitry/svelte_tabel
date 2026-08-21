# План рефакторинга A1: общий серверный слой для /apps и /native/apps

Закрывает п.14–15 ревью (AGENTS.md). Слияние деревьев и декомпозиция крупных файлов
(п.16–18) — вне скоупа, отдельный план позже.

## Решения (финальные)

- **A1 без ветки /api**: два дерева маршрутов сохраняются; вся серверная логика
  (parse + validate + права + вызовы сервисов) переезжает в контроллеры
  `src/lib/server/apps/tabel/`. Интерактивные XHR-эндпоинты остаются на своих местах
  в деревьях и становятся тонкими обёртками над теми же контроллерами.
- **Контроллеры транспортно-нейтральны**: принимают нормализованный контекст
  (`CtrlCtx`) и типизированные аргументы, бросают `ControllerError(status, payload)`.
  Транспорт адаптируется на границе: form action → `runAction()` (fail),
  `+server.ts` → `json()`/статус из ошибки.
- **Сначала контроллеры (новые файлы), потом переподключка**: существующие серверные
  файлы деревьев заморожены до готовности и проверки общего слоя.
- Имена form-actions, URL страниц и формы ответов эндпоинтов НЕ меняются
  (Hyrum's law; клиенты XP не трогаем вообще).
- Структура папок с прицелом на будущие подприложения:
  - `src/lib/server/context/` — инфраструктура контроллеров (общая для всех apps)
  - `src/lib/server/utils/` — общие серверные утилиты (rate-limit и будущие)
  - `src/lib/apps/<app>/utils/` — изоморфные утилиты подприложения (cell-style)
  - `src/lib/server/apps/<app>/` — контроллеры подприложения (+ их utils)
  - `src/lib/server/db/apps/<app>/` — БД-слой (сервисы Drizzle) — БЕЗ ИЗМЕНЕНИЙ
- Расцветка ячеек: канон — логика modern, единый источник `cell-style.ts` (готово, 0b).
- Коммиты после каждого слайса (русские сообщения), **без push**.
- Смоук на реальном XP — вручную пользователем после слайсов 1 и 8.

## Целевая структура

```
src/lib/server/context/controller.ts   ← CtrlUser, CtrlCtx, ctxFrom(),
                                         ControllerError, runAction(), readJson(),
                                         strField(), numField()
src/lib/server/utils/rate-limit.ts     ← перенос из src/lib/server/rate-limit.ts
src/lib/apps/tabel/utils/cell-style.ts ← перенос из src/lib/apps/tabel/cell-style.ts

src/lib/server/apps/tabel/
    tabel-core.ts    ← updateDayMark/updateExtraMark/bulkAssign/employee-events/month load
    employees.ts     ← [id]/{layout,main,docs,schedule,pass,events}, create, список
    directories.ts   ← constants, passes, marks, positions, departments, department-groups
    calendar.ts, schedules.ts, turnstile.ts, worktime.ts, export.ts
    import-process.ts, native-import.ts  ← перенос из src/lib/server/ (слайс 7)
    utils/day-style.ts                   ← дедуп buildDayStyle/buildUpdatedStyles

src/routes/apps/**          ← шеллы-делегаты (load/action = 1–3 строки)
src/routes/native/apps/**   ← те же делегаты + свои тонкие XHR-обёртки на местах
src/lib/server/db/apps/tabel/**  ← БД-слой, БЕЗ ИЗМЕНЕНИЙ
```

## Слайсы

| # | Что делаем | Объём | Статус |
|---|---|---|---|
| 0a | Фикс п.15: URL employee-events в native employee/[id] | XS | ✅ `75c1305` |
| 0b | cell-style: modern-логика канонична, 3 копии modern UI → делегирование | S | ✅ `1eea231` |
| 0c | Каркас папок: context/controller.ts (из незакоммиченного shared.ts), переносы rate-limit.ts и cell-style.ts + импорты, удалить shared.ts | S | ☐ |
| 1 | Ядро табеля: tabel-core.ts + utils/day-style.ts (заморозка деревьев) → проверка → переподключка modern employee-events и native marks/bulk/employee-events как делегатов, удаление дублей внутри | M→L | ☐ |
| 2 | Сотрудники [id]/{layout,main,docs,schedule,pass,events}: контроллеры + шеллы ×2 | M | ☐ |
| 3 | employees/create + список сотрудников | M | ☐ |
| 4 | directories/* (6 страниц) | M | ☐ |
| 5 | calendar/* | M | ☐ |
| 6 | schedules/* | S | ☐ |
| 7 | turnstile + worktime + import-load + перенос import-process/native-import | M | ☐ |
| 8 | Ядро табеля: month load, actions, export-пара, финальная зачистка | L | ☐ |

Чекпоинты после 1, 4, 8: `npm run check && npm run lint && npm run build` + смоук;
grep-аудит прав после 8.

## Приёмы сокращения работы

1. Контроллеры создаются `cp` существующего файла + правка импортов (логика дословно).
2. Шеллы modern/native идентичны (`./$types` относительный) — один текст, раскладка cp.
3. Перед слайсом `git diff --no-index <modern> <native>` — дельта определяет параметризацию.
4. Порядок по сходству пар (от 100% к сложным).
5. `check:compile` (~2с) после каждого слайса.

## Риски

| Риск | Митигация |
|---|---|
| Права потеряны при переезде в контроллеры | Чек-лист permissions-security на каждый контроллер; grep-аудит в конце |
| Поломка форм native при переезде | Имена actions/URL/ответы не меняются; смоук пользователем на XP |
| Клиентские правки | Запрещены по плану (кроме уже сделанных 0a/0b) |

## Вне скоупа

- vitest + декомпозиция worktime.service.ts, T-12_builder, tabel/+page.svelte (п.16–18)
- Ветка /api (отменена: парных JSON-эндпоинтов только 2, клиентские правки неоправданны);
  при необходимости — тонкий маршрут над готовым контроллером в будущем
- Слияние деревьев, сплит permissions.ts
