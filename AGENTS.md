# AGENTS.md

Проект: **mettem** — табельный учёт рабочего времени (SvelteKit 2 + Svelte 5 + Postgres + Drizzle + better-auth).
Коммиты и документация — на русском; код — англ. идентификаторы.

## Технологии
- SvelteKit 2 (Svelte 5, runes), TypeScript, Tailwind CSS 4 (в современном дереве)
- PostgreSQL в Docker, Drizzle ORM (`drizzle-orm/postgres-js` + `postgres`)
- better-auth (email+пароль, плагин admin, роли `admin`/`timekeeper`/`user`)
- ExcelJS / xlsx — экспорт Т-12, импорт событий турникетов
- Импорт из MSSQL (TS и Python-скрипты), pgBackRest для бэкапов
- Второе дерево маршрутов `/native/**` — для старых браузеров (Windows XP, ES5, `static/native-*.js`)
- Проектные скиллы opencode по разделам — `.opencode/skills/*` (табель, кадры, турникеты, импорт MSSQL, права/безопасность, два дерева, БД, compile-check) — грузить при работе с соответствующим разделом

## Команды
- `npm run dev` — dev-сервер (Vite, порт 5173; БД: `docker compose up -d db`)
- `npm run build` — сборка; `npm run preview` — предпросмотр
- `npm run check` — типы (svelte-check); `npm run lint` — prettier --check
- `npm run check:compile` — быстрая проверка компиляции (svelte/compiler + ts transpile; ~2с вместо svelte-check); `-- -f <path>` — один файл
- `npm run db:generate` — миграция из схемы; `db:migrate` — применить; `db:push` — быстрое применение (dev)
- `npm run db:bootstrap` — первый админ; `db:seed` — тестовые данные
- `npm run db:import` — импорт из MSSQL (TS); `python .../import/import.py` — полный
- `npm run db:backup` / `db:restore` — pgBackRest через `scripts/db.py`
- `npm run auth:schema` — регенерация auth.schema.ts из better-auth
- Тестов в репозитории **нет** (см. «Известные проблемы»)

## Конвенции
- Доменная логика — в сервисах `src/lib/server/db/apps/tabel/services/*`, роуты только оркеструют.
- Права: `src/lib/server/permissions.ts` — `canEdit`/`isAdmin`/`denyIfNoEdit`/`denyIfNotAdmin`/`requireEdit`/`requireAdmin`/`denyIfCannotEditEmployee`/`getControlledDepartmentIds`/`isDepartmentControlled`/`requireCanReadEmployee` (слой чтения). Проверять их в **каждом** action/endpoint, не полагаться только на хук.
- Слой прав на чтение (п.7): не-админ видит только подконтрольные отделы (`master`); в списки сотрудников/турникетов прокидывать `departmentIds` в `searchWithFilters`; константы и пропуска — только admin; создание подразделений — только admin.
- Запросы — только через Drizzle/параметризованный `sql`; **запрещено** конкатенировать пользовательский ввод в SQL (см. SQLi ниже).
- Общая расцветка ячеек — `$lib/apps/tabel/utils/cell-style.ts`; НЕ плодить копии в деревьях. Приоритет правил: работа в выходной **раньше** переработки/недоработки.
- Отметки дня разделены на две колонки `worktime_tracker`: `day_mark_code` — ФАКТ импорта турникета (`'Я'/'Н'`, пишет только импорт), `report_mark_code` — ручная отметка табельщика (пишут `updateDayMark`/`bulkUpdateDayMarks`; очистка = снять оверрайд). Эффективная отметка для отображения/экспорта = `report ?? fact`; merge при чтении: `getMonthGrouped`, `getEmployeeEventsData`, контроллеры `turnstile.ts`. В API день несёт все три поля: `dayMarkCode`(effective)/`factMarkCode`/`reportMarkCode`.
- Новые секреты — только в `.env` (в git не коммитить), фолбэков-секретов не оставлять.
- Не дублировать логику между `/apps` и `/native/apps` — общий код в `src/lib/`.

