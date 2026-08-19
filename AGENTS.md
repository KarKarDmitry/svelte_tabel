# AGENTS.md

Проект: **mettem** — табельный учёт рабочего времени (SvelteKit 5 + Postgres + Drizzle + better-auth).
Коммиты и документация — на русском; код — англ. идентификаторы.

## Технологии
- SvelteKit 2 (Svelte 5, runes), TypeScript, Tailwind CSS 4 (в современном дереве)
- PostgreSQL в Docker, Drizzle ORM (`drizzle-orm/postgres-js` + `postgres`)
- better-auth (email+пароль, плагин admin, роли `admin`/`timekeeper`/`user`)
- ExcelJS / xlsx — экспорт Т-12, импорт событий турникетов
- Импорт из MSSQL (TS и Python-скрипты), pgBackRest для бэкапов
- Второе дерево маршрутов `/native/**` — для старых браузеров (Windows XP, ES5, `static/native-*.js`)

## Команды
- `npm run dev` — dev-сервер (Vite, порт 5173; БД: `docker compose up -d db`)
- `npm run build` — сборка; `npm run preview` — предпросмотр
- `npm run check` — типы (svelte-check); `npm run lint` — prettier --check
- `npm run check:compile` — быстрая проверка компиляции (svelte/compiler + ts transpile; ~2с вместо svelte-check)
- `npm run db:push` — применить схему Drizzle; `db:migrate` — миграции
- `npm run db:bootstrap` — первый админ; `db:seed` — тестовые данные
- `npm run db:import` — импорт из MSSQL (TS); `python .../import/import.py` — полный
- `npm run db:backup` / `db:restore` — pgBackRest через `scripts/db.py`
- `npm run auth:schema` — регенерация auth.schema.ts из better-auth
- Тестов в репозитории **нет** (см. «Известные проблемы»)

## Конвенции
- Доменная логика — в сервисах `src/lib/server/db/apps/tabel/services/*`, роуты только оркеструют.
- Права: `src/lib/server/permissions.ts` — `canEdit`/`isAdmin`/`denyIfNoEdit`/`requireEdit`/`requireAdmin`/`denyIfCannotEditEmployee`/`getControlledDepartmentIds`. Проверять их в **каждом** action/endpoint, не полагаться только на хук.
- Запросы — только через Drizzle/параметризованный `sql`; **запрещено** конкатенировать пользовательский ввод в SQL (см. SQLi ниже).
- Общая расцветка ячеек — `src/lib/apps/tabel/cell-style.ts`; НЕ плодить копии в деревьях.
- Новые секреты — только в `.env` (в git не коммитить), фолбэков-секретов не оставлять.
- Не дублировать логику между `/apps` и `/native/apps` — общий код в `src/lib/`.

## Деревья маршрутов
- `/apps/**` — современный UI (shadcn/bits-ui), form actions + `+server.ts`.
- `/native/apps/**` — тот же домен для старых браузеров; серверная логика частично продублирована в своих `+server.ts` (marks, bulk, employee-events, export). Хук `src/hooks.server.ts` редиректит XP (UA `Windows NT 5.[12]`) из `/apps` в `/native/apps`.
- ⚠️ Редиректы в хуке применяются и к POST — 303 после POST превращает его в GET и **теряет тело** запроса.

## Известные проблемы (из ревью, по приоритету)

### Critical
1. ✅ **SQL-инъекция** в поиске сотрудников — исправлено (параметризованные `sql`-фрагменты вместо конкатенации в `employee.service.ts:131-144`).
2. ✅ **`/setup`** — закрыт: `/setup` больше не в обходе auth-guard (`hooks.server.ts`), эндпоинт требует роль admin + `ALLOW_SETUP=1` в `.env` (`src/routes/setup/+server.ts`).

### High
3. ✅ **Открытая регистрация** — закрыта: `disableSignUp: true` в `auth.ts` (пользователи создаются через админку); `minPasswordLength: 8` (и в `user-account.ts`).
4. ✅ **Хардкод секретов в git** — вынесено в `.env`: `connect.ts` читает `MSSQL_*`, Python-скрипты читают `.env` через `import/env.py` (`MSSQL_*`/`PG_*`). `fired.csv` убран из индекса (в .gitignore). ⚠️ История git переписана через `git filter-repo` (12 коммитов, force-push в origin/dev): `fired.csv` удалён из всех коммитов, пароли заменены на `***REMOVED***`. ⚠️⚠️ **Сами пароли (MSSQL `1111`, PG-пароль) остаются рабочими** — сменить их в БД и в `.env`; бэкап до переписывания: `%TEMP%\opencode\svelte_tabel_backup.bundle`.
5. ✅ **Bulk-assign мимо отделов** — в `bulkAssign` (apps) и `bulk/+server.ts` (native) добавлена проверка отдела каждого `employeeId` на дату через `employeeService.getDepartmentsAtDates`.
6. ✅ **Слабый auth** — частично: добавлен rate-limit на вход (`src/lib/server/rate-limit.ts`): 5 попыток на IP+логин и 20 с IP за 15 мин с лок-аутом. Email-верификация **неприменима** — у пользователей синтетические адреса (`логин@mettem.com`, см. `auth-utils.ts`), почты/mail-сервера нет.

