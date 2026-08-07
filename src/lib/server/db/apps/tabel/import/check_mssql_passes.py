#!/usr/bin/env python3
"""Диагностика MSSQL: таблицы с пропусками и их структура."""
from import_incremental import connect_mssql

ms = connect_mssql()

with ms.cursor(as_dict=True) as cur:
    cur.execute(
        """
        SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME LIKE '%Pass%' OR TABLE_NAME LIKE '%Card%'
           OR TABLE_NAME LIKE '%Employee%' OR TABLE_NAME LIKE '%Turnstile%'
        ORDER BY TABLE_NAME
        """
    )
    print("=== Таблицы MSSQL (Pass/Card/Employee/Turnstile) ===")
    for r in cur.fetchall():
        print(f"  {r['TABLE_TYPE']:<6} {r['TABLE_NAME']}")

# Если есть таблицы с Pass — покажем колонки
with ms.cursor(as_dict=True) as cur:
    cur.execute(
        """
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME IN (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
                             WHERE TABLE_NAME LIKE '%Pass%' OR TABLE_NAME LIKE '%Card%')
        ORDER BY TABLE_NAME, ORDINAL_POSITION
        """
    )
    rows = cur.fetchall()
    if rows:
        print("\n=== Колонки Pass/Card-таблиц ===")
        cur_table = None
        for r in rows:
            if r["TABLE_NAME"] != cur_table:
                print(f"\n  {r['TABLE_NAME']}:")
                cur_table = r["TABLE_NAME"]
            print(f"    {r['COLUMN_NAME']:<22} {r['DATA_TYPE']}")

ms.close()
