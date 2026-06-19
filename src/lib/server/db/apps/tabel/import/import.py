#!/usr/bin/env python3
"""Импорт данных из MSSQL (OPP_R) в PostgreSQL (tabel)"""

import json
from datetime import date, datetime, time

import psycopg2
import pymssql
from psycopg2.extras import execute_values

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
    "dbname": "tabel",
    "user": "karkardmitry",
    "password": "i_am_password_please_change_me",
}


DAY_MARKS = [
    ("Явка", "Я", "I", "work", None, False),
    ("Ночная смена", "Н", "N", "work", None, False),
    ("Ежегодный отпуск", "ОТ", "OT", "paid_absence", "27", False),
    ("Отпуск по уходу", "ОД", "OD", "paid_absence", "27", False),
    ("-", "О", "O", "paid_absence", "27", False),
    ("-", "ОА", "OA", "paid_absence", "27", False),
    ("-", "ОД1", "OD1", "paid_absence", "28.1", False),
    ("-", "ДС", "DS", "paid_absence", "28.3", False),
    ("Учебный отпуск", "У", "U", "paid_absence", "23", False),
    ("-", "УД", "UD", "paid_absence", "22", False),
    ("-", "ОР", "OR", "unpaid_absence", "43", False),
    ("-", "ОЖ", "OZH", "paid_absence", "39", False),
    ("-", "ОЗ", "OZ", "unpaid_absence", "27", False),
    ("Больничный", "Б", "B", "paid_absence", "24", False),
    ("-", "БТ", "BT", "paid_absence", "24.8", False),
    ("-", "Г", "G", "paid_absence", "13", False),
    ("-", "ОВ", "OV", "paid_absence", "12", False),
    ("Административный отпуск", "АО", "AO", "unpaid_absence", None, False),
    ("Прогул", "ПР", "PR", "violation", None, False),
    ("Выходной", "В", "W", "day_off", None, False),
    ("Командировка", "К", "K", "paid_absence", "7.1", False),
    ("-", "С", "S", "paid_absence", "18", False),
    ("-", "РВ", "RV", "paid_absence", "19", False),
    ("Отпуск за свой счёт", "Д", "D", "unpaid_absence", "33", False),
    ("-", "НП", "NP", "unpaid_absence", "18.1", False),
    ("-", "НОД", "NOD", "paid_absence", "12.2", False),
]


def time_to_minutes(t):
    if not t:
        return 480
    if isinstance(t, time):
        return t.hour * 60 + t.minute
    if isinstance(t, str):
        parts = t.split(":")
        return int(parts[0]) * 60 + (int(parts[1]) if len(parts) > 1 else 0)
    return 480


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


def clear_tables(pg):
    print("Очистка таблиц...")
    with pg.cursor() as cur:
        cur.execute("TRUNCATE TABLE worktime_tracker CASCADE")
        cur.execute("TRUNCATE TABLE employee_schedule CASCADE")
        cur.execute("TRUNCATE TABLE hr_document CASCADE")
        cur.execute("TRUNCATE TABLE employee CASCADE")
        cur.execute("TRUNCATE TABLE schedule CASCADE")
        cur.execute("TRUNCATE TABLE day_mark CASCADE")
        cur.execute("TRUNCATE TABLE department CASCADE")
        cur.execute("TRUNCATE TABLE position CASCADE")
    pg.commit()
    print("  OK")


def import_day_marks(pg):
    print("Импорт day_mark...")
    with pg.cursor() as cur:
        for name, short, code, cat, rcode, excl in DAY_MARKS:
            # code = shortName — используем русские обозначения как код
            cur.execute(
                "INSERT INTO day_mark (name, short_name, code, category, report_code, report_exclude) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (name, short, short, cat, rcode, excl),
            )
    pg.commit()
    print(f"  OK: {len(DAY_MARKS)}")

    # MARK_COLOR_RULES (ключи — code, не shortName)
    print("Импорт app_constant (MARK_COLOR_RULES)...")
    with pg.cursor() as cur:
        cur.execute(
            """INSERT INTO app_constant (key, value, is_json, hint)
               VALUES (%s, %s, true, %s)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
            (
                "MARK_COLOR_RULES",
                json.dumps(
                    {
                        "ПР": {
                            "bg": "#fee2e2",
                            "color": "#991b1b",
                            "fontWeight": "bold",
                        },
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
            (
                "SHIFT_MARK_SHORTNAMES",
                "Я,Н",
                "Список shortName отметок, считающихся рабочими",
            ),
        )
        # CELL_COLOR_RULES
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
    print(
        "  OK: app_constant (MARK_COLOR_RULES, SHIFT_MARK_SHORTNAMES, CELL_COLOR_RULES)"
    )


def import_divisions(ms, pg):
    print("Импорт department (Divisions)...")
    with ms.cursor(as_dict=True) as cur:
        cur.execute(
            "SELECT ID, Name FROM Divisions WHERE IsDeleted IS NULL ORDER BY ID"
        )
        rows = cur.fetchall()
    id_map = {}
    with pg.cursor() as cur:
        for row in rows:
            cur.execute(
                "INSERT INTO department (name) VALUES (%s) RETURNING id", (row["Name"],)
            )
            id_map[row["ID"]] = cur.fetchone()[0]
    pg.commit()
    print(f"  OK: {len(rows)}")
    return id_map


def import_positions(ms, pg):
    print("Импорт position (Posts)...")
    with ms.cursor(as_dict=True) as cur:
        cur.execute("SELECT ID, Name FROM Posts WHERE IsDeleted IS NULL ORDER BY ID")
        rows = cur.fetchall()
    id_map = {}
    with pg.cursor() as cur:
        for row in rows:
            cur.execute(
                "INSERT INTO position (name) VALUES (%s) RETURNING id", (row["Name"],)
            )
            id_map[row["ID"]] = cur.fetchone()[0]
    pg.commit()
    print(f"  OK: {len(rows)}")
    return id_map


def time_str_to_minutes(s):
    """'08:00:00' или '08:00' → minutes. Пустое/None → None"""
    if not s:
        return None
    if isinstance(s, time):
        return s.hour * 60 + s.minute
    parts = str(s).split(":")
    return int(parts[0]) * 60 + (int(parts[1]) if len(parts) > 1 else 0)


def import_schedules(ms, pg):
    print("Импорт schedule (Schedules)...")
    with ms.cursor(as_dict=True) as cur:
        cur.execute("""
            SELECT ID, Name, StandartWorkTime,
                   ArrivalTime, DepartureTime,
                   LeftArrivalTimeBound, RightArrivalTimeBound,
                   LeftDepartureTimeBound, RightDepartureTimeBound,
                   WithLunch, LunchStartTime, LunchLeftTimeBound, LunchEnd, LunchRightBound
            FROM Schedules ORDER BY ID
        """)
        rows = cur.fetchall()
    id_map = {}
    with pg.cursor() as cur:
        for row in rows:
            std_min = time_to_minutes(row["StandartWorkTime"])
            cur.execute(
                "INSERT INTO schedule (name, standard_work_time, week_days) VALUES (%s, %s, %s) RETURNING id",
                (row["Name"], std_min, "[1,2,3,4,5]"),
            )
            new_id = cur.fetchone()[0]
            id_map[row["ID"]] = new_id

            # --- Schedule points ---
            # Entry (ArrivalTime)
            arr = time_str_to_minutes(row.get("ArrivalTime"))
            if arr is not None:
                lb = time_str_to_minutes(row.get("LeftArrivalTimeBound"))
                rb = time_str_to_minutes(row.get("RightArrivalTimeBound"))
                cur.execute(
                    "INSERT INTO schedule_point (schedule_id, type, time, left_bound, right_bound) "
                    "VALUES (%s, 'Entry', %s, %s, %s)",
                    (new_id, f"{arr // 60:02d}:{arr % 60:02d}", lb or 0, rb or 0),
                )

            # Exit (DepartureTime)
            dep = time_str_to_minutes(row.get("DepartureTime"))
            if dep is not None:
                lb = time_str_to_minutes(row.get("LeftDepartureTimeBound"))
                rb = time_str_to_minutes(row.get("RightDepartureTimeBound"))
                cur.execute(
                    "INSERT INTO schedule_point (schedule_id, type, time, left_bound, right_bound) "
                    "VALUES (%s, 'Exit', %s, %s, %s)",
                    (new_id, f"{dep // 60:02d}:{dep % 60:02d}", lb or 0, rb or 0),
                )

                # Break (Lunch)
                if row.get("WithLunch"):
                    ls = time_str_to_minutes(row.get("LunchStartTime"))
                    le = time_str_to_minutes(row.get("LunchEnd"))
                    if ls is not None:
                        end_str = (
                            f"{le // 60:02d}:{le % 60:02d}" if le is not None else None
                        )
                        lb = time_str_to_minutes(row.get("LunchLeftTimeBound")) or 0
                        rb = time_str_to_minutes(row.get("LunchRightBound")) or 0
                        cur.execute(
                            "INSERT INTO schedule_point (schedule_id, type, time, end_time, left_bound, right_bound) "
                            "VALUES (%s, 'Break', %s, %s, %s, %s)",
                            (new_id, f"{ls // 60:02d}:{ls % 60:02d}", end_str, lb, rb),
                        )

    pg.commit()
    print(f"  OK: {len(rows)}")
    return id_map


def import_employees(ms, pg, div_map, pos_map):
    print("Импорт employee (Employees)...")
    with ms.cursor(as_dict=True) as cur:
        cur.execute("""
            SELECT ID, Number, LastName, FirstName, Patronymic, Post, Division, IsTimeWorker
            FROM Employees WHERE IsDeleted IS NULL ORDER BY ID
        """)
        rows = cur.fetchall()
    id_map = {}
    seen_numbers = set()
    auto_inc = 1
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
            cur.execute(
                "INSERT INTO employee (number, last_name, first_name, middle_name) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (
                    num,
                    row["LastName"] or "",
                    row["FirstName"] or "",
                    row["Patronymic"] or None,
                ),
            )
            new_id = cur.fetchone()[0]
            id_map[row["ID"]] = new_id
            dept_id = div_map.get(row["Division"])
            pos_id = pos_map.get(row["Post"])
            if dept_id and pos_id:
                cur.execute(
                    "INSERT INTO hr_document (type, date, employee_id, department_id, position_id) "
                    "VALUES ('hiring', '2000-01-01', %s, %s, %s)",
                    (new_id, dept_id, pos_id),
                )
    pg.commit()
    print(f"  OK: {len(rows)}")
    return id_map


def import_employee_schedules(ms, pg, emp_map, sched_map):
    print("Импорт employee_schedule (EmployeeSchedules)...")
    with ms.cursor(as_dict=True) as cur:
        cur.execute("SELECT ID, Employee, Schedule FROM EmployeeSchedules ORDER BY ID")
        rows = cur.fetchall()
    count = 0
    with pg.cursor() as cur:
        for row in rows:
            new_emp = emp_map.get(row["Employee"])
            new_sched = sched_map.get(row["Schedule"])
            if not new_emp or not new_sched:
                continue
            cur.execute(
                "INSERT INTO employee_schedule (employee_id, schedule_id) VALUES (%s, %s)",
                (new_emp, new_sched),
            )
            count += 1
    pg.commit()
    print(f"  OK: {count}")


def load_worktime_table(ms, table_name):
    """Загружает данные из одной таблицы (WorkTimeTracker или WorkTimeTrackerMaster)"""
    with ms.cursor(as_dict=True) as cur:
        cur.execute(f"""
            SELECT Employee, Date, WorkTime, NightHours, IsNightShift, DayMarkCode
            FROM {table_name} ORDER BY Employee, Date
        """)
        return cur.fetchall()


def import_worktime(ms, pg, emp_map):
    print("Импорт worktime_tracker (WorkTimeTracker + Master)...")

    # Загружаем из основной таблицы (с ручными правками) — приоритет
    primary = load_worktime_table(ms, "WorkTimeTracker")
    # Загружаем из мастер-таблицы (авто-часы) — fallback
    fallback = load_worktime_table(ms, "WorkTimeTrackerMaster")

    # Строим словарь: ключ (employee, date) → True для primary
    primary_keys = set()
    for row in primary:
        primary_keys.add((row["Employee"], row["Date"]))

    # Объединяем: сначала primary, потом fallback (если нет в primary)
    merged = list(primary)
    for row in fallback:
        if (row["Employee"], row["Date"]) not in primary_keys:
            merged.append(row)

    print(
        f"  WorkTimeTracker: {len(primary)} записей, WorkTimeTrackerMaster: {len(fallback)}, всего: {len(merged)}"
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
                """,
                    batch,
                )
            pg.commit()
            batch = []
            print(f"  ... {count}/{len(agg)}")
    if batch:
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
            """,
                batch,
            )
        pg.commit()
    print(f"  OK: {count}")


def main():
    print("=== Импорт из MSSQL в PostgreSQL ===\n")
    ms = connect_mssql()
    pg = connect_pg()
    try:
        clear_tables(pg)
        import_day_marks(pg)
        div_map = import_divisions(ms, pg)
        pos_map = import_positions(ms, pg)
        sched_map = import_schedules(ms, pg)
        emp_map = import_employees(ms, pg, div_map, pos_map)
        import_employee_schedules(ms, pg, emp_map, sched_map)
        import_worktime(ms, pg, emp_map)
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
