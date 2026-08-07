#!/usr/bin/env python3
"""Инкрементальный импорт из MSSQL (OPP_R) в PostgreSQL (tabel).

НЕ чистит таблицы — только добавляет/обновляет недостающее:

- справочники (отделы, должности, графики, отметки) — создаются, если отсутствуют;
- сотрудники — сопоставление по табельному номеру:
    * уже есть в БД — обновляем ФИО, документы НЕ трогаем (дата приёма сохраняется);
    * нет — создаём, дата приёма = первый вход через турникет − 1 день;
- уволенные (IsDeleted в MSSQL) — создаются (если отсутствуют), выдаётся пропуск,
  создаётся увольнение (дата = последний вход), пропуск закрывается (date_to = последний вход);
- события турникета — ON CONFLICT DO NOTHING (повторные запуски безопасны);
- worktime_tracker — upsert по (employee_id, date), ручные поля extra_* не трогаются.

Запуск: python import_incremental.py [--no-data]
"""

import argparse
import json
import os
from datetime import date, datetime, time, timedelta

import psycopg2
import pymssql
from psycopg2.extras import execute_values

try:
    import xlrd
except ImportError:
    xlrd = None

# --- Конфигурация ---
MSSQL = {
    "server": "192.168.1.42",
    "database": "OPP_R",
    "user": "Editor",
    "password": "***REMOVED***",
    "port": 1433,
}

PG = {
    "host": "localhost",
    "port": 654,
    "dbname": "mettem",
    "user": "karkardmitry",
    "password": "***REMOVED***",
}

DAY_MARKS = [
    ("Явка", "Я", "Я", "work", None, False),
    ("Ночная смена", "Н", "Н", "work", None, False),
    ("Ежегодный отпуск", "ОТ", "ОТ", "paid_absence", "27", False),
    ("Отпуск по уходу", "ОД", "ОД", "paid_absence", "27", False),
    ("-", "О", "О", "paid_absence", "27", False),
    ("-", "ОА", "ОА", "paid_absence", "27", False),
    ("-", "ОД1", "ОД1", "paid_absence", "28.1", False),
    ("-", "ДС", "ДС", "paid_absence", "28.3", False),
    ("Учебный отпуск", "У", "У", "paid_absence", "23", False),
    ("-", "УД", "УД", "paid_absence", "22", False),
    ("-", "ОР", "ОР", "unpaid_absence", "43", False),
    ("-", "ОЖ", "ОЖ", "paid_absence", "39", False),
    ("-", "ОЗ", "ОЗ", "unpaid_absence", "27", False),
    ("Больничный", "Б", "Б", "paid_absence", "24", False),
    ("-", "БТ", "БТ", "paid_absence", "24.8", False),
    ("-", "Г", "Г", "paid_absence", "13", False),
    ("-", "ОВ", "ОВ", "paid_absence", "12", False),
    ("Административный отпуск", "АО", "АО", "unpaid_absence", None, False),
    ("Прогул", "ПР", "ПР", "violation", None, False),
    ("Выходной", "В", "В", "day_off", None, False),
    ("Командировка", "К", "К", "paid_absence", "7.1", False),
    ("-", "С", "С", "paid_absence", "18", False),
    ("-", "РВ", "РВ", "paid_absence", "19", False),
    ("Отпуск за свой счёт", "Д", "Д", "unpaid_absence", "33", False),
    ("-", "НП", "НП", "unpaid_absence", "18.1", False),
    ("-", "НОД", "НОД", "paid_absence", "12.2", False),
]


def fix_encoding(value):
    """Перекодирует строку из cp1251 (MSSQL) в корректный unicode."""
    if isinstance(value, str):
        try:
            return value.encode("latin-1").decode("cp1251")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return value
    return value


def _normalize_xls_value(v):
    """Преобразует значение из Excel в строку, убирая .0 у целых чисел."""
    if v is None:
        return ""
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
        return str(v)
    return str(v).strip()


def time_to_minutes(t):
    if not t:
        return 480
    if isinstance(t, time):
        return t.hour * 60 + t.minute
    if isinstance(t, str):
        parts = t.split(":")
        return int(parts[0]) * 60 + (int(parts[1]) if len(parts) > 1 else 0)
    return 480


