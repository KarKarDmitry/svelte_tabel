#!/usr/bin/env python3
"""Загрузка конфигурации импорта из .env / окружения — без секретов в коде."""

import os

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def _find_env():
    d = _SCRIPT_DIR
    while True:
        cand = os.path.join(d, ".env")
        if os.path.exists(cand):
            return cand
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


def load_env():
    """Читает .env из корня репозитория (если есть) в os.environ. Не перезаписывает уже заданные."""
    path = _find_env()
    if not path:
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip("'\""))


def _req(name):
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(
            f"Отсутствует переменная окружения {name} — задайте в .env (см. .env.example)"
        )
    return val


def mssql_config():
    return {
        "server": _req("MSSQL_SERVER"),
        "database": _req("MSSQL_DATABASE"),
        "user": _req("MSSQL_USER"),
        "password": _req("MSSQL_PASSWORD"),
        "port": int(os.environ.get("MSSQL_PORT", "1433")),
    }


def pg_config():
    return {
        "host": os.environ.get("PG_HOST", "localhost"),
        "port": int(os.environ.get("PG_PORT", "5432")),
        "dbname": os.environ.get("PG_DB", "mettem"),
        "user": _req("PG_USER"),
        "password": _req("PG_PASSWORD"),
    }