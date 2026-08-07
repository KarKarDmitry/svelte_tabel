#!/usr/bin/env python3
"""Сравнение уволенных сотрудников: MSSQL (IsDeleted) vs PostgreSQL.

Для каждого уволенного показывает:
- есть ли в PG;
- есть ли документ об увольнении в PG;
- есть ли события в MSSQL TurnstileEventTracker;
- есть ли пропуск в Excel (employee_events.xls);
- есть ли события в PG.
"""
from import_incremental import connect_mssql, connect_pg, fix_encoding, import_passes, os, xlrd

ms = connect_mssql()
pg = connect_pg()

# --- Колонки MSSQL Employees ---
with ms.cursor(as_dict=True) as cur:
    cur.execute(
        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Employees' ORDER BY ORDINAL_POSITION"
    )
    print("=== Колонки MSSQL Employees ===")
    for r in cur.fetchall():
        print(f"  {r['COLUMN_NAME']:<22} {r['DATA_TYPE']}")

# --- Уволенные в MSSQL ---
with ms.cursor(as_dict=True) as cur:
    cur.execute(
        """
        SELECT ID, Number, LastName, FirstName, Patronymic, Post, Division
        FROM Employees WHERE IsDeleted IS NOT NULL ORDER BY ID
        """
    )
    mssql_dismissed = cur.fetchall()
print(f"\nMSSQL: уволенных (IsDeleted IS NOT NULL) — {len(mssql_dismissed)}")

# --- События уволенных в MSSQL TurnstileEventTracker ---
with ms.cursor(as_dict=True) as cur:
    cur.execute(
        """
        SELECT Employee, COUNT(*) AS cnt, MIN(Date) AS first_d, MAX(Date) AS last_d
        FROM TurnstileEventTracker GROUP BY Employee
        """
    )
    mssql_events = {r["Employee"]: (r["cnt"], r["first_d"], r["last_d"]) for r in cur.fetchall()}

# --- PG ---
with pg.cursor() as cur:
    cur.execute("SELECT id, number, last_name, first_name FROM employee")
    pg_rows = cur.fetchall()

pg_by_number = {}
pg_by_name = {}
for eid, num, ln, fn in pg_rows:
    num_s = str(num or "").strip()
    if num_s:
        pg_by_number[num_s] = (eid, ln or "", fn or "")
    full = f"{(ln or '').strip().lower()} {(fn or '').strip().lower()}"
    pg_by_name[full] = (eid, ln or "", fn or "")

with pg.cursor() as cur:
    cur.execute("SELECT employee_id FROM hr_document WHERE type = 'dismissal'")
    dismissed_in_pg = {r[0] for r in cur.fetchall()}

with pg.cursor() as cur:
    cur.execute("SELECT employee_id, COUNT(*) FROM turnstile_event_tracker GROUP BY employee_id")
    pg_events = {r[0]: r[1] for r in cur.fetchall()}

# --- Пропуска из Excel ---
emp_to_pass = import_passes(pg)

print(f"\nPG: документов об увольнении — {len(dismissed_in_pg)}")

no_dismissal = []
missing = []
with_dismissal = []
for row in mssql_dismissed:
    mid = row["ID"]
    num = str(row["Number"] or "").strip()
    name = f"{fix_encoding(row['LastName'] or '').strip()} {fix_encoding(row['FirstName'] or '').strip()}".strip()
    name_key = name.lower()

    emp = pg_by_number.get(num) or pg_by_name.get(name_key)
    ev_ms = mssql_events.get(mid)

    if emp is None:
        missing.append((num or "-", name, mid, ev_ms))
        continue

    eid = emp[0]
    row_out = (
        num or "-",
        name,
        eid,
        bool(ev_ms),
        ev_ms[2] if ev_ms else None,          # последний вход MSSQL (Date)
        eid in emp_to_pass,                    # есть пропуск из Excel
        pg_events.get(eid, 0),
        eid in dismissed_in_pg,
    )
    if eid in dismissed_in_pg:
        with_dismissal.append(row_out)
    else:
        no_dismissal.append(row_out)

def fmt(r):
    return (
        f"№{r[0]:<7} {r[1]:<40} pg={r[2]:<5} mssql_ev={r[3]!s:<5} last_in={r[4]} "
        f"pass_excel={r[5]!s:<5} pg_ev={r[6]:<5} dismiss={r[7]}"
    )

print(f"\n=== Есть увольнение в PG: {len(with_dismissal)} ===")
for r in with_dismissal:
    print("  " + fmt(r))

print(f"\n=== НЕТ увольнения в PG: {len(no_dismissal)} ===")
for r in no_dismissal:
    print("  " + fmt(r))

print(f"\n=== НЕТ в PG вообще: {len(missing)} ===")
for num, name, mid, ev in missing:
    print(f"  №{num:<7} {name:<40} mssql_id={mid} events={ev}")

ms.close()
pg.close()
