---
name: turnstile-events
description: События турникетов (mettem): журнал проходов, поиск с фильтрами по периоду/событию, фильтр по подконтрольным отделам, события сотрудника за месяц. Use when работая с турникетами, событиями прохода, журналом проходов, импортом событий турникетов, employee-events.
---

# События турникетов

## Основные файлы
- Сервис: `src/lib/server/db/apps/tabel/services/turnstile-event-tracker.service.ts` — `searchWithFilters`, `getByPeriod`, `getByPeriodWithDetails`, `bulkCreate`, `removeByPeriod`.
- Страницы: `src/routes/{apps,native}/apps/tabel/turnstile/+page.server.ts` (журнал) и `+page.svelte`.
- API (apps): `src/routes/apps/tabel/turnstile/+server.ts` (GET, пагинация 50).
- События сотрудника за месяц: `src/routes/apps/tabel/employees/[id]/events/+page.server.ts` и native аналог (под layout сотрудника).

## Модель
- Таблицы: `turnstile-event-tracker` (факты прохода: employeeId, passId, datetime, eventId), `turnstile-event` (словарь событий: «вход»/«выход»), `pass` (пропуска).
- `datetime` — `Date` (в отличие от дат-строк в остальном домене); период фильтруется через `between` / `gte`+`lte` (dateTo до 23:59:59).

## Права и фильтр по отделам
- `searchWithFilters` принимает `departmentIds?: number[] | null`:
  - admin → `null` (всё);
  - остальные → массив подконтрольных отделов из `getControlledDepartmentIds`.
- Фильтр реализован подзапросом: сотрудник относится к отделу, если его **последний** кадровый документ (по дате) имеет `department_id` в списке (включая уволенных).
- Обычный `user` без назначенных отделов → пустой журнал.
- **Не забывать** прокидывать `departmentIds` в оба места: `+page.server.ts` (load) и `+server.ts` (GET).

## Рабочие сценарии
- Поиск по ФИО/таб.номеру (`search`), фильтры `eventId`, `dateFrom`, `dateTo`, пагинация `page`/`pageSize`.
- `getByPeriodWithDetails(employeeId, from, to)` — для страницы «События» сотрудника (join с `turnstile-event` и `pass`).
- `removeByPeriod(from, to)` — очистка за период (используется в импорте при перезаписи).
- Импорт событий — см. скилл `import-mssql`.