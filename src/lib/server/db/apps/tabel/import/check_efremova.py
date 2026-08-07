#!/usr/bin/env python3
"""Ефремова Светлана Вадимовна: записи в MSSQL Employees и её события."""
from import_incremental import connect_mssql, fix_encoding

ms = connect_mssql()

with ms.cursor(as_dict=True) as cur:
    cur.execute(
        """
        SELECT ID, Number, LastName, FirstName, Patronymic, Post, Division, IsDeleted
        FROM Employees
        WHERE LastName = N'Ефремова' AND FirstName = N'Светлана'
        ORDER BY ID
        """
    )
    rows = cur.fetchall()

print("=== MSSQL Employees: Ефремова Светлана ===")
for r in rows:
    print(
        f"  ID={r['ID']:<5} Number={str(r['Number'] or '')!s:<6} "
        f"Post={r['Post']} Division={r['Division']} IsDeleted={r['IsDeleted']}"
    )

# Справочники Post/Division
ids_post = {r["Post"] for r in rows if r["Post"]}
ids_div = {r["Division"] for r in rows if r["Division"]}
if ids_post:
    with ms.cursor(as_dict=True) as cur:
        cur.execute(
            "SELECT ID, Name FROM Posts WHERE ID IN (" + ",".join(str(i) for i in ids_post) + ")"
        )
        posts = {r["ID"]: r["Name"] for r in cur.fetchall()}
else:
    posts = {}
if ids_div:
    with ms.cursor(as_dict=True) as cur:
        cur.execute(
            "SELECT ID, Name FROM Divisions WHERE ID IN (" + ",".join(str(i) for i in ids_div) + ")"
        )
        divs = {r["ID"]: r["Name"] for r in cur.fetchall()}
else:
    divs = {}

for r in rows:
    print(
        f"    ID={r['ID']} → Пост: {posts.get(r['Post'], '?')} | Отдел: {divs.get(r['Division'], '?')}"
    )

# События турникета по этим ID
ids = [r["ID"] for r in rows]
if ids:
    with ms.cursor(as_dict=True) as cur:
        cur.execute(
            "SELECT Employee, COUNT(*) AS cnt, MIN(Date) AS first_d, MAX(Date) AS last_d "
            "FROM TurnstileEventTracker WHERE Employee IN ("
            + ",".join(str(i) for i in ids)
            + ") GROUP BY Employee"
        )
        print("\n=== MSSQL TurnstileEventTracker ===")
        for r in cur.fetchall():
            print(f"  Employee={r['Employee']}: событий={r['cnt']}, {r['first_d']} … {r['last_d']}")

ms.close()
