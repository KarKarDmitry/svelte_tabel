---
name: permissions-security
description: Права и безопасность mettem: роли admin/timekeeper/user, хелперы permissions.ts, слой прав на чтение, rate-limit на входе, SQL-инъекции, секреты в .env, чек-лист для нового эндпоинта. Use when добавляя/меняя эндпоинты, действия, проверки прав, авторизацию, роли, защиту от SQLi, rate-limit, работу с секретами.
---

# Права доступа и безопасность

## Роли
`admin` | `timekeeper` | `user` (`src/lib/server/auth-utils.ts` — `AppRole`, `toEmail()` превращает логин в `логин@mettem.com`).

- **admin** — видит и редактирует всё.
- **timekeeper** — редактирует только подконтрольные отделы (из `master`).
- **user** — читает данные только своих подразделений (из `master`), без права записи.

## Хелперы `src/lib/server/permissions.ts`
- `isAdmin`, `canEdit` (admin|timekeeper).
- `denyIfNoEdit`, `denyIfNotAdmin` — для actions (`+page.server.ts`): возвращают `fail(403)`.
- `requireEdit`, `requireAdmin` — для API (`+server.ts`): бросают `error(403)`.
- `denyIfCannotEditEmployee` — проверка по отделу сотрудника (admin — всегда, timekeeper — по подконтрольности, «ожидающий» — разрешён).
- `getControlledDepartmentIds` — null = всё (admin), [] = ничего, иначе массив ID из `masterService.getActiveByUser`.
- `isDepartmentControlled`, `requireCanReadEmployee` (слой чтения, бросает `error(403)`).

**Правило:** проверять права в **каждом** action/endpoint, не полагаться только на хук `hooks.server.ts` (он лишь глобальный guard на авторизацию и роль admin для `/admin`).

## Слой прав на чтение (п.7 ревью)
- Списки сотрудников и турникетов: `searchWithFilters({ departmentIds })` — для не-админа подставлять `getControlledDepartmentIds(user)`.
- Константы (`directories/constants/+server.ts`) и пропуска (`directories/passes/+server.ts`) — **только admin** (GET тоже).
- Подразделения: создание — только admin; редактирование названия — admin+timekeeper; удаление — admin.
- Сотрудник по URL: `requireCanReadEmployee` в `employees/[id]/+layout.server.ts` (покрывает все подстраницы).

## SQL-безопасность
- Только Drizzle / параметризованный `sql`. **Запрещено** конкатенация пользовательского ввода в строку запроса.
- Сортировка/колонки — белый список (`sortCol`/`sortDir` в `employee.service.ts`), не пользовательские значения в `sql.raw()`.

## Auth и секреты
- Регистрация отключена (`disableSignUp: true` в `auth.ts`), `minPasswordLength: 8`; пользователи создаются админом.
- `/setup` закрыт: `ALLOW_SETUP=1` + `BOOTSTRAP_PASSWORD` + роль admin.
- Rate-limit входа: `src/lib/server/rate-limit.ts` — 5 попыток на IP+логин и 20 с IP за 15 мин с лок-аутом (`fail(429)`), сброс при успехе. In-memory — для одноузлового деплоя.
- Секреты — только `.env` (в git не коммитить); фолбэков-секретов в коде не оставлять. Историю git чистить `git filter-repo` + менять пароли в БД.

## Чек-лист нового эндпоинта
1. Глобальная авторизация — хук уже проверяет, но в action/endpoint добавь явный `require*`/`denyIf*`.
2. Если отдаются данные сотрудников/турникетов — прокинуть `departmentIds` (не-админ) или `requireCanReadEmployee`.
3. Параметризация SQL (никакой конкатенации).
4. Форм-данные валидируются (типы, диапазоны).
5. native-версия того же эндпоинта — те же проверки (дублировать явно).