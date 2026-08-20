# Implementation Plan: Безопасность п.8 + п.9 (экспорт/импорт, `/admin`)

## Overview

Закрыть два пункта ревью AGENTS.md:

- **п.8** — экспорт/статус импорта без проверки роли; `import-process.ts` хранит в памяти загруженный файл и session-cookie, ID процессов предсказуемы.
- **п.9** — `/admin` полагается только на guard в хуке, без явных проверок в actions.

По решению пользователя:

- Экспорт Т-12 — роль `canEdit` (admin | timekeeper).
- Мёртвый POST-эндпоинт экспорта (`apps/tabel/tabel/export/+server.ts`) оставляем с проверкой роли.
- Импорт рефакторим сразу: конвейер выносим в общий сервис, native вызывает напрямую (без self-HTTP и сохранённой cookie).

## Architecture Decisions

- **Общий сервис импорта** — `src/lib/server/db/apps/tabel/services/turnstile-import.service.ts` (по конвенции AGENTS.md: доменная логика в `services/*`). Роуты только оркеструют (SSE-обёртка).
- **Единый тип события импорта** `ImportEvent` — `{ stage, current, total, message, employee?, unresolved? }`; modern SSE и native-статус маппятся из него.
- **`import-process.ts`** — после рефакторинга не хранит `cookie`/`origin`; ID = `crypto.randomUUID()`; автоочистка по завершении + TTL.
- **Файл остаётся в памяти** только на время сессии импорта (нужен для ре-рана фазы 1 после resolve) — риск закрывается UUID + TTL + admin-only.
- **Права** — `requireEdit` (экспорт), `requireAdmin` (импорт-статус), `denyIfNotAdmin` (actions `/admin`). Проверки в каждом endpoint, не только хук.

## Task List

### Phase 1: Быстрый харденинг (без рефакторинга)

- [ ] Task 1: Экспорт — `requireEdit` на 3 эндпоинтах + скрыть кнопки в UI
- [ ] Task 2: Статус импорта — `requireAdmin`
- [ ] Task 3: `import-process.ts` — UUID + автоочистка по TTL

### Checkpoint: T1–T3
- [ ] `npm run check:compile` / `npm run check` зелёные
- [ ] Экспорт недоступен `user`, статус импорта недоступен `user`
- [ ] Ревью с автором перед рефакторингом

### Phase 2: Рефакторинг импорта

- [ ] Task 4: Вынести конвейер импорта в `services/turnstile-import.service.ts` (`runTurnstileImport` + `resolvePassPicks`), `+server.ts` — тонкая SSE-обёртка
- [ ] Task 5: Native — импорт напрямую через сервис, без self-HTTP и без cookie; убрать `origin`/`cookie` из `ImportProcess`

### Checkpoint: T4–T5
- [ ] Современный и нативный импорт пройдены вручную (оба флоу)
- [ ] `grep cookie` в `import-process`/`native-import` → 0
- [ ] Ревью с автором (поведение не изменилось)

### Phase 3: `/admin`

- [ ] Task 6: `/admin` — `denyIfNotAdmin` в `createUser`/`setAccess`/`deleteUser`

### Checkpoint: Полное завершение
- [ ] `npm run check`, `npm run build`, `npm run lint`, `npm run check:compile` — зелёные
- [ ] Dead code audit: `deleteProcess` вызывается; старый fetch-код в `native-import` удалён; `apps/.../import/logger.ts` перенесён
- [ ] Проверка безопасности отдельным субагентом (не в основном окне)
- [ ] Все acceptance criteria выполнены

## Tasks (детали)

### Task 1: Экспорт — проверка роли `canEdit` + скрытие кнопок
**Description:** Добавить `requireEdit(locals.user)` в начало трёх экспорт-эндпоинтов. В UI скрыть кнопку экспорта для не-`canEdit`.
**Acceptance criteria:**
- [ ] `export/stream` GET, native `export` GET, `apps/.../export` POST → read-only `user` получает 403
- [ ] Кнопка «Экспорт» (modern `tabel/+page.svelte:821`) скрыта при `!canEdit`; native-переключатель экспорта скрыт при `!data.canEdit`
**Verification:** `npm run check:compile`, `npm run build`; manual: вход user → 403 на export, кнопок нет.
**Files:** `apps/tabel/tabel/export/+server.ts`, `apps/tabel/tabel/export/stream/+server.ts`, `native/.../export/+server.ts`, `apps/.../tabel/+page.svelte`, `native/.../tabel/+page.svelte`
**Dependencies:** None
**Scope:** S