### Medium
7. ✅ **Слой прав на чтение** — `permissions.ts`: добавлен `requireCanReadEmployee` (load — error(403)); списки сотрудников и турникетов ограничены подконтрольными отделами (`departmentIds` в `searchWithFilters`/`searchWithFilters` турникетов, admin — всё). Закрыты GET API справочников констант и пропусков (только admin); создание подразделений — только admin (название — admin+timekeeper). Обычный `user` видит данные только своих подразделений (назначенных в `master`).
8. Экспорт и статус импорта без проверки роли; `import-process.ts` хранит в памяти загруженный файл и session-cookie; ID процессов предсказуемы.
9. `/admin` полагается только на guard в хуке, без явных проверок в actions.

### Low
10. ✅ `login/+page.server.ts` логировал ответ signIn (session-токен) — убрано (вместе с rate-limit).
11. Фолбэк-секрет в `compose.yaml` (`BETTER_AUTH_SECRET=dev-secret-...`); `API_TOKEN` нигде не используется.
12. CSRF не покрывает `+server.ts`; куки не `Secure` (HTTP); `{@html}` в native-компонентах с `esc()` не экранирует одинарные кавычки.

### Архитектура / качество
13. Дублирование `/apps` vs `/native/apps`: 50 файлов с одинаковыми путями, ~1700 LOC дублированного backend+JS; native заново реализует actions в `+server.ts`. Цель — одно дерево + общие сервисы/компоненты, либо переиспользование общих `+server.ts`.
14. Баг: `native/.../tabel/employee/[id]/+page.svelte:71` POSTит на `/apps/tabel/tabel/employee-events` (современный) — на XP молча теряется тело.
15. Крупные файлы: `import/+server.ts` (1146), `T-12_builder*.ts` (ок. 950), `tabel/+page.svelte` (912), `worktime.service.ts` (644) — декомпозировать.
16. `worktime.service.ts`: дублируется загрузка SHIFT_MARK_SHORTNAMES (`getShiftMarkShortnames` и повтор в Promise.all, строки 334-353); `totalReport/Night` смешивают `report*` и `shift*` через `??` — проверить бизнес-правило.
17. Тестов нет — перед рефакторингом бизнес-логики писать тесты (ночные часы, округления, сегменты, Т-12).

## Подсказки для работы в этом репозитории
- Даты в БД и коде — строки `YYYY-MM-DD`; время — целые **минуты** (не часы с плавающей точкой).
- Окружения: только через `$env/dynamic/private` / `$env/dynamic/public`; БД подключение — единственный инстанс в `src/lib/server/db/index.ts` (пул `postgres`, max 10, idle_timeout 20).
- Логика «видимых сотрудников», «сегментов по кадровым документам», ночных часов и округлений — самая чувствительная часть домена; менять только с тестами или оговоркой с автором.
- Native-страницы обязаны оставаться ES5-совместимыми на клиенте (inline-обработчики в `svelte:head` + `static/native-*.js`); не переносить на них `svelte 5`-зависимые клиентские API без проверки на XP.
- Перед изменением `src/lib/server/db/apps/tabel/schema.ts` / таблиц — `npm run db:generate` (миграция) и согласование, т.к. это прод-БД.

## Текущая незавершённая работа (на момент ревью, commit 6c66a0a)
- Нативный табель: планируется переключение месяца без перезагрузки (клиентское переключение через новый JSON-эндпоинт месяца + серверный кэш `getMonthGrouped` с инвалидацией при записи; `actual` в состояние).
- BulkAssign (modern+нативный), EmployeeEvents-диалог со стилями, тёмная тема, общий `cell-style.ts`, `Dialog.svelte` — закоммичено в `0af1d5d` вместе с харденингом безопасности.

## Сменить пароли (обязательно после rewrite истории)
- MSSQL `Editor` (`1111` в старой истории) и PG-пароль (`88afa887…`) **всё ещё рабочие** — сменить в БД и в `.env`, даже после scrub истории (старые клоны/бэкапы/GitHub могут хранить их).