## Деревья маршрутов
- `/apps/**` — современный UI (shadcn/bits-ui), form actions + `+server.ts`.
- `/native/apps/**` — тот же домен для старых браузеров; серверная логика частично продублирована в своих `+server.ts` (marks, bulk, employee-events, export). Хук `src/hooks.server.ts` редиректит XP (UA `Windows NT 5.[12]`) из `/apps` в `/native/apps`.
- ⚠️ Редиректы в хуке применяются и к POST — 303 после POST превращает его в GET и **теряет тело** запроса.

## Известные проблемы (из ревью, по приоритету)

### Critical
1. ✅ **SQL-инъекция** в поиске сотрудников — исправлено (параметризованные `sql`-фрагменты вместо конкатенации в `employee.service.ts:178-188`). ⚠️ При харденинге остался баг: `sql.raw(where)` приводил SQL-объект к `[object Object]` (страница сотрудников падала) — исправлено в `12f0a03` на прямую интерполяцию `${where}`.
2. ✅ **`/setup`** — закрыт: `/setup` больше не в обходе auth-guard (`hooks.server.ts`), эндпоинт требует роль admin + `ALLOW_SETUP=1` в `.env` (`src/routes/setup/+server.ts`).

### High
3. ✅ **Открытая регистрация** — закрыта: `disableSignUp: true` в `auth.ts` (пользователи создаются через админку); `minPasswordLength: 8` (и в `user-account.ts`).
4. ✅ **Хардкод секретов в git** — вынесено в `.env`: `connect.ts` читает `MSSQL_*`, Python-скрипты читают `.env` через `import/env.py` (`MSSQL_*`/`PG_*`). `fired.csv` убран из индекса (в .gitignore). ⚠️ История git переписана через `git filter-repo` (12 коммитов, force-push в origin/dev): `fired.csv` удалён из всех коммитов, пароли заменены на `***REMOVED***`. ⚠️⚠️ **Сами пароли (MSSQL `1111`, PG-пароль) остаются рабочими** — сменить их в БД и в `.env`; бэкап до переписывания: `%TEMP%\opencode\svelte_tabel_backup.bundle`.
5. ✅ **Bulk-assign мимо отделов** — в `bulkAssign` (apps) и `bulk/+server.ts` (native) добавлена проверка отдела каждого `employeeId` на дату через `employeeService.getDepartmentsAtDates`.
6. ✅ **Слабый auth** — частично: добавлен rate-limit на вход (`src/lib/server/rate-limit.ts`): 5 попыток на IP+логин и 20 с IP за 15 мин с лок-аутом. Email-верификация **неприменима** — у пользователей синтетические адреса (`логин@mettem.com`, см. `auth-utils.ts`), почты/mail-сервера нет.

### Medium
7. ✅ **Слой прав на чтение** — `permissions.ts`: добавлен `requireCanReadEmployee` (load — error(403)); списки сотрудников и турникетов ограничены подконтрольными отделами (`departmentIds` в `searchWithFilters`/`searchWithFilters` турникетов, admin — всё). Закрыты GET API справочников констант и пропусков (только admin); создание подразделений — только admin (название — admin+timekeeper). Обычный `user` видит данные только своих подразделений (назначенных в `master`).
8. ✅ **Экспорт и статус импорта без проверки роли; `import-process.ts` хранит в памяти загруженный файл и session-cookie; ID процессов предсказуемы** — исправлено (`b2db032`): `requireEdit` на экспорте Т-12, `requireAdmin` на статусе импорта; `import-process.ts` — `randomUUID()` + TTL-автоочистка (`sweep`/`scheduleDelete`); native-импорт без self-HTTP и cookie; `origin`/`cookie` убраны из `ImportProcess`.
9. ✅ **`/admin` полагается только на guard в хуке, без явных проверок в actions** — исправлено (`b2db032`): `denyIfNotAdmin` в `createUser`/`setAccess`/`deleteUser` (`admin/+page.server.ts`).

