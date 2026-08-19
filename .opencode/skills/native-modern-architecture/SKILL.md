---
name: native-modern-architecture
description: Два дерева маршрутов mettem — современный UI /apps и нативный /native/apps для старых браузеров (Windows XP, ES5). Use when изменяя маршруты, страницы, actions, +server.ts, перенося логику между apps и native, работая с ES5-ограничениями, хуком редиректов, static/native-*.js.
---

# Архитектура: /apps vs /native/apps

## Два дерева
- `/apps/**` — современный UI (Svelte 5 runes, shadcn/bits-ui, form actions + `+server.ts`).
- `/native/apps/**` — тот же домен для старых браузеров (Windows XP: UA `Windows NT 5.[12]`), **клиент обязан оставаться ES5-совместимым**.

## Правила
- **Не дублировать бизнес-логику** между деревьями: общий код в `src/lib/` (сервисы, `cell-style.ts`, `Dialog.svelte`).
- Native **заново реализует** actions в своих `+server.ts` (marks, bulk, employee-events, export) — при правке modern-версии проверять и native.
- Server-логика может переиспользоваться из native: напр. `native/tabel/employee/[id]/+page.server.ts` вызывает `getEmployeeEventsData(...)` напрямую (не через HTTP-запрос к собственному origin — в docker-контейнере fetch к внешнему origin падает).
- На клиенте native: inline-обработчики в `svelte:head` + `static/native-*.js` (native-bulk.js, native-dialog.js, native-employee.js, native-collapse.js, native.css). **Не переносить** Svelte 5-зависимые клиентские API без проверки на XP.

## Хук редиректов `src/hooks.server.ts`
- `handleNativeMode`: `native_only=0`/`native_only=1`/`x-native-only: 1` принудительно переключают дерево; UA XP редиректит из `/apps` в `/native/apps`.
- `handleAuthGuard`: `/auth` и `/_app` — без авторизации; `/admin` — только admin.
- ⚠️ **Редиректы в хуке применяются и к POST**: 303 после POST превращает его в GET и **теряет тело** запроса. Известный баг: `native/.../tabel/employee/[id]/+page.svelte:71` POSTит на `/apps/tabel/tabel/employee-events` — на XP молча теряется тело (не повторять этот паттерн).
- `native_only=0` (одноразовый флаг) — открыть современную версию с XP-клиента для теста.

## Известные проблемы (декомпозиция)
- ~50 файлов с одинаковыми путями в `/apps` и `/native/apps`, ~1700 LOC дублированного backend+JS. Цель: одно дерево + общие сервисы, либо переиспользование общих `+server.ts`.
- Расцветка ячеек — только `src/lib/apps/tabel/cell-style.ts`; native получает плоский светлый набор через `(data.cellColorRules as any)?.light`.

## Порядок действий при фиче
1. Сначала сервис/логика в `src/lib/` (или общий `+server.ts`), потом UI.
2. Modern-страница → form action + `+server.ts`.
3. Native-страница → свой `+server.ts` с теми же проверками прав, ES5-совместимый клиент.
4. `npm run check:compile` после изменений.