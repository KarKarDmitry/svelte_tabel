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

| Компонент | Версия / примечание |
|---|---|
| Windows 10/11 или Linux | рабочая ОС |
| Node.js | ≥ 20 (для разработки и сборки) |
| npm | в составе Node.js |
| Docker Desktop | для БД и продакшен-стека (compose) |
| Git Bash | для скриптов бэкапов (`scripts/db-backup.sh`) |

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

| Переменная | Назначение |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | учётка БД |
| `POSTGRES_HOST` / `POSTGRES_PORT` | хост/порт БД (по умолчанию `localhost:5432`) |
| `DATABASE_URL` | строка подключения `postgres://user:pass@host:port/db` |
| `ORIGIN` | внешний адрес приложения (dev: `http://localhost:5173`, prod: реальный адрес) |
| `BETTER_AUTH_SECRET` | секрет better-auth (обязательно сменить в prod) |
| `BOOTSTRAP_LOGIN` / `BOOTSTRAP_PASSWORD` | логин/пароль первого администратора |

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

Приложение собирается и запускается **в Docker** (контейнер `app`, порт 8080).
Перед этим в `.env` обязательно: `ORIGIN` = реальный адрес (например `http://192.168.1.242:8080`),
`BETTER_AUTH_SECRET` = свой секрет.

```sh
# 1. Поднять только БД (до первой сборки приложения)
docker compose up -d db

# 2. Применить схему БД
npm run db:push

# 3. Создать первого администратора (только при первом запуске)
npm run db:bootstrap

# 4. Собрать приложение и поднять весь стек (db + app + dns)
#    db:deploy = npm run build && docker compose up -d --build
#    Сборка нужна на хосте: Dockerfile одностадийный, копирует готовый build/ в образ.
npm run db:deploy

# 5. Приложение доступно по ORIGIN (http://localhost:8080)
```

После пересборки контейнера `db` один раз инициализировать репозиторий бэкапов:

```sh
npm run db:stanza-create
```

Дальнейшие обновления — только `npm run db:deploy` (пересборка + перезапуск).

## Основные npm-скрипты

| Команда | Назначение |
|---|---|
| `npm run dev` | dev-сервер |
| `npm run build` / `npm run preview` | сборка / предпросмотр prod-сборки |
| `npm run check` | проверка типов (svelte-check) |
| `npm run db:push` | применить схему Drizzle к БД |
| `npm run db:bootstrap` | создать первого администратора |
| `npm run db:seed` | тестовые данные |
| `npm run db:import` | импорт из MSSQL (см. `docs/ops.md`) |
| `npm run db:backup` | полный бэкап (pgBackRest) |
| `npm run db:backup:diff` | дифф-бэкап |
| `npm run db:backup:list` | список точек восстановления |
| `npm run db:restore` | восстановление из точки |
| `npm run db:stanza-create` | инициализация репозитория pgBackRest |
| `npm run db:deploy` | сборка + деплой compose-стека |

## Документация

- [`docs/ops.md`](docs/ops.md) — эксплуатация: роли, импорт, бэкапы, восстановление, расписание, деплой
- [`docs/apps/tabel.md`](docs/apps/tabel.md) — домен приложения: сущности, бизнес-правила, роли