### Low
10. ✅ `login/+page.server.ts` логировал ответ signIn (session-токен) — убрано (вместе с rate-limit).
11. ✅ Фолбэк-секреты в `compose.yaml` — убраны (`DATABASE_URL`, `BETTER_AUTH_SECRET` теперь без `:-default`, fail-fast при старте). `API_TOKEN` — удалено упоминание (нигде не использовался).
12. ✅ **CSRF не покрывал `+server.ts`; куки без `Secure`; `{@html}` в native-компонентах не экранировал одинарные кавычки** — исправлено: `handleCsrf` в `hooks.server.ts` проверяет `Origin` для всех state-changing запросов (кроме `/api/auth`), без `Origin` — пропуск (XP/curl); разрешены `env.ORIGIN`, `event.url.origin` и фактический `Origin` из заголовков запроса (`X-Forwarded-Proto` + `Host`) — иначе доступ по IP/домену с портом (`.42:8080`, `mettem.apps:8080`) при `ORIGIN` без порта давал 403 на все POST/PUT/PATCH/DELETE (диагноз: `adapter-node` фиксирует `event.url.origin` на значении `ORIGIN` из env, см. `handler.js`); в `auth.ts` — `advanced.useSecureCookies` по протоколу `ORIGIN`; `esc()` во всех native-компонентах дополнительно экранирует `'` (и `"` в `import/[id]`); в `svelte.config.js` — `csrf.trustedOrigins: ['*']` (вместо deprecated `checkOrigin: false`). TLS терминирует nginx (сертификат — приватный CA на клиентах).
13. ✅ **Native-увольнение не снимало пропуска и графики** — исправлено (`227d099`): в native `dismiss` добавлены `passService.closeCurrent` / `scheduleService.closeCurrentSchedule` и фолбэк даты на сегодня (по аналогии с modern). Не откатывать.

### Архитектура / качество
14. ✅ **Дублирование `/apps` vs `/native/apps`** — устранено (рефакторинг A1, слайсы 0a–8): вся серверная логика (parse+validate+права+сервисы) вынесена в контроллеры `src/lib/server/apps/tabel/*` (tabel-core, employees, directories, calendar, schedules, turnstile, export + utils/day-style); роуты обоих деревьев — тонкие шеллы-делегаты. Контроллеры транспортно-нейтральны: бросают `ControllerError`, инфраструктура в `src/lib/server/context/controller.ts` (`runAction` → `fail()`, `json()` в `+server.ts`). Расцветка ячеек — единый источник `$lib/apps/tabel/utils/cell-style.ts`. Правила: имена form-actions/URL/формы ответов не менять; права проверять внутри контроллеров; клиентский код деревьев при серверном рефакторинге не трогать. Ветка `/api` отклонена — при необходимости тонкий маршрут над готовым контроллером.
15. ✅ **Баг native POST на `/apps/.../employee-events`** — исправлено (`75c1305`): URL заменён на `/native/apps/tabel/tabel/employee-events`.
16. Крупные файлы: `T-12_builder*.ts` (ок. 950), `tabel/+page.svelte` (998), `worktime.service.ts` (644), `turnstile-import.service.ts` (ок. 1200) — декомпозировать. (Серверный клей вокруг них убран в контроллеры, п.14.)
17. `worktime.service.ts`: дублируется загрузка SHIFT_MARK_SHORTNAMES (`getShiftMarkShortnames` и повтор в Promise.all, строки 334-353); `totalReport/Night` смешивают `report*` и `shift*` через `??` — проверить бизнес-правило.
18. Тестов нет — перед рефакторингом бизнес-логики писать тесты (ночные часы, округления, сегменты, Т-12).

