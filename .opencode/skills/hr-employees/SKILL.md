---
name: hr-employees
description: Кадровый учёт (mettem): жизненный цикл сотрудника — приём (hire), перевод (transfer), увольнение (dismiss), повторный приём (rehire), отмена документа (cancelDoc); кадровые документы, пропуска, графики. Use when работая с сотрудниками, кадровыми документами, увольнением, пропусками, графиками сотрудника, отменой документа.
---

# Кадровый учёт сотрудников

## Основные файлы
- Документы (приём/перевод/увольнение): `src/routes/apps/tabel/employees/[id]/docs/+page.server.ts` и `src/routes/native/apps/tabel/employees/[id]/docs/+page.server.ts`.
- Layout сотрудника (общие данные + права): `src/routes/{apps,native}/apps/tabel/employees/[id]/+layout.server.ts`.
- Сервисы: `document.service.ts` (кадровые документы), `pass.service.ts` (пропуска), `schedule.service.ts` (графики), `employee.service.ts`.
- Справочник пропусков (все пропуска, серии/номера): `src/routes/apps/tabel/directories/passes/+server.ts` — **только admin** (GET тоже).

## Жизненный цикл
- **Приём (hiring)** — тип `hiring`, нужен `departmentId` + `positionId`. `employeeId=0` при создании сотрудника без подразделения («Ожидание») разрешён табельщику.
- **Перевод (transfer)** — только в подконтрольное подразделение.
- **Увольнение (dismiss)** — `type: 'dismissal'`, `departmentId`/`positionId` из последнего активного документа (`getActiveAtDate` на сегодня). **Обязательно** после создания документа снять активные пропуска и графики:
  - `passService.closeCurrent(id, date)` — ставит `dateTo` на открытые пропуска;
  - `scheduleService.closeCurrentSchedule(id, date)` — то же для графиков.
  - ✅ Нативное увольнение теперь тоже снимает (фикс `227d099`); не откатывать.
  - Дату документа брать из формы с фолбэком на сегодня (`new Date().toISOString().split('T')[0]`), не `''`.
- **Повторный приём (rehire)** — уволенного можно принять, если его последний не-dismissal отдел подконтролен.
- **Отмена документа (cancelDoc)** — для табельщика разрешена только по отделу из самого документа (отдельно для отмены ошибочного увольнения).

## Права
- `denyIfCannotEditEmployee(user, employeeId, deptId?)` — admin всегда; timekeeper только если отдел сотрудника (или переданный deptId) в подконтрольных; «ожидающий» (без документов) — доступен табельщику.
- Уволить «ожидающего» через UI **нельзя** (кнопка «Уволить» показывается только при `lastDoc && !isDismissed`), но action технически позволяет crafted-POST — не усложнять guard без причины.
- Слой чтения: `requireCanReadEmployee` в `[id]/+layout.server.ts` (403 для не-админа вне подконтрольных отделов; «ожидающие» видны всем залогиненным).

## UI
- Modern: `docs/+page.svelte`, `Dialog.svelte`, DatePicker из bits-ui.
- Native (XP, ES5): формы `<form method="post" action="?/dismiss">` + `static/native-*.js`; **не переносить** Svelte 5-зависимые клиентские API.