def time_str_to_minutes(s):
    """'08:00:00' или '08:00' → minutes. Пустое/None → None"""
    if not s:
        return None
    if isinstance(s, time):
        return s.hour * 60 + s.minute
    parts = str(s).split(":")
    return int(parts[0]) * 60 + (int(parts[1]) if len(parts) > 1 else 0)


def hours_to_minutes(h):
    if h is None:
        return None
    return round(float(h) * 60)


def connect_mssql():
    print("Подключение к MSSQL...")
    conn = pymssql.connect(**MSSQL)
    conn.autocommit(True)
    return conn


def connect_pg():
    print("Подключение к PostgreSQL...")
    return psycopg2.connect(**PG)


def parse_tz_offset(pg):
    """Читает TIMEZONE_OFFSET из app_constant и возвращает timedelta."""
    with pg.cursor() as cur:
        cur.execute("SELECT value FROM app_constant WHERE key = 'TIMEZONE_OFFSET'")
        row = cur.fetchone()
    off = (row[0] or "+03:00").strip() if row and row[0] else "+03:00"
    if not off or off in ("Z", "UTC", "0", "+00:00", "-00:00"):
        return timedelta(0)
    sign = 1 if not off.startswith("-") else -1
    rest = off.lstrip("+-")
    parts = rest.split(":")
    h = int(parts[0] or 0)
    m = int(parts[1] or 0) if len(parts) > 1 else 0
    return timedelta(hours=sign * h, minutes=sign * m)


# --- Справочники ---