## Подсказки для работы в этом репозитории
- Даты в БД и коде — строки `YYYY-MM-DD`; время — целые **минуты** (не часы с плавающей точкой).
- Окружения: только через `$env/dynamic/private` / `$env/dynamic/public`; БД подключение — единственный инстанс в `src/lib/server/db/index.ts` (пул `postgres`, max 10, idle_timeout 20).
- Логика «видимых сотрудников», «сегментов по кадровым документам», ночных часов и округлений — самая чувствительная часть домена; менять только с тестами или оговоркой с автором.
- Native-страницы обязаны оставаться ES5-совместимыми на клиенте (inline-обработчики в `svelte:head` + `static/native-*.js`); не переносить на них `svelte 5`-зависимые клиентские API без проверки на XP.
- ⚠️ Svelte **не интерполирует `{…}` внутри `<script>` в `svelte:head`** — литерал ломает парсинг всего блока (мёртвые document.on*). Значения передавать через data-атрибуты DOM-носителей (паттерн `#empRoot`, `#tabel_state`).
- Прод-схема: nginx (`nginx.conf`) проксирует на `app:3000`; снаружи `8080:80`, `proxy_buffering off` — для SSE статуса импорта. TLS-блок в `nginx.conf` закомментирован — включить вместе с сертификатом (приватный CA, `mettem.lan`). `dnsmasq.conf` готов, сервис `dns` в `compose.yaml` закомментирован.
- Перед изменением `src/lib/server/db/apps/tabel/schema.ts` / таблиц — `npm run db:generate` (миграция) и согласование, т.к. это прод-БД.

## Текущая незавершённая работа
- **Кэш-сервис** — ✅ внедрён (`27d8493`, `c049a83`): ядро `src/lib/server/cache.ts` (`remember`/`invalidate`/`cache.update` точечный патч, single-flight, LRU 500, `stats()`, отключение `CACHE_ENABLED=0`); справочники (day-marks, константы, графики, календари) TTL 300с; `getMonthGrouped` → `wtt-month:<y>-<m>:c<calId>` TTL 900с; точечный патч `patchWttMonthCache` (день сегмента + пересчёт итогов) из `updateDayMark`/`bulkUpdateDayMarks`/`saveEmployeeEvents`; импорт турникетов на done сбрасывает тег `wtt`. Инвалидация живёт в мутациях сервисов, не в контроллерах.
- Прод-деплой: сгенерировать сертификат (приватный CA, `mettem.lan`), включить TLS-блок в `nginx.conf` и порт 443 в `compose.yaml`, подключить `certs` volume; поднять сервис `dns` (dnsmasq) — конфиг `dnsmasq.conf` готов. В планах локальный DNS `mettem.apps` → `<host>:<port>` — при этом `ORIGIN` в `.env` остаётся без порта (handleCsrf разрешает фактический Origin из заголовков, порт не нужен). Переключение месяца native-табеля — с перезагрузкой, ок.
- Открытые пункты ревью: архитектурные п.16-18 (крупные файлы, worktime.service.ts, тесты); п.14–15 закрыты рефакторингом A1 (`tasks/plan.md`). Отложено: расчёт рабочего времени — тесты ядра + N+1 последнего входа + частичные графики; Rust/компилируемый язык отклонены (узкие места в БД, а не CPU).
- **Сменить пароли** (критично): MSSQL `Editor` и PG-пароль из старой истории **всё ещё рабочие** — сменить в БД и в `.env` (см. ниже).
- Выполнено (закоммичено): харденинг безопасности (п.1-7, 10-13), слой прав на чтение (`29e399a`), native-увольнение (`227d099`), скиллы opencode, `check:compile`, рефакторинг импорта + безопасность экспорта/статуса/`/admin` + pino-логгер + профайлер + N+1-фикс (`b2db032`), фикс поиска сотрудников (`12f0a03`), CSRF/куки/esc/nginx/фолбэк-секреты (`74c7d84`), фикс 403 на state-changing при доступе по IP с портом, **рефакторинг A1 — общий серверный слой** (`75c1305`…`84fdce9`, п.14–15), **разделение отметок dayMarkCode/reportMarkCode + миграции переноса** (`2b6c2c3`…`ef37dbe`), фиксы native-табеля: мёртвый inline-скрипт (Svelte не интерполирует `<script>`), Enter, диалог событий без перезагрузки (`01d7cbb`, `576f563`), должность в строке меток (`c701a86`), приоритет выходных в расцветке + guard от спама Enter (`bb3e7a0`).

## Сменить пароли (обязательно после rewrite истории)
- MSSQL `Editor` (`1111` в старой истории) и PG-пароль (`88afa887…`) **всё ещё рабочие** — сменить в БД и в `.env`, даже после scrub истории (старые клоны/бэкапы/GitHub могут хранить их).