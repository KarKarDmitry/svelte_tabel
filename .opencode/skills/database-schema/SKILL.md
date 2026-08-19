---
name: database-schema
description: База данных mettem: Drizzle ORM, схема src/lib/server/db/apps/tabel, миграции db:generate/db:migrate/db:push, пул подключений, Docker compose, бэкапы pgBackRest через scripts/db.py, env-переменные БД. Use when меняя схему/таблицы, миграции, подключение к БД, бэкапы/восстановление, compose.yaml, env БД.
---

# База данных и схема

## Технологии
- PostgreSQL в Docker, Drizzle ORM (`drizzle-orm/postgres-js` + `postgres`), `drizzle-kit`.
- Схема приложения: `src/lib/server/db/apps/tabel/schema.ts` (+ `tables/`, `relations.ts`, `enums.ts`); auth: `src/lib/server/db/auth.schema.ts` (генерируется better-auth).
- Подключение — единственный инстанс `src/lib/server/db/index.ts` (пул `postgres`, max 10, idle_timeout 20). Других подключений не создавать.

## Команды
- `npm run db:generate` — миграция из схемы; `npm run db:migrate` — применить; `npm run db:push` — быстрое применение (без миграции, для dev).
- `npm run db:studio` — Drizzle Studio.
- `npm run db:seed` — тестовые данные (`src/lib/server/db/apps/tabel/seed.ts`); `npm run db:bootstrap` — первый админ (`src/lib/server/db/bootstrap.ts`).
- `npm run auth:schema` — регенерация `auth.schema.ts` из better-auth.
- Бэкапы (pgBackRest): `npm run db:backup` (full), `db:backup:diff`, `db:backup:incr`, `db:backup:list`, `db:restore`, `db:stanza-create` — все через `python scripts/db.py ...`.

## Конвенции данных
- Даты — строки `YYYY-MM-DD`; время — целые **минуты**.
- `datetime` в событиях турникетов — `Date` (исключение).
- FK на каскадном удалении: `hr_document`, `employee_pass`, `employee_schedule`, `leave_document`, `worktime_tracker`, `turnstile_event_tracker` (ON DELETE CASCADE).

## Перед изменением схемы
1. ⚠️ Это **прод-БД** — перед правкой `schema.ts`/таблиц: `npm run db:generate`, согласовать миграцию с автором.
2. Сменить только через миграции (не `db:push` в прод).
3. Python-импорт подключается отдельно (`PG_*` из `.env` через `import/env.py`) — не трогать без согласования.

## Окружение
- `.env` (в git не коммитить): `DATABASE_URL=postgres://...`, `MSSQL_*`, `PG_*`, `BETTER_AUTH_SECRET`, `ORIGIN`, `ALLOW_SETUP`, `BOOTSTRAP_PASSWORD`.
- `compose.yaml` — прод-сборка; `compose.dev.yaml` — dev (через `npm run db:start-dev`). В compose не оставлять фолбэк-секретов (`BETTER_AUTH_SECRET=dev-secret-...` — известная проблема, убрать).

## Бэкапы
- pgBackRest через `scripts/db.py`; при восстановлении следовать выводу скрипта. Секреты бэкапа — в `.env`, не коммитить.