def import_day_marks(pg):
    print("Импорт day_mark (upsert)...")
    with pg.cursor() as cur:
        for name, short, code, cat, rcode, excl in DAY_MARKS:
            cur.execute(
                """
                INSERT INTO day_mark (name, short_name, code, category, report_code, report_exclude)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    short_name = EXCLUDED.short_name,
                    category = EXCLUDED.category,
                    report_code = EXCLUDED.report_code,
                    report_exclude = EXCLUDED.report_exclude
                """,
                (name, short, short, cat, rcode, excl),
            )

        # Константы (как в полном импорте)
        cur.execute(
            """INSERT INTO app_constant (key, value, is_json, hint)
               VALUES (%s, %s, true, %s)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
            (
                "MARK_COLOR_RULES",
                json.dumps(
                    {
                        "ПР": {"bg": "#fee2e2", "color": "#991b1b", "fontWeight": "bold"},
                        "Б": {"bg": "#f3e8ff", "color": "#6b21a8"},
                        "АО": {"bg": "#fef3c7", "color": "#92400e"},
                        "Д": {"bg": "#fef9c3", "color": "#854d0e"},
                    }
                ),
                "Особенные цвета для конкретных отметок. Ключи — code отметки.",
            ),
        )
        cur.execute(
            """INSERT INTO app_constant (key, value, is_json, hint)
               VALUES (%s, %s, false, %s)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
            ("SHIFT_MARK_SHORTNAMES", "Я,Н", "Список shortName отметок, считающихся рабочими"),
        )
        cur.execute(
            """INSERT INTO app_constant (key, value, is_json, hint)
               VALUES (%s, %s, true, %s)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
            (
                "CELL_COLOR_RULES",
                json.dumps(
                    {
                        "overwork": {"bg": "#fef9c3"},
                        "underwork": {"bg": "#ffedd5"},
                        "missedWorkday": {"bg": "#fee2e2"},
                        "missingHours": {"bg": "#fecaca"},
                        "weekendWork": {"bg": "#bbf7d0"},
                        "outOfPeriod": {"bg": "#f3f4f6"},
                    }
                ),
                "Правила окраски ячеек табеля",
            ),
        )
    pg.commit()
    print(f"  OK: {len(DAY_MARKS)} отметок + константы")


def _import_ref(ms, pg, mssql_table, mssql_col, pg_table):
    """Общий импорт справочника по названию: создаёт отсутствующие, возвращает id_map."""
    with ms.cursor(as_dict=True) as cur:
        cur.execute(f"SELECT ID, {mssql_col} FROM {mssql_table} WHERE IsDeleted IS NULL ORDER BY ID")
        rows = cur.fetchall()
    with pg.cursor() as cur:
        cur.execute(f"SELECT id, name FROM {pg_table}")
        existing = {(name or "").strip().lower(): eid for eid, name in cur.fetchall()}
    id_map = {}
    created = 0
    with pg.cursor() as cur:
        for row in rows:
            name = fix_encoding(row[mssql_col] or "").strip()
            key = name.lower()
            eid = existing.get(key)
            if eid is None:
                cur.execute(f"INSERT INTO {pg_table} (name) VALUES (%s) RETURNING id", (name,))
                eid = cur.fetchone()[0]
                existing[key] = eid
                created += 1
            id_map[row["ID"]] = eid
    pg.commit()
    print(f"  OK: {len(rows)} (создано: {created})")
    return id_map


def import_divisions(ms, pg):
    print("Импорт department (Divisions)...")
    return _import_ref(ms, pg, "Divisions", "Name", "department")


def import_positions(ms, pg):
    print("Импорт position (Posts)...")
    return _import_ref(ms, pg, "Posts", "Name", "position")


def import_schedules(ms, pg):
    print("Импорт schedule (Schedules)...")
    with ms.cursor(as_dict=True) as cur:
        cur.execute(
            """
            SELECT ID, Name, StandartWorkTime,
                   ArrivalTime, DepartureTime,
                   LeftArrivalTimeBound, RightArrivalTimeBound,
                   LeftDepartureTimeBound, RightDepartureTimeBound,
                   WithLunch, LunchStartTime, LunchLeftTimeBound, LunchEnd, LunchRightBound
            FROM Schedules ORDER BY ID
            """
        )
        rows = cur.fetchall()
    with pg.cursor() as cur:
        cur.execute("SELECT id, name FROM schedule")
        existing = {(name or "").strip().lower(): eid for eid, name in cur.fetchall()}
    id_map = {}
    created = 0
    with pg.cursor() as cur:
        for row in rows:
            name = fix_encoding(row["Name"] or "").strip()
            key = name.lower()
            sched_id = existing.get(key)
            if sched_id is None:
                std_min = time_to_minutes(row["StandartWorkTime"])
                cur.execute(
                    "INSERT INTO schedule (name, standard_work_time, week_days) VALUES (%s, %s, %s) RETURNING id",
                    (name, std_min, "[1,2,3,4,5]"),
                )
                sched_id = cur.fetchone()[0]
                existing[key] = sched_id
                created += 1

                # --- Точки графика (как в полном импорте) ---
                arr = time_str_to_minutes(row.get("ArrivalTime"))
                if arr is not None:
                    lb = time_str_to_minutes(row.get("LeftArrivalTimeBound"))
                    rb = time_str_to_minutes(row.get("RightArrivalTimeBound"))
                    cur.execute(
                        "INSERT INTO schedule_point (schedule_id, type, time, left_bound, right_bound) "
                        "VALUES (%s, 'Entry', %s, %s, %s)",
                        (sched_id, f"{arr // 60:02d}:{arr % 60:02d}", lb or 0, rb or 0),
                    )

                dep = time_str_to_minutes(row.get("DepartureTime"))
                if dep is not None:
                    lb = time_str_to_minutes(row.get("LeftDepartureTimeBound"))
                    rb = time_str_to_minutes(row.get("RightDepartureTimeBound"))
                    cur.execute(
                        "INSERT INTO schedule_point (schedule_id, type, time, left_bound, right_bound) "
                        "VALUES (%s, 'Exit', %s, %s, %s)",
                        (sched_id, f"{dep // 60:02d}:{dep % 60:02d}", lb or 0, rb or 0),
                    )
                    if row.get("WithLunch"):
                        ls = time_str_to_minutes(row.get("LunchStartTime"))
                        le = time_str_to_minutes(row.get("LunchEnd"))
                        if ls is not None:
                            end_str = f"{le // 60:02d}:{le % 60:02d}" if le is not None else None
                            lb = time_str_to_minutes(row.get("LunchLeftTimeBound")) or 0
                            rb = time_str_to_minutes(row.get("LunchRightBound")) or 0
                            cur.execute(
                                "INSERT INTO schedule_point (schedule_id, type, time, end_time, left_bound, right_bound) "
                                "VALUES (%s, 'Break', %s, %s, %s, %s)",
                                (sched_id, f"{ls // 60:02d}:{ls % 60:02d}", end_str, lb, rb),
                            )
            id_map[row["ID"]] = sched_id
    pg.commit()
    print(f"  OK: {len(rows)} (создано: {created})")
    return id_map


# --- Сотрудники ---

def import_employees(ms, pg, div_map, pos_map):
    """Создаёт/обновляет сотрудников (включая уволенных).

    Возвращает:
      emp_map   — mssql_id → pg_id
      emp_info  — mssql_id → {pg_id, dept_id, pos_id, dismissed}
      new_ids   — set(pg_id) созданных в этом запуске
    """
    print("Импорт employee (Employees, включая уволенных)...")
    with ms.cursor(as_dict=True) as cur:
        cur.execute(
            """
            SELECT ID, Number, LastName, FirstName, Patronymic, Post, Division, IsDeleted
            FROM Employees ORDER BY ID
            """
        )
        rows = cur.fetchall()

    with pg.cursor() as cur:
        cur.execute("SELECT id, number FROM employee")
        by_number = {str(num): eid for eid, num in cur.fetchall()}

    emp_map = {}
    emp_info = {}
    new_ids = set()
    seen_numbers = set()
    auto_inc = 1
    created = 0
    updated = 0
    with pg.cursor() as cur:
        for row in rows:
            num = str(row["Number"] or "").strip()
            if not num or num in seen_numbers:
                while True:
                    candidate = f"AUTO_{auto_inc}"
                    auto_inc += 1
                    if candidate not in seen_numbers:
                        num = candidate
                        break
            seen_numbers.add(num)

            last_name = fix_encoding(row["LastName"] or "")
            first_name = fix_encoding(row["FirstName"] or "")
            middle_name = fix_encoding(row["Patronymic"] or "") or None

            eid = by_number.get(num)
            if eid is None:
                cur.execute(
                    "INSERT INTO employee (number, last_name, first_name, middle_name) "
                    "VALUES (%s, %s, %s, %s) RETURNING id",
                    (num, last_name, first_name, middle_name),
                )
                eid = cur.fetchone()[0]
                by_number[num] = eid
                new_ids.add(eid)
                created += 1
            else:
                cur.execute(
                    "UPDATE employee SET last_name = %s, first_name = %s, middle_name = %s WHERE id = %s",
                    (last_name, first_name, middle_name, eid),
                )
                updated += 1

            emp_map[row["ID"]] = eid
            emp_info[row["ID"]] = {
                "pg_id": eid,
                "number": num,
                "dept_id": div_map.get(row["Division"]),
                "pos_id": pos_map.get(row["Post"]),
                "dismissed": row["IsDeleted"] is not None,
            }
    pg.commit()
    dismissed = sum(1 for v in emp_info.values() if v["dismissed"])
    print(f"  OK: {len(rows)} (создано: {created}, обновлено: {updated}, уволенных: {dismissed})")
    return emp_map, emp_info, new_ids


def import_employee_schedules(ms, pg, emp_map, sched_map):
    print("Импорт employee_schedule (EmployeeSchedules)...")
    with ms.cursor(as_dict=True) as cur:
        cur.execute("SELECT ID, Employee, Schedule FROM EmployeeSchedules WHERE IsDeleted IS NULL ORDER BY ID")
        rows = cur.fetchall()
    with pg.cursor() as cur:
        cur.execute("SELECT employee_id, schedule_id FROM employee_schedule")
        existing = set(cur.fetchall())
    count = 0
    with pg.cursor() as cur:
        for row in rows:
            new_emp = emp_map.get(row["Employee"])
            new_sched = sched_map.get(row["Schedule"])
            if not new_emp or not new_sched:
                continue
            if (new_emp, new_sched) in existing:
                continue
            cur.execute(
                "INSERT INTO employee_schedule (employee_id, schedule_id) VALUES (%s, %s)",
                (new_emp, new_sched),
            )
            existing.add((new_emp, new_sched))
            count += 1
    pg.commit()
    print(f"  OK: добавлено {count}")


# --- Пропуска ---

def import_passes(pg):
    """Создаёт пропуска из employee_events.xls и возвращает employee_id → pass_id.

    Связи employee_pass не создаются здесь — это делает finalize_docs_and_passes,
    когда известны даты приёма/увольнения.
    """
    xls_path = os.path.join(os.path.dirname(__file__), "employee_events.xls")
    if xlrd is None:
        print("  ПРОПУСК: xlrd не установлен, пропуска из Excel не загружены")
        return {}
    if not os.path.exists(xls_path):
        print(f"  Файл {xls_path} не найден, пропуска не загружены")
        return {}

    print(f"  Загрузка пропусков из {xls_path}...")
    wb = xlrd.open_workbook(xls_path)
    ws = wb.sheet_by_index(0)

    pass_set = {}
    for i in range(1, ws.nrows):
        vals = [ws.cell_value(i, c) for c in range(ws.ncols)]
        if len(vals) < 8:
            continue
        seria = _normalize_xls_value(vals[6])
        number = _normalize_xls_value(vals[7])
        full_name = str(vals[0] or "").strip()
        if not seria or not number or not full_name:
            continue
        key = f"{seria}|{number}"
        if key not in pass_set:
            pass_set[key] = (seria, number, full_name)

    print(f"  Найдено {len(pass_set)} уникальных пропусков")

    with pg.cursor() as cur:
        cur.execute("SELECT id, last_name, first_name, middle_name FROM employee")
        emp_rows = cur.fetchall()

    emp_by_name = {}
    for eid, ln, fn, mn in emp_rows:
        ln = (ln or "").strip().lower()
        fn = (fn or "").strip().lower()
        mn = (mn or "").strip().lower()
        emp_by_name[f"{ln} {fn}{f' {mn}' if mn else ''}"] = eid
        emp_by_name[f"{ln} {fn}"] = eid

    with pg.cursor() as cur:
        cur.execute("""
            SELECT p.id, p.seria, p.number, ep.employee_id
            FROM pass p
            LEFT JOIN employee_pass ep ON ep.pass_id = p.id
        """)
        existing = cur.fetchall()

    pass_by_key = {}
    emp_to_pass = {}
    for pid, seria, num, emp_id in existing:
        key = f"{seria or ''}|{num or ''}"
        pass_by_key[key] = {"pass_id": pid, "employee_id": emp_id}
        if emp_id:
            emp_to_pass.setdefault(emp_id, pid)

    count_created = 0
    count_found = 0
    count_not_found = 0
    with pg.cursor() as cur:
        for key, (seria, number, full_name) in pass_set.items():
            existing_pass = pass_by_key.get(key)
            if existing_pass:
                pass_id = existing_pass["pass_id"]
            else:
                cur.execute(
                    "INSERT INTO pass (seria, number) VALUES (%s, %s) RETURNING id",
                    (seria, number),
                )
                pass_id = cur.fetchone()[0]
                pass_by_key[key] = {"pass_id": pass_id, "employee_id": None}
                count_created += 1

            name_lower = full_name.strip().lower()
            emp_id = emp_by_name.get(name_lower)
            if emp_id:
                emp_to_pass.setdefault(emp_id, pass_id)
                count_found += 1
            else:
                count_not_found += 1
                print(f"    Не найден сотрудник: {full_name} (пропуск {seria} {number})")
    pg.commit()
    print(f"  Пропусков создано: {count_created}, сопоставлено: {count_found}")
    if count_not_found:
        print(f"  Не найдено сотрудников: {count_not_found}")
    return emp_to_pass


def ensure_dummy_passes(pg, emp_info, emp_to_pass):
    """Для уволенных без пропуска создаёт фиктивный пропуск (серия ФИКТ).

    События турникета требуют pass_id (NOT NULL), а пропуск уволенного уже
    сдан и не попадает в текущий экспорт. Фиктивный пропуск нужен, чтобы
    их историю событий можно было импортировать; выдача/возврат (employee_pass)
    создаётся позже в finalize_docs_and_passes.
    """
    print("\n--- Фиктивные пропуска для уволенных ---")
    created = 0
    with pg.cursor() as cur:
        for emp in emp_info.values():
            eid = emp["pg_id"]
            if not emp["dismissed"] or eid in emp_to_pass:
                continue
            # Если у сотрудника уже есть события в PG — берём их пропуск
            cur.execute(
                "SELECT DISTINCT pass_id FROM turnstile_event_tracker WHERE employee_id = %s LIMIT 1",
                (eid,),
            )
            row = cur.fetchone()
            if row and row[0]:
                emp_to_pass[eid] = row[0]
                continue
            # Иначе создаём фиктивный пропуск: серия ФИКТ, номер = табельный
            cur.execute(
                "INSERT INTO pass (seria, number) VALUES ('ФИКТ', %s) RETURNING id",
                (str(emp["number"] or "?"),),
            )
            pass_id = cur.fetchone()[0]
            emp_to_pass[eid] = pass_id
            created += 1
    pg.commit()
    print(f"  Создано фиктивных пропусков: {created}")
    return emp_to_pass


# --- События и табель ---

def import_turnstile_events(ms, pg, emp_map, emp_to_pass, skip_events=False):
    print("\n--- Импорт событий турникета ---")

    print("  Импорт справочника turnstile_event...")
    with ms.cursor(as_dict=True) as cur:
        cur.execute("SELECT ID, Name FROM TurnstileEvents ORDER BY ID")
        event_rows = cur.fetchall()

    event_id_map = {}
    with pg.cursor() as cur:
        cur.execute("SELECT id, name FROM turnstile_event")
        existing = {(name or ""): eid for eid, name in cur.fetchall()}
        for row in event_rows:
            name = fix_encoding(row["Name"])
            eid = existing.get(name)
            if eid is None:
                direction = (
                    "exit"
                    if name.startswith("Выход")
                    else "entry"
                    if name.startswith("Вход")
                    else None
                )
                cur.execute(
                    "INSERT INTO turnstile_event (name, direction) VALUES (%s, %s) RETURNING id",
                    (name, direction),
                )
                eid = cur.fetchone()[0]
                existing[name] = eid
            event_id_map[row["ID"]] = eid
    pg.commit()
    print(f"    OK: {len(event_rows)} событий")

    if skip_events:
        print("  Пропущено: события турникета (--no-data)")
        return

    with pg.cursor() as cur:
        cur.execute("SELECT value FROM app_constant WHERE key = 'TIMEZONE_OFFSET'")
        _row = cur.fetchone()
    tz_offset = _row[0] if _row and _row[0] else "+03:00"

    with ms.cursor(as_dict=True) as cur:
        cur.execute("""
            SELECT Employee, Date, Time, Event
            FROM TurnstileEventTracker ORDER BY Employee, Date, Time
        """)
        event_rows = cur.fetchall()

    count = 0
    count_no_pass = 0
    count_no_event = 0
    batch = []
    BATCH = 500

    for row in event_rows:
        employee_id = emp_map.get(row["Employee"])
        if not employee_id:
            continue

        pass_id = emp_to_pass.get(employee_id)
        if not pass_id:
            count_no_pass += 1
            continue

        d = row["Date"]
        t = row["Time"]
        if isinstance(d, (date, datetime)):
            ds = d.isoformat()
        else:
            ds = str(d)[:10]
        if isinstance(t, time):
            ts = t.isoformat()
        elif isinstance(t, str):
            ts = t[:8]
        else:
            ts = str(t)[:8]
        dt_str = f"{ds}T{ts}{tz_offset}"

        event_id = event_id_map.get(row["Event"])
        if not event_id:
            count_no_event += 1
            continue

        batch.append((employee_id, pass_id, dt_str, event_id))
        count += 1

        if len(batch) >= BATCH:
            with pg.cursor() as cur:
                execute_values(
                    cur,
                    """
                    INSERT INTO turnstile_event_tracker
                        (employee_id, pass_id, datetime, event_id)
                    VALUES %s
                    ON CONFLICT ON CONSTRAINT uq_turnstile_event DO NOTHING
                    """,
                    batch,
                )
            pg.commit()
            batch = []
            print(f"    ... {count}")

    if batch:
        with pg.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO turnstile_event_tracker
                    (employee_id, pass_id, datetime, event_id)
                VALUES %s
                ON CONFLICT ON CONSTRAINT uq_turnstile_event DO NOTHING
                """,
                batch,
            )
        pg.commit()

    print(f"  Импортировано: {count} событий")
    if count_no_pass:
        print(f"  Пропущено (нет пропуска): {count_no_pass}")
    if count_no_event:
        print(f"  Пропущено (нет события): {count_no_event}")