### Task 2: Статус импорта — только admin
**Description:** `GET /native/apps/tabel/import/[id]/status` без проверки роли → `requireAdmin(locals.user)`.
**Acceptance criteria:**
- [ ] Не-админ получает 403 на статус импорта
**Verification:** `npm run check:compile`
**Files:** `native/.../import/[id]/status/+server.ts`
**Dependencies:** None
**Scope:** XS

### Task 3: `import-process.ts` — непредсказуемые ID + автоочистка
**Description:** Заменить `Date.now()-counter` на `crypto.randomUUID()`. Добавить `createdAt`; удалять процесс по завершении (done/error) с отсрочкой и отбрасывать «зависшие» старше TTL (30 мин).
**Acceptance criteria:**
- [ ] ID — UUID
- [ ] Процесс удаляется из памяти после завершения (отсрочка) и по TTL
**Verification:** `npm run check:compile`
**Files:** `src/lib/server/import-process.ts`, вызовы очистки в `native-import.ts`
**Dependencies:** None
**Scope:** S

### Task 4: Вынести конвейер импорта в общий сервис
**Description:** Из `apps/tabel/import/+server.ts` (1230 стр.) выделить в `src/lib/server/db/apps/tabel/services/turnstile-import.service.ts`:
- `runTurnstileImport({ file, skipPasses, emit })` — весь POST-боди (фаза 1);
- `resolvePassPicks(picks)` — весь PUT-боди (создать/переназначить пропуска → `{ created, linked, reassigned, skipList }`);
- помощники (`normDate`, `normTime`, `parseTime`, `formatTime`, `splitFullName`, `excelSerialToDate`) и `logger.ts` перенести в lib. `+server.ts` — тонкая SSE-обёртка.
**Acceptance criteria:**
- [ ] Современный импорт работает без изменений поведения (все SSE-стадии, unresolved, re-POST с skipPasses после PUT)
- [ ] `+server.ts` не содержит доменной логики
**Verification:** `npm run check:compile`, `npm run build`, manual импорт через `/apps/tabel/import`
**Files:** новый `services/turnstile-import.service.ts`, `services/import-logger.ts`, `apps/tabel/import/+server.ts` (утончение), удалить `apps/tabel/import/logger.ts`
**Dependencies:** None
**Scope:** L

### Task 5: Native — импорт без self-HTTP и без cookie
**Description:** `native-import.ts` вызывает `runTurnstileImport`/`resolvePassPicks` напрямую (emit → `setStatus`), без `fetch(proc.origin...)` и без cookie. Убрать `origin`/`cookie` из `ImportProcess` и из `createProcess`.
**Acceptance criteria:**
- [ ] В памяти не хранится session-cookie
- [ ] Нет HTTP-запроса к собственному origin (grep `fetch(proc.origin` → 0)
- [ ] Нативный флоу: upload → статус → unresolved → resolve → done работает без изменений UI
**Verification:** `npm run check:compile`, `npm run build`, manual нативный импорт (вкл. unresolved → resolve)
**Files:** `src/lib/server/native-import.ts`, `src/lib/server/import-process.ts`, `native/.../import/+page.server.ts`
**Dependencies:** Task 4
**Scope:** M

### Task 6: `/admin` — явные проверки в actions
**Description:** Добавить `denyIfNotAdmin(event.locals.user)` в начало `createUser`, `setAccess`, `deleteUser` (в `updateUser` уже есть). Опционально — guard в `load` (`requireAdmin`).
**Acceptance criteria:**
- [ ] Каждый action возвращает `fail(403)` для не-админа (без опоры на хук)
**Verification:** `npm run check:compile`
**Files:** `src/routes/admin/+page.server.ts`
**Dependencies:** None
**Scope:** S

## Risks and Mitigations

| Риск | Влияние | Митигация |
|---|---|---|
| Рефакторинг 1230-строчного конвейера без авто-тестов (в репо тестов нет) | Med | Task 4 = перемещение кода без изменения логики; мануальный чек-лист импорта (modern + native, оба флоу); рассмотреть тест-харнесс отдельным таском |
| Изменение доступа к экспорту (read-only `user` теряет экспорт) | Low | Согласовано; скрываем кнопки, документируем в AGENTS.md |
| Удержание файла в памяти на время импорта | Low | UUID + TTL + admin-only; cookie полностью убрана |

## Open Questions

- Писать ли тест-харнесс на `turnstile-import.service.ts` сейчас (репо без тестов)? Предложение: мануальная проверка сейчас, тесты — отдельным таском после (п.18).
- Расположение сервиса: `services/turnstile-import.service.ts` (по конвенции). Альтернатива — `src/lib/server/import/`.