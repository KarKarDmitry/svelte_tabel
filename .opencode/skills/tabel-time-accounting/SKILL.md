---
name: tabel-time-accounting
description: Работа с табелем учёта рабочего времени (mettem): дневные и доп. отметки, часы/минуты, ночные часы, округления, сегменты по кадровым документам, getMonthGrouped, bulkAssign, расцветка ячеек, экспорт Т-12. Use when меняя логику табеля, отметки, часы, ночные часы, округление, экспорт Т-12, bulkAssign, кэш месяца, cell-style.
---

# Табельный учёт рабочего времени

Самая чувствительная часть домена. **Любое изменение бизнес-логики — только с тестами или оговоркой с автором** (тестов в репо нет, писать перед рефакторингом).

## Основные файлы
- `src/lib/server/db/apps/tabel/services/worktime.service.ts` (~644 стр.) — вся доменная логика месяца: `getMonthGrouped`, сегменты, ночные часы, округления, `updateDayMark`, `bulkUpdateDayMarks`.
- `src/lib/server/db/apps/tabel/services/employee.service.ts` — `getDepartmentAtDate` / `getDepartmentsAtDates` (отдел сотрудника на дату).
- `src/routes/apps/tabel/tabel/+page.server.ts` и `src/routes/native/apps/tabel/tabel/+page.server.ts` — load + actions (`updateDayMark`, `updateExtraMark`, `bulkAssign`).
- `src/routes/apps/tabel/tabel/+page.svelte` (~912 стр.) / native `+page.svelte` — UI.
- `src/routes/apps/tabel/tabel/BulkAssignDialog.svelte` / `BulkAssignNative.svelte` — массовое назначение.
- `src/routes/apps/tabel/tabel/employee-events/+server.ts` и native `employee-events/+server.ts` — события сотрудника за месяц (диалог).
- `src/lib/apps/tabel/cell-style.ts` — **единственный** источник расцветки ячеек (не плодить копии в деревьях).
- Экспорт Т-12: `src/routes/apps/tabel/tabel/export/+server.ts`, `export/stream/+server.ts`, builder в `src/lib/server/db/apps/tabel/reports/`.

## Конвенции данных
- Даты — строки `YYYY-MM-DD`; время — целые **минуты** (не часы с плавающей точкой).
- Отметка дня: `shortName` + необязательные `extraMarkCode` / `extraMarkMinutes`.
- `updateDayMark(employeeId, date, shortName, updatedBy, extraMarkCode?, extraMarkMinutes?)`.
- Часы из UI приходят строкой ("7.5"), переводятся `Math.round(parseFloat(h) * 60)`.

## Права (обязательно в каждом action)
- `canEdit` = admin | timekeeper. Проверка `assertCanEditEmployee` в `tabel/+page.server.ts`: отдел сотрудника на дату должен быть в подконтрольных (для не-админа).
- `bulkAssign`: для не-админа проверяется `deptId` И отдел каждого `employeeId` на каждую дату (`getDepartmentsAtDates`, батчем) — не полагаться только на deptId.
- Слой чтения: не-админ видит только подконтрольные отделы (`getControlledDepartmentIds`), фильтр по `departments` после `getMonthGrouped`.

## Известные проблемы (проверить при работе здесь)
- `worktime.service.ts`: дублируется загрузка `SHIFT_MARK_SHORTNAMES` (строки ~334-353); `totalReport/Night` смешивают `report*` и `shift*` через `??` — проверить бизнес-правило.
- Крупные файлы декомпозировать только с тестами (ночные часы, округления, сегменты, Т-12).

## Экспорт Т-12
- Требует права: в `export/+server.ts` есть проверка `getControlledDepartmentIds` — не-админ экспортирует только свои отделы.
- `export/stream` — потоковая отдача; большой объём, следить за памятью.