def import_worktime(ms, pg, emp_map):
    print("Импорт worktime_tracker (WorkTimeTracker + Master, upsert)...")

    def load(table_name):
        with ms.cursor(as_dict=True) as cur:
            cur.execute(
                f"""
                SELECT Employee, Date, WorkTime, NightHours, IsNightShift, DayMarkCode
                FROM {table_name} ORDER BY Employee, Date
                """
            )
            rows = cur.fetchall()
        fixed = []
        for r in rows:
            r = dict(r)
            if r.get("DayMarkCode") is not None:
                r["DayMarkCode"] = fix_encoding(r["DayMarkCode"])
            fixed.append(r)
        return fixed

    primary = load("WorkTimeTracker")
    fallback = load("WorkTimeTrackerMaster")

    primary_keys = {(r["Employee"], r["Date"]) for r in primary}
    merged = list(primary)
    for row in fallback:
        if (row["Employee"], row["Date"]) not in primary_keys:
            merged.append(row)

    print(
        f"  WorkTimeTracker: {len(primary)}, Master: {len(fallback)}, всего: {len(merged)}"
    )

    agg = {}
    for row in merged:
        new_emp = emp_map.get(row["Employee"])
        if not new_emp:
            continue
        raw_code = (row["DayMarkCode"] or "").strip()
        code = raw_code or None
        rmin = hours_to_minutes(row["WorkTime"]) or 0
        nmin = hours_to_minutes(row["NightHours"]) or 0
        isn = bool(row["IsNightShift"]) if row["IsNightShift"] is not None else False
        d = row["Date"]
        ds = d.isoformat() if isinstance(d, (date, datetime)) else str(d)
        key = (new_emp, ds)
        if key in agg:
            prev = agg[key]
            agg[key] = (prev[0] + rmin, prev[1] + nmin, prev[2] or isn, prev[3] or code)
        else:
            agg[key] = (rmin, nmin, isn, code)

    count = 0
    batch = []
    BATCH = 500
    for (new_emp, ds), (rmin, nmin, isn, code) in agg.items():
        batch.append(
            (new_emp, ds, isn, code, None, None, rmin, nmin, rmin, nmin, rmin, nmin)
        )
        count += 1
        if len(batch) >= BATCH:
            _flush_worktime(pg, batch)
            batch = []
            print(f"  ... {count}/{len(agg)}")
    if batch:
        _flush_worktime(pg, batch)
    print(f"  OK: {count}")


