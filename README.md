# mettem — табельный учёт рабочего времени

Веб-приложение для учёта рабочего времени: кадровые документы, графики работы,
производственные календари, события турникетов, расчёт отработанных часов
(включая ночные), экспорт табеля Т-12 в Excel.

## Стек

- **SvelteKit 2** (Svelte 5, TypeScript)
- **PostgreSQL 18** (в Docker)
- **Drizzle ORM** + drizzle-kit
- **better-auth** (email + пароль)
- **pgBackRest** — резервное копирование (полные/дифф бэкапы, PITR)
- **ExcelJS** — генерация отчётов

## Требования к системе

| Компонент               | Версия / примечание                                                   |
| ----------------------- | --------------------------------------------------------------------- |
| Windows 10/11 или Linux | рабочая ОС                                                            |
| Node.js                 | ≥ 20 (для разработки и сборки)                                        |
| npm                     | в составе Node.js                                                     |
| Docker Desktop          | для БД и продакшен-стека (compose)                                    |
| Python                  | ≥ 3.10 (скрипт `scripts/db.py` для бэкапов/восстановления)            |
| prompt_toolkit          | `python -m pip install prompt_toolkit` (интерактивное восстановление) |

PostgreSQL отдельно устанавливать **не нужно** — БД поднимается в Docker.
Для работы со схемой используется `drizzle-kit` (в devDependencies, команда `db:push`).

## Установка

Общие шаги для любого режима:

```sh
# 1. Зависимости
npm install

# 2. Окружение: скопировать и заполнить
cp .env.example .env
```

Переменные в `.env`:

| Переменная                                            | Назначение                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | учётка БД                                                                     |
| `POSTGRES_HOST` / `POSTGRES_PORT`                     | хост/порт БД (по умолчанию `localhost:5432`)                                  |
| `DATABASE_URL`                                        | строка подключения `postgres://user:pass@host:port/db`                        |
| `ORIGIN`                                              | внешний адрес приложения (dev: `http://localhost:5173`, prod: реальный адрес) |
| `BETTER_AUTH_SECRET`                                  | секрет better-auth (обязательно сменить в prod)                               |
| `BOOTSTRAP_LOGIN` / `BOOTSTRAP_PASSWORD`              | логин/пароль первого администратора                                           |

> Первый пользователь из `bootstrap` получает роль **admin**. Остальные пользователи
> создаются через админку (`/admin`) и по умолчанию получают роль **user**.

## Режим разработки (dev)

Приложение запускается через **Vite на хосте** (порт 5173, hot-reload).
Из Docker нужен только контейнер БД — контейнеры `app` и `dns` не участвуют.

```sh
# 1. Поднять только БД
#    (для разработки достаточно контейнера db)
docker compose up -d db

# 2. Применить схему БД
npm run db:push

# 3. Создать первого администратора (только при первом запуске)
npm run db:bootstrap

# 4. Запустить dev-сервер
npm run dev
# → http://localhost:5173
```

## Продакшен (prod)

Приложение собирается и запускается **в Docker** (контейнер `tabel-app`, наружу — nginx на порту 80).
Перед этим в `.env` обязательно: `ORIGIN` = реальный адрес, `BETTER_AUTH_SECRET` = свой секрет.

```sh
# 1. Поднять только БД (до первой сборки приложения)
docker compose up -d db

# 2. Применить схему БД
npm run db:push

# 3. Создать первого администратора (только при первом запуске)
npm run db:bootstrap
```

Дальнейшие обновления — `npm run deploy`:

```sh
npm run deploy              # app
npm run deploy -- db        # db
npm run deploy -- nginx     # nginx
npm run deploy -- db nginx  # db + nginx
npm run deploy -- all       # db + nginx + app
```

- локальный Docker не нужен, сборка идёт на сервере по SSH;
- исходники синхронизируются в `/home/mettem-srv/builds/svelte_tabel`;
- `.env` по умолчанию берётся с сервера; `DEPLOY_SYNC_ENV=1` — загрузить локальный `.env`;
- перед сборкой выполняется `check:compile`;
- выбранные контейнеры пересоздаются, предыдущие образы сохраняются как `*:previous`;
- проверяются HTTP, nginx-конфиг и доступность БД; при ошибке выполняется откат.

Параметры: `DEPLOY_HOST`, `DEPLOY_DIR`, `DEPLOY_IMAGE`, `DEPLOY_DB_IMAGE`,
`DEPLOY_NGINX_IMAGE`, `DEPLOY_COMPOSE_PROJECT`.

После пересборки контейнера `db` один раз инициализировать репозиторий бэкапов:

```sh
npm run db:stanza-create
```

## Основные npm-скрипты

| Команда                             | Назначение                                           |
| ----------------------------------- | ---------------------------------------------------- |
| `npm run dev`                       | dev-сервер                                           |
| `npm run build` / `npm run preview` | сборка / предпросмотр prod-сборки                    |
| `npm run check`                     | проверка типов (svelte-check)                        |
| `npm run db:push`                   | применить схему Drizzle к БД                         |
| `npm run db:bootstrap`              | создать первого администратора                       |
| `npm run db:seed`                   | тестовые данные                                      |
| `npm run db:import`                 | импорт из MSSQL (см. `docs/ops.md`)                  |
| `npm run db:backup`                 | полный бэкап (pgBackRest)                            |
| `npm run db:backup:diff`            | дифф-бэкап                                           |
| `npm run db:backup:incr`            | инкремент-бэкап                                      |
| `npm run db:backup:list`            | список точек восстановления                          |
| `npm run db:restore`                | восстановление из точки (интерактивный выбор + PITR) |
| `npm run db:stanza-create`          | инициализация репозитория pgBackRest                 |
| `npm run deploy`                    | сборка и деплой app (по умолчанию)                   |
| `npm run deploy:db`                 | сборка и деплой db                                   |
| `npm run deploy:nginx`              | сборка и деплой nginx                                |
| `npm run deploy:all`                | db + nginx + app                                     |

Бэкапы и восстановление реализованы одним скриптом `scripts/db.py`
(запуск: `python scripts/db.py <full|diff|incr|scheduled|list|restore|...>`,
`npm run db:*` — обёртки над ним). Требуется `pip install prompt_toolkit`.

## Документация

- [`docs/ops.md`](docs/ops.md) — эксплуатация: роли, импорт, бэкапы, восстановление, расписание, деплой
- [`docs/apps/tabel.md`](docs/apps/tabel.md) — домен приложения: сущности, бизнес-правила, роли
