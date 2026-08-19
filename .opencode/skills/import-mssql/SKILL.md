---
name: import-mssql
description: Импорт данных из MSSQL в mettem: TS-импорт (npm run db:import), Python-скрипты import.py / import_incremental.py, подключение через env, разрешение конфликтов импорта, статус/прогресс, import-process. Use when работая с импортом из MSSQL, скриптами import.py, подключением к MSSQL, разрешением конфликтов импорта, статусом импорта.
---

# Импорт из MSSQL

Три пути загрузки данных из старой MSSQL-базы (табели, кадры, пропуска, графики, события турникетов).

## 1. TS-импорт (в приложении)
- Вход: `src/lib/server/db/apps/tabel/import/index.ts` → запуск: `npm run db:import` (tsx).
- Модули по доменам: `employees.ts`, `departments.ts`, `positions.ts`, `schedules.ts`, `employee-schedules.ts`, `day-marks.ts`, `worktime.ts`, `connect.ts` (подключение к MSSQL).
- Подключение: `connect.ts` читает `MSSQL_SERVER/DATABASE/USER/PASSWORD/PORT/ENCRYPT` из `.env` (через `dotenv/config`). **Секретов в коде нет** — только env.
- Python-партнёр: `import/env.py` (`load_env()`, `mssql_config()`, `pg_config()`) — для скриптов ниже.

## 2. Python-скрипты (полный/инкрементальный)
- `import/import.py` — полный импорт (MSSQL → PG). Запуск: `python src/lib/server/db/apps/tabel/import/import.py`.
- `import/import_incremental.py` — только новые/изменённые записи.
- Читают `.env` через `import/env.py` (`MSSQL_*`, `PG_*`). PG-подключение — отдельное от приложения (`PG_HOST/PORT/DB/USER/PASSWORD`).
- Служебные проверочные скрипты: `check_mssql_passes.py`, `check_dismissed.py`, `check_efremova.py`.

## 3. Импорт через UI (файл + разрешение конфликтов)
- Маршруты: `src/routes/apps/tabel/import/+server.ts` (1146 стр., декомпозировать осторожно) и `+page.svelte`; native: `src/routes/native/apps/tabel/import/**`.
- **Права**: только admin (`requireAdmin`) — и в `+server.ts`, и в load, и в native.
- `import-process.ts` (в памяти): хранит загруженный файл и session-cookie процесса; ID процессов предсказуемы — см. AGENTS.md «Известные проблемы», при доработке закрыть.
- Статус/прогресс: `native/.../import/[id]/status/+server.ts`, `[id]/resolve/+server.ts` (разрешение конфликтов, требует admin).
- Формат событий турникетов: `employee_events.xls` (Excel) — парсится `xlsx`/`exceljs`.

## Правила
- Никогда не конкатенировать пользовательский ввод в SQL — только параметризация (Drizzle / параметры).
- Записи о событиях за период могут перезаписываться: `turnstileEventTrackerService.removeByPeriod` перед заливкой.
- После импорта проверять: табели, кадровые документы, пропуска/графики сотрудников (закрытые и открытые записи).