def _flush_worktime(pg, batch):
    with pg.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO worktime_tracker
                (employee_id, date, is_night_shift, day_mark_code,
                 extra_mark_code, extra_mark_minutes,
                 raw_work_time, raw_night_work_time,
                 shift_work_time, shift_night_work_time,
                 report_work_time, report_night_work_time)
            VALUES %s
            ON CONFLICT (employee_id, date) DO UPDATE SET
                is_night_shift = EXCLUDED.is_night_shift,
                day_mark_code = EXCLUDED.day_mark_code,
                raw_work_time = EXCLUDED.raw_work_time,
                raw_night_work_time = EXCLUDED.raw_night_work_time,
                shift_work_time = EXCLUDED.shift_work_time,
                shift_night_work_time = EXCLUDED.shift_night_work_time,
                report_work_time = EXCLUDED.report_work_time,
                report_night_work_time = EXCLUDED.report_night_work_time
            """,
            batch,
        )
    pg.commit()


# --- Документы, даты приёма/увольнения, пропуска ---

def finalize_docs_and_passes(pg, emp_info, new_ids, emp_to_pass, tz_delta):
    """Даты приёма/увольнения по событиям турникета.

    - приём: первый вход − 1 день (только если документа ещё нет);
    - увольнение (для уволенных): последний вход (только если нет);
    - пропуск: employee_pass с date_from = дата приёма,
      date_to = последний вход (для уволенных — пропуск сдан).
    """
    print("\n--- Финализация документов и пропусков ---")

    with pg.cursor() as cur:
        cur.execute(
            "SELECT employee_id, min(datetime), max(datetime) FROM turnstile_event_tracker GROUP BY employee_id"
        )
        entries = {eid: (first + tz_delta, last + tz_delta) for eid, first, last in cur.fetchall()}

    with pg.cursor() as cur:
        cur.execute("SELECT employee_id, type FROM hr_document")
        has_doc = set(cur.fetchall())

    with pg.cursor() as cur:
        cur.execute("SELECT employee_id, pass_id, date_to FROM employee_pass")
        links = cur.fetchall()
    has_link = {(e, p) for e, p, _ in links}
    open_links = {(e, p) for e, p, d in links if d is None}

    created_hire = 0
    created_dismiss = 0
    linked = 0
    closed = 0
    fixed_hire = 0
    skipped_no_events = 0

    with pg.cursor() as cur:
        for emp in emp_info.values():
            eid = emp["pg_id"]
            first_local, last_local = entries.get(eid, (None, None))
            if first_local is None:
                if eid in new_ids:
                    skipped_no_events += 1
                continue

            hire_date = (first_local.date() - timedelta(days=1)).isoformat()
            dismiss_date = last_local.date().isoformat() if last_local is not None else None

            # Дата приёма от старого импорта (2026-01-01) — пересчитываем по первому входу
            cur.execute(
                "UPDATE hr_document SET date = %s "
                "WHERE employee_id = %s AND type = 'hiring' AND date = '2026-01-01'",
                (hire_date, eid),
            )
            fixed_hire += cur.rowcount

            # Приём
            if (eid, "hiring") not in has_doc and emp["dept_id"] and emp["pos_id"]:
                cur.execute(
                    "INSERT INTO hr_document (type, date, employee_id, department_id, position_id) "
                    "VALUES ('hiring', %s, %s, %s, %s)",
                    (hire_date, eid, emp["dept_id"], emp["pos_id"]),
                )
                has_doc.add((eid, "hiring"))
                created_hire += 1
            elif (eid, "hiring") not in has_doc:
                print(f"    Нет отдела/должности для приёма: employee {eid}")

            # Увольнение (для уволенных)
            if emp["dismissed"] and (eid, "dismissal") not in has_doc and dismiss_date:
                cur.execute(
                    "INSERT INTO hr_document (type, date, employee_id, department_id, position_id) "
                    "VALUES ('dismissal', %s, %s, %s, %s)",
                    (dismiss_date, eid, emp["dept_id"], emp["pos_id"]),
                )
                has_doc.add((eid, "dismissal"))
                created_dismiss += 1

            # Пропуск
            pass_id = emp_to_pass.get(eid)
            if pass_id:
                if (eid, pass_id) not in has_link:
                    cur.execute(
                        "INSERT INTO employee_pass (employee_id, pass_id, date_from, date_to) "
                        "VALUES (%s, %s, %s, %s)",
                        (eid, pass_id, hire_date, dismiss_date if emp["dismissed"] else None),
                    )
                    has_link.add((eid, pass_id))
                    linked += 1
                # Уволенный с открытым пропуском — закрываем (пропуск сдан)
                if emp["dismissed"] and dismiss_date and (eid, pass_id) in open_links:
                    cur.execute(
                        "UPDATE employee_pass SET date_to = %s WHERE employee_id = %s AND pass_id = %s AND date_to IS NULL",
                        (dismiss_date, eid, pass_id),
                    )
                    open_links.discard((eid, pass_id))
                    closed += 1
    pg.commit()

    print(f"  Приёмов создано: {created_hire}, пересчитано дат приёма: {fixed_hire}, увольнений: {created_dismiss}")
    print(f"  Пропусков выдано: {linked}, закрыто: {closed}")
    if skipped_no_events:
        print(f"  Без событий турникета (документы не созданы): {skipped_no_events}")


def main():
    parser = argparse.ArgumentParser(description="Инкрементальный импорт из MSSQL в PostgreSQL")
    parser.add_argument(
        "--no-data",
        action="store_true",
        help="Импортировать только справочники и сотрудников (без табеля и событий турникета)",
    )
    args = parser.parse_args()

    print("=== Инкрементальный импорт из MSSQL в PostgreSQL ===\n")
    ms = connect_mssql()
    pg = connect_pg()
    try:
        import_day_marks(pg)
        div_map = import_divisions(ms, pg)
        pos_map = import_positions(ms, pg)
        sched_map = import_schedules(ms, pg)
        emp_map, emp_info, new_ids = import_employees(ms, pg, div_map, pos_map)
        import_employee_schedules(ms, pg, emp_map, sched_map)
        emp_to_pass = import_passes(pg)
        ensure_dummy_passes(pg, emp_info, emp_to_pass)

        if not args.no_data:
            tz_delta = parse_tz_offset(pg)
            import_turnstile_events(ms, pg, emp_map, emp_to_pass)
            import_worktime(ms, pg, emp_map)
            finalize_docs_and_passes(pg, emp_info, new_ids, emp_to_pass, tz_delta)
        else:
            print("\nПропущено: табель и события турникета (--no-data)")
            print("Пропущено: финализация документов/пропусков (нужны события)")

        print("\n=== Импорт завершён успешно ===")
    except Exception as e:
        print(f"\nОШИБКА: {e}")
        pg.rollback()
        raise
    finally:
        ms.close()
        pg.close()


if __name__ == "__main__":
    main()
