# Эксплуатация

Разделы: роли, импорт данных, резервное копирование и восстановление,
расписание бэкапов, экспорт отчётов, деплой, устранение неполадок.

---

## 1. Роли пользователей

Двухуровневая модель ролей:

- **admin** — доступ к админке `/admin` (управление пользователями) и ко всему приложению.
- **user** — обычный пользователь, админка недоступна (попадание на `/admin` редиректит на `/`).

Как назначаются:

- Первый пользователь (`npm run db:bootstrap`) получает роль **admin** автоматически.
- Дальнейшие роли назначаются в админке: `/admin` → «...» у пользователя → «Сделать админом» / «Снять админа».

Защиты:

- Нельзя снять роль админа с самого себя.
- Нельзя снять/удалить роль у последнего оставшегося администратора.
- Нельзя удалить самого себя.

Вход: логин без `@` автоматически превращается в `логин@mettem.com`
(общий домен настраивается в `src/lib/server/auth-utils.ts`).

---

## 2. Импорт данных

Импорт бывает двух видов: **из MSSQL** (справочники, сотрудники, табель) и
**события турникетов из Excel** (через интерфейс).

### 2.1. Импорт из MSSQL — Python-скрипт

Полный перенос из исходной БД (OPP_R) в PostgreSQL. Скрипт сам подключается
к MSSQL и PostgreSQL (параметры берутся из `.env`).

```sh
python src/lib/server/db/apps/tabel/import/import.py
```

Импортирует: день-метки, константы (`MARK_COLOR_RULES`, `NIGHT_SHIFT_START/END`),
подразделения, должности, графики, сотрудников, связи «сотрудник-график»,
`worktime_tracker`, события турникета.

Флаг `--no-data` — только справочники, сотрудники и пропуска; `worktime_tracker`
и события турникета **не** импортируются:

```sh
python src/lib/server/db/apps/tabel/import/import.py --no-data
```

### 2.2. Импорт из MSSQL — TS-версия

Облегчённая версия (справочники, сотрудники, `worktime_tracker`, без событий турникета):

```sh
npm run db:import
```

### 2.3. События турникетов из Excel (интерфейс)

Страница `/apps/tabel/import`: выбор Excel-файла (.xls/.xlsx) с событиями входов/выходов
по пропускам. По ходу импорта показывается прогресс; нераспознанные пропуска
можно сопоставить вручную или пропустить. Импорт идёт по SSE и логируется
в файл (папка `logs/`).

> Перед повторным импортом за период очищайте старые данные (`worktime_tracker`,
> `turnstile_event_tracker`), иначе события сольются в дубли.

---

## 3. Резервное копирование (pgBackRest)

Бэкапы выполняет **pgBackRest** (образ `tabel-db`; версия —
`docker exec tabel-db pgbackrest version`).

- Репозиторий: том `svelte_tabel_pgbackups` (на машине демона Docker —
  `docker volume inspect svelte_tabel_pgbackups` покажет точку монтирования).
- Лимиты хранения: **4 полных** + **52 диффа** (настраиваются в `pgbackrest.conf`).
- После каждого бэкапа ротация (`expire`) выполняется автоматически.
- Включён WAL-архив — восстановление возможно до любой минуты (PITR).

### Команды

| Команда                    | Действие                                                      |
| -------------------------- | ------------------------------------------------------------- |
| `npm run db:stanza-create` | инициализация репозитория (один раз после развёртывания)      |
| `npm run db:backup`        | полный бэкап                                                  |
| `npm run db:backup:diff`   | дифф-бэкап (разница с последним полным)                       |
| `npm run db:backup:incr`   | инкремент (разница с последним любым)                         |
| `npm run db:backup:list`   | список точек восстановления / проверка статуса (`status: ok`) |
| `npm run db:restore`       | восстановление (интерактивно: список точек + PITR)            |

Бэкапы выполняются на работающей БД (остановка не нужна).

### Расписание

`scripts/db.py scheduled` сам выбирает тип: **пятница 16:00 — полный бэкап**,
всё остальное — дифф. Ставить надо там, где `docker` видит демон (локально или
через `DOCKER_HOST`/контекст), и запускать напрямую python, без npm.

Пример systemd-таймера (дважды в день):

```ini
# /etc/systemd/system/mettem-backup.service
[Unit]
Description=pgBackRest backup (mettem)

[Service]
Type=oneshot
WorkingDirectory=/opt/mettem
ExecStart=/usr/bin/python3 scripts/db.py scheduled
```

```ini
# /etc/systemd/system/mettem-backup.timer
[Unit]
Description=pgBackRest backup 2x/day

[Timer]
OnCalendar=*-*-* 08,16:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```sh
systemctl enable --now mettem-backup.timer
npm run db:backup:list   # проверить status: ok
journalctl -u mettem-backup --since today
```

Cron-аналог: `0 8,16 * * * cd /opt/mettem && python3 scripts/db.py scheduled`.

### Восстановление

```sh
npm run db:restore
```

1. Показывается список точек (полные `F`, диффы `D`, время локальное).
2. Точка выбирается стрелками (PgUp/PgDn/Home/End), Enter — подтвердить.
3. Для точек с PITR можно указать время (поля Год/Месяц/День/Час/Минута,
   стрелки ↑/↓ — ±1, ←/→ — поле) или оставить «конец бэкапа» (Enter).
4. Подтверждение (`yes`) — скрипт **останавливает** `app` и `db`, выполняет
   `pgbackrest restore --delta` (`--type=immediate` или `--type=time`), затем
   запускает сервисы обратно.

Восстановление **всегда требует остановки БД** — планируйте окно простоя.
При неудаче скрипт оставляет БД остановленной и указывает на логи pgBackRest.

Конфиг pgBackRest (`pgbackrest.conf`) **вшит в образ** (`Dockerfile.db` →
`COPY pgbackrest.conf /etc/pgbackrest.conf`), отдельно он не монтируется. После
правки конфига образ нужно пересобрать: `docker compose build db && docker compose up -d db`.
Перед восстановлением скрипт проверяет, что образ есть на демоне и конфиг в нём
на месте, — иначе останавливаться не начинает.

> Docker может быть удалённым (`DOCKER_HOST`, контекст вида `ssh://user@host`;
> `docker context ls`). Тогда **все** пути в bind-mount (`-v /path/...`) ищутся
> на машине демона, а не на локальной. Поэтому в скриптах не должно быть маунтов
> локальных файлов: отсутствующий на хосте-демоне путь docker создаёт как каталог
> и падает с `not a directory`.

### PITR (восстановление на момент времени)

```sh
npm run db:restore
```

При выборе точки скрипт показывает PITR-окно (от конца бэкапа до последнего WAL)
и позволяет указать время интерактивно (стрелки по полям даты/времени).
Ручной вариант (БД должна быть остановлена `docker compose stop db`):

```sh
docker exec -u postgres tabel-db pgbackrest --stanza=tabel \
  --type=time --target="2026-08-03 14:30:00" --target-action=promote --delta restore
```

`--target-action=promote` обязателен: без него PostgreSQL останавливается в конце
recovery и работает только на чтение (`pausing at the end of recovery`), ожидая
ручного `pg_wal_replay_resume()` — бэкапы при этом падают с
`unable to find primary cluster`.

---

## 4. Экспорт отчётов

Страница `/apps/tabel/tabel` → кнопка **«Экспорт»**:

- диалог параметров (ночные, переработки, праздничные, коды неявок);
- формирование файла Т-12 (Excel) по подразделениям с прогрессом;
- готовый файл скачивается автоматически.

---

## 5. Деплой

```sh
npm run deploy              # app
npm run deploy -- db        # db
npm run deploy -- nginx     # nginx
npm run deploy -- db nginx  # db + nginx
npm run deploy -- all       # db + nginx + app
```

Скрипт собирает выбранные образы на сервере по SSH и пересоздаёт контейнеры;
локальный Docker не нужен. Перед сборкой выполняется `check:compile`.
Исходники синхронизируются в `/home/mettem-srv/builds/svelte_tabel`, `.env`
по умолчанию берётся с сервера (`DEPLOY_SYNC_ENV=1` — загрузить локальный
`.env`). Предыдущие образы сохраняются как `svelte_tabel-app:previous`,
`tabel-db:previous` и `svelte_tabel-nginx:previous`.

Проверки: `app` — `/`, `/auth/login` и подключение к БД; `db` — `pg_isready`;
`nginx` — `nginx -t` и `/`. При ошибке выбранные сервисы автоматически
пересоздаются из `*:previous`.

Особенности стека:

- `compose.yaml`: сервисы `db` (postgres:18 + pgBackRest), `app`, `nginx`.
- БД хранится на хосте: `/srv/mettem/tabel/pgdata`.
- Бэкапы: `/srv/mettem/tabel/pgbackups`.
- Приложение доступно через nginx на порту 80, `ORIGIN` — из `.env`.

После пересборки `db` (новый образ) один раз выполнить:

```sh
npm run db:stanza-create
```

---

## 6. Устранение неполадок

| Проблема                                                                    | Решение                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bash: set: pipefail: invalid option` / `$'\r': command not found`          | Раньше: скрипт сохранён в CRLF. Сейчас скрипты переведены на python (`scripts/db.py`) — для python CRLF не проблема. Правило LF для `*.sh`/`*.py` закреплено в `.gitattributes`.                                                                                                                         |
| Порт 8080 не открывается при деплое                                         | Docker Desktop держит порт 80/8080 — освободить порт или сменить маппинг в `compose.yaml`.                                                                                                                                                                                                               |
| Браузер не открывает сайт, а curl работает                                  | DNS-кеш браузера/системы — сбросить (`ipconfig /flushdns`) или проверить `ORIGIN`.                                                                                                                                                                                                                       |
| `pgbackrest: role "postgres" does not exist`                                | Кластер создан с `POSTGRES_USER` из `.env` — в `pgbackrest.conf` задан `pg1-user`.                                                                                                                                                                                                                       |
| `stanza-create` как root                                                    | Скрипты выполняют pgBackRest от пользователя `postgres` (`docker exec -u postgres`).                                                                                                                                                                                                                     |
| Статус stanza `error (no valid backups)`                                    | Ещё не сделан ни один бэкап — выполнить `npm run db:backup`.                                                                                                                                                                                                                                             |
| Бэкап: `unable to find primary cluster`                                     | Кластер застрял в recovery после restore (без `--target-action=promote`). Вывести из паузы: `docker exec tabel-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select pg_wal_replay_resume()"'`. Сейчас скрипт restore сам добавляет `--target-action=promote`. |
| PITR: `FATAL: recovery ended before configured recovery target was reached` | Не хватает WAL до целевого времени на timeline точки (кластер мог уйти на новый timeline). Контейнер с `restart: always` уходит в crash-loop. Решение: `docker compose stop db`, затем `npm run db:restore` → «конец бэкапа» (Enter) или время раньше.                                                   |
