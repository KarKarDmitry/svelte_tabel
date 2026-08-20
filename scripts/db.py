#!/usr/bin/env python3
"""Управление резервным копированием и восстановлением PostgreSQL (pgBackRest) для стека «табель».

Команды:
  stanza-create   Инициализация репозитория (один раз после первого подъёма)
  check           Проверка конфигурации (репозиторий, архив)
  full            Полное копирование
  diff            Дифф копирование (разница с последним полным)
  incr            Инкремент копирование (разница с последним любым)
  scheduled       Для планировщика: пятница 16:00 — полный, иначе дифф
  list            Список точек восстановления
  restore         Интерактивное восстановление (выбор точки + PITR)
                  [--dry-run] — показать выбор без фактического восстановления

Примеры:
  python scripts/db.py full
  python scripts/db.py scheduled
  python scripts/db.py restore
  python scripts/db.py restore --dry-run
"""

import calendar
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

STANZA = "tabel"
CONTAINER = "tabel-db"
IMAGE = "tabel-db:latest"
PROJECT = "svelte_tabel"
PGDATA_VOLUME = f"{PROJECT}_pgdata"
BACKUP_VOLUME = f"{PROJECT}_pgbackups"
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# --- ANSI (для non-TTY вывода) ---
C_RESET = "\x1b[0m"
C_PITR = "\x1b[33;1m"  # жёлтый + bold — всегда
C_DIM = "\x1b[2m"
C_RED = "\x1b[31m"
C_CYAN = "\x1b[36m"
C_GREEN = "\x1b[32m"

# Стили prompt_toolkit
PTK_STYLE = {
    "selected": "fg:ansigreen bold",
    "pitr": "fg:ansiyellow bold",
    "help": "fg:ansibrightblack",
    "error": "fg:ansired",
    "header": "fg:ansicyan bold",
}


def eprint(*a, **kw):
    print(*a, file=sys.stderr, **kw)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def in_container(*args):
    """pgbackrest внутри работающего контейнера БД, вывод — напрямую в консоль."""
    return subprocess.run(
        [
            "docker",
            "exec",
            "-u",
            "postgres",
            CONTAINER,
            "pgbackrest",
            "--stanza=" + STANZA,
            *args,
        ]
    )


# --- Простые команды (бэкапы) ---


def run_simple(cmd):
    if cmd in ("full", "diff", "incr"):
        print(f"Запуск {cmd} бэкапа...")
        args = ["--type=" + cmd, "backup"]
    elif cmd == "stanza-create":
        args = ["stanza-create"]
    elif cmd == "check":
        args = ["check"]
    elif cmd == "list":
        args = ["info"]
    else:  # не должно случиться
        usage()
        sys.exit(1)

    r = in_container(*args)
    if r.returncode == 0:
        if cmd in ("full", "diff", "incr"):
            print(f"OK: {cmd} бэкап завершён")
        elif cmd == "stanza-create":
            print(f"OK: репозиторий инициализирован (stanza: {STANZA})")
    sys.exit(r.returncode)


def run_scheduled():
    """Для планировщика: пятница 16:00 — полный, всё остальное — дифф."""
    now = datetime.now()
    if now.isoweekday() == 5 and now.hour == 16:
        r = in_container("--type=full", "backup")
        print("OK: полный бэкап (пятница 16:00)")
    else:
        r = in_container("--type=diff", "backup")
        print("OK: дифф бэкап")
    sys.exit(r.returncode)


# --- Восстановление ---


def get_info():
    r = run(
        [
            "docker",
            "exec",
            "-u",
            "postgres",
            CONTAINER,
            "pgbackrest",
            "--stanza=" + STANZA,
            "info",
            "--output=json",
        ]
    )
    if r.returncode != 0:
        eprint(C_RED + "Ошибка получения списка бэкапов:" + C_RESET)
        eprint((r.stderr or r.stdout).strip())
        sys.exit(1)
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError as e:
        eprint(C_RED + "Не удалось разобрать вывод pgbackrest:" + C_RESET, e)
        sys.exit(1)
    return data[0]


def wal_mtime(walname, db_id):
    """mtime WAL-файла в репозитории (момент архивации) или None."""
    if not walname:
        return None
    timeline = walname[:16]
    cmd = (
        f"stat -c %Y /var/lib/pgbackrest/repo/archive/{STANZA}/{db_id}/"
        f"{timeline}/{walname}-* 2>/dev/null | head -1"
    )
    r = run(["docker", "exec", "-u", "postgres", CONTAINER, "sh", "-c", cmd])
    out = r.stdout.strip()
    return int(out) if out.isdigit() else None


def timeline_ends(db_id):
    """{timeline: mtime последнего WAL на этой линии} — фактический конец WAL."""
    cmd = (
        f"for d in /var/lib/pgbackrest/repo/archive/{STANZA}/{db_id}/*/; do "
        f'tl=$(basename "$d"); last=$(ls -1 "$d" | grep \'\\.gz$\' | sort | tail -1); '
        f'[ -n "$last" ] && echo "$tl $(stat -c %Y "$d/$last")"; done'
    )
    r = run(["docker", "exec", "-u", "postgres", CONTAINER, "sh", "-c", cmd])
    ends = {}
    for line in r.stdout.strip().splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0][:8].isdigit():
            ends[int(parts[0][:8], 16)] = int(parts[1])
    return ends


def fmt_dt(ts):
    return datetime.fromtimestamp(ts).strftime("%d.%m.%Y %H:%M")


# --- Выбор точки из списка ---


def select_row(rows, wal_line):
    if not sys.stdin.isatty():
        return select_row_non_tty(rows, wal_line)
    return select_row_ptk(rows, wal_line)


def render_list_text(rows, idx, top, height, wal_line):
    from prompt_toolkit.formatted_text import FormattedText

    segments = [("class:header", "Точки восстановления (время локальное):\n")]
    if wal_line:
        segments.append(("class:help", wal_line + "\n"))
    for i in range(top, min(top + height, len(rows))):
        row = rows[i]
        sel = i == idx
        prefix = "> " if sel else "  "
        base = (
            f"{prefix}{i + 1:>2}. {fmt_dt(row['stop'])}  "
            f"{row['type']:<4}  ({row['size_mb']} MB)  [{row['label']}]"
        )
        segments.append(("class:selected" if sel else "", base))
        if row["pitr"]:
            segments.append(("class:pitr", "  *PITR*"))
        segments.append(("", "\n"))
    segments.append(
        (
            "class:help",
            "↑/↓ — движение, PgUp/PgDn — ±5, Home/End — край, Enter — выбор, Esc/Ctrl+C — отмена",
        )
    )
    return FormattedText(segments)


def select_row_ptk(rows, wal_line):
    from prompt_toolkit.application import Application
    from prompt_toolkit.formatted_text import FormattedText
    from prompt_toolkit.key_binding import KeyBindings
    from prompt_toolkit.layout import FormattedTextControl, Layout, Window
    from prompt_toolkit.styles import Style

    height = min(len(rows), 12)
    state = {"idx": 0, "top": 0}

    def move(delta):
        new_idx = min(max(state["idx"] + delta, 0), len(rows) - 1)
        state["idx"] = new_idx
        if new_idx < state["top"]:
            state["top"] = new_idx
        elif new_idx >= state["top"] + height:
            state["top"] = new_idx - height + 1

    kb = KeyBindings()

    @kb.add("up")
    def _(event):
        move(-1)
        event.app.invalidate()

    @kb.add("down")
    def _(event):
        move(1)
        event.app.invalidate()

    @kb.add("pageup")
    def _(event):
        move(-5)
        event.app.invalidate()

    @kb.add("pagedown")
    def _(event):
        move(5)
        event.app.invalidate()

    @kb.add("home")
    def _(event):
        state["idx"] = 0
        state["top"] = 0
        event.app.invalidate()

    @kb.add("end")
    def _(event):
        state["idx"] = len(rows) - 1
        state["top"] = max(len(rows) - height, 0)
        event.app.invalidate()

    @kb.add("enter")
    def _(event):
        event.app.exit(result=rows[state["idx"]])

    @kb.add("escape")
    def _(event):
        event.app.exit(result=None)

    @kb.add("c-c")
    def _(event):
        event.app.exit(result=None)

    def get_text():
        return render_list_text(rows, state["idx"], state["top"], height, wal_line)

    app = Application(
        layout=Layout(Window(FormattedTextControl(get_text))),
        key_bindings=kb,
        style=Style.from_dict(PTK_STYLE),
        full_screen=True,
    )
    return app.run()


def select_row_non_tty(rows, wal_line):
    eprint("Точки восстановления (время локальное):")
    if wal_line:
        eprint(wal_line)
    for i, row in enumerate(rows):
        base = (
            f"{i + 1:>2}. {fmt_dt(row['stop'])}  {row['type']:<4}  "
            f"({row['size_mb']} MB)  [{row['label']}]"
        )
        mark = "  " + C_PITR + "*PITR*" + C_RESET if row["pitr"] else ""
        eprint("  " + base + mark)
    line = sys.stdin.readline().strip()
    if not line:
        return None
    if line.isdigit() and 1 <= int(line) <= len(rows):
        return rows[int(line) - 1]
    for row in rows:
        if row["label"] == line:
            return row
    return None


# --- Выбор PITR-времени ---

FIELDS = [
    ("Год", "year", 4),
    ("Месяц", "month", 2),
    ("День", "day", 2),
    ("Час", "hour", 2),
    ("Минута", "minute", 2),
]


def ask_target(row, lo_ts, hi_ts):
    if not sys.stdin.isatty():
        return ask_target_non_tty(row, lo_ts, hi_ts)
    return ask_target_ptk(row, lo_ts, hi_ts)


def ask_target_ptk(row, lo_ts, hi_ts):
    from prompt_toolkit.application import Application
    from prompt_toolkit.formatted_text import FormattedText
    from prompt_toolkit.key_binding import KeyBindings
    from prompt_toolkit.layout import FormattedTextControl, Layout, Window
    from prompt_toolkit.styles import Style

    lo = datetime.fromtimestamp(lo_ts).replace(second=0, microsecond=0)
    hi = datetime.fromtimestamp(hi_ts).replace(second=0, microsecond=0)

    state = {
        "year": lo.year,
        "month": lo.month,
        "day": lo.day,
        "hour": lo.hour,
        "minute": lo.minute,
        "field": 4,
        "sel": "backup",  # "backup" (конец бэкапа) | "time" (PITR)
        "error": "",
    }

    def current_dt():
        return datetime(
            state["year"], state["month"], state["day"], state["hour"], state["minute"]
        )

    def clamp_day():
        max_day = calendar.monthrange(state["year"], state["month"])[1]
        if state["day"] > max_day:
            state["day"] = max_day

    def bump(delta):
        name, key, width = FIELDS[state["field"]]
        if key == "year":
            state["year"] = min(max(state["year"] + delta, lo.year), hi.year)
        elif key == "month":
            state["month"] = min(max(state["month"] + delta, 1), 12)
        elif key == "day":
            state["day"] = min(max(state["day"] + delta, 1), 31)
        elif key == "hour":
            state["hour"] = min(max(state["hour"] + delta, 0), 23)
        elif key == "minute":
            state["minute"] = min(max(state["minute"] + delta, 0), 59)
        clamp_day()
        state["error"] = ""

    def accept(event):
        try:
            dt = current_dt()
        except ValueError as e:
            state["error"] = f"Некорректная дата: {e}"
            event.app.invalidate()
            return
        ts = dt.timestamp()
        if ts < lo_ts:
            state["error"] = f"Раньше конца бэкапа ({fmt_dt(lo_ts)})."
            event.app.invalidate()
            return
        if ts > hi_ts:
            state["error"] = f"Позже доступного WAL ({fmt_dt(hi_ts)})."
            event.app.invalidate()
            return
        target = dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        event.app.exit(result=("time", target))

    kb = KeyBindings()

    @kb.add("tab")
    def _(event):
        state["sel"] = "time" if state["sel"] == "backup" else "backup"
        state["error"] = ""
        event.app.invalidate()

    @kb.add("left")
    def _(event):
        if state["sel"] != "time":
            return
        state["field"] = (state["field"] - 1) % len(FIELDS)
        event.app.invalidate()

    @kb.add("right")
    def _(event):
        if state["sel"] != "time":
            return
        state["field"] = (state["field"] + 1) % len(FIELDS)
        event.app.invalidate()

    @kb.add("up")
    def _(event):
        if state["sel"] != "time":
            return
        bump(1)
        event.app.invalidate()

    @kb.add("down")
    def _(event):
        if state["sel"] != "time":
            return
        bump(-1)
        event.app.invalidate()

    @kb.add("enter")
    def _(event):
        if state["sel"] == "backup":
            event.app.exit(result=("immediate", ""))
        else:
            accept(event)

    @kb.add("escape")
    def _(event):
        event.app.exit(result=None)

    @kb.add("c-c")
    def _(event):
        event.app.exit(result=None)

    def get_text():
        parts = [
            (
                "class:header",
                f"Точка: {row['label']} ({row['type']}, {fmt_dt(row['stop'])}, timeline {row['timeline']}, локальное)\n",
            ),
            (
                "class:help",
                f"PITR-окно: {fmt_dt(lo_ts)} … {fmt_dt(hi_ts)} (локальное)\n\n",
            ),
        ]
        # Переключатель режима
        if state["sel"] == "backup":
            parts.append(("class:selected", "(•) конец бэкапа"))
            parts.append(("", "     "))
            parts.append(("", "( ) восстановить на время"))
        else:
            parts.append(("", "( ) конец бэкапа"))
            parts.append(("", "     "))
            parts.append(("class:selected", "(•) восстановить на время"))
        parts.append(("", "\n\n"))

        if state["sel"] == "time":
            for i, (name, key, width) in enumerate(FIELDS):
                text = f"{name}:{state[key]:0{width}d}"
                parts.append(("class:selected" if i == state["field"] else "", text))
                parts.append(("", "  "))
            parts.append(("", "\n"))
            parts.append(
                (
                    "class:help",
                    "←/→ — поле, ↑/↓ — ±1, Enter — принять время, Tab — режим, Esc — отмена",
                )
            )
        else:
            parts.append(
                (
                    "class:help",
                    "Будет восстановлен конец выбранного бэкапа. Tab — режим, Enter — подтвердить, Esc — отмена",
                )
            )
        if state["error"]:
            parts.append(("class:error", "\n" + state["error"]))
        return FormattedText(parts)

    app = Application(
        layout=Layout(Window(FormattedTextControl(get_text))),
        key_bindings=kb,
        style=Style.from_dict(PTK_STYLE),
        full_screen=True,
    )
    result = app.run()
    if result is None:
        return None
    return result


def ask_target_non_tty(row, lo_ts, hi_ts):
    eprint(
        f"Точка: {row['label']} ({row['type']}, {fmt_dt(row['stop'])}, timeline {row['timeline']}, локальное)."
    )
    eprint(f"PITR доступен: от {fmt_dt(lo_ts)} до {fmt_dt(hi_ts)} (локальное время).")
    while True:
        try:
            ans = input(
                "Введите время 'YYYY-MM-DD HH:MM' (локальное) или Enter — конец бэкапа: "
            ).strip()
        except EOFError:
            return "immediate", ""
        if not ans:
            return "immediate", ""
        try:
            local_tz = datetime.now().astimezone().tzinfo
            dt = datetime.strptime(ans, "%Y-%m-%d %H:%M").replace(tzinfo=local_tz)
        except ValueError:
            eprint(C_RED + "Неверный формат, ожидается YYYY-MM-DD HH:MM" + C_RESET)
            continue
        ts = dt.timestamp()
        if ts < lo_ts:
            eprint(C_RED + f"Раньше конца бэкапа ({fmt_dt(lo_ts)})." + C_RESET)
            continue
        if ts > hi_ts:
            eprint(C_RED + f"Позже доступного WAL ({fmt_dt(hi_ts)})." + C_RESET)
            continue
        return "time", dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def perform_restore(label, mode, target, timeline):
    """Подтверждение и само восстановление через docker."""
    desc = (
        f"(PITR до {target} UTC, timeline {timeline})"
        if mode == "time" and target
        else "(конец бэкапа)"
    )
    print(f"Восстановление из {label} {desc}")
    confirm = input(
        f"Восстановить '{label}'? Текущие данные будут заменены. Введите yes: "
    ).strip()
    if confirm != "yes":
        print("Отменено.")
        sys.exit(1)

    print("Останавливаю app и db...")
    r = subprocess.run(["docker", "compose", "stop", "app", "db"], cwd=PROJECT_ROOT)
    if r.returncode != 0:
        print("ОШИБКА: не удалось остановить контейнеры.")
        sys.exit(1)

    args = [
        "docker",
        "run",
        "--rm",
        "--name",
        "pgbackrest-restore",
        "--user",
        "postgres",
        "-v",
        f"{PGDATA_VOLUME}:/var/lib/postgresql",
        "-v",
        f"{BACKUP_VOLUME}:/var/lib/pgbackrest",
        "-v",
        f"{PROJECT_ROOT / 'pgbackrest.conf'}:/etc/pgbackrest.conf:ro",
        IMAGE,
        "pgbackrest",
        "--stanza=" + STANZA,
        "--set=" + label,
    ]
    if mode == "time" and target:
        args += ["--type=time", "--target=" + target, f"--target-timeline={timeline}"]
    else:
        args += ["--type=immediate"]
    # Без target-action=promote кластер замирает в конце recovery (read-only),
    # ожидая ручного pg_wal_replay_resume() — это блокирует бэкапы.
    args += ["--target-action=promote"]
    args += ["--delta", "restore"]

    print("Восстанавливаю...")
    r = subprocess.run(args)
    if r.returncode != 0:
        print(
            "ОШИБКА: восстановление не удалось. БД остановлена, смотри логи pgBackRest."
        )
        sys.exit(1)

    print("Запускаю db и app...")
    r = subprocess.run(["docker", "compose", "start", "db", "app"], cwd=PROJECT_ROOT)
    if r.returncode != 0:
        print("ОШИБКА: не удалось запустить контейнеры.")
        sys.exit(1)

    # pgBackRest может «успешно» восстановить файлы, но старт PostgreSQL упадёт,
    # если PITR-цель недостижима (не хватает WAL на timeline точки) — контейнер
    # с restart:always уйдёт в crash-loop. Ждём, пока кластер начнёт отвечать.
    ok = False
    for _ in range(15):
        time.sleep(2)
        p = subprocess.run(
            [
                "docker",
                "exec",
                CONTAINER,
                "sh",
                "-c",
                'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select 1"',
            ],
            capture_output=True,
            text=True,
        )
        if p.returncode == 0 and p.stdout.strip() == "1":
            ok = True
            break
    if not ok:
        print("ОШИБКА: БД не отвечает после восстановления.")
        print("Вероятно, PITR-цель недостижима (не хватает WAL на timeline точки).")
        print(
            "Повторите: npm run db:restore и выберите «конец бэкапа» (Enter) или время раньше."
        )
        sys.exit(1)
    print(f"OK: восстановлено из {label}")


def run_restore(dry_run=False):
    data = get_info()
    backups = sorted(data["backup"], key=lambda b: b["timestamp"]["stop"], reverse=True)
    db_id = data["archive"][0]["id"]
    wal_min = data["archive"][0].get("min")
    wal_max = data["archive"][0].get("max")
    wal_min_ts = wal_mtime(wal_min, db_id) if wal_min else None
    tl_ends = timeline_ends(db_id)
    now = time.time()

    rows = []
    for b in backups:
        stop = b["timestamp"]["stop"]
        # timeline бэкапа (из имени WAL, напр. 00000006... -> 6)
        timeline = int(b["archive"]["stop"][:8], 16)
        tl_end = tl_ends.get(timeline)
        # PITR доступен, если точка в окне хранения WAL и после неё есть WAL
        pitr = (
            stop < now - 60
            and (wal_min_ts is None or stop >= wal_min_ts)
            and (tl_end is not None and tl_end > stop + 120)
        )
        rows.append(
            {
                "label": b["label"],
                "type": b["type"],
                "stop": stop,
                "size_mb": round(b["info"]["size"] / 1048576, 1),
                "pitr": pitr,
                "timeline": timeline,
            }
        )

    if not rows:
        eprint(C_RED + "Нет ни одной точки восстановления." + C_RESET)
        sys.exit(1)

    wal_line = (
        "WAL-окно: "
        + (fmt_dt(wal_min_ts) if wal_min_ts else "—")
        + " … "
        + (fmt_dt(wal_mtime(wal_max, db_id)) if wal_max else "—")
        + " (локальное)"
    )

    row = select_row(rows, wal_line)
    if row is None:
        eprint("Отменено.")
        sys.exit(1)

    now = time.time()
    lo_ts = row["stop"] + 60
    hi_ts = now - 30
    # Фактический конец WAL на timeline точки (минус запас на задержку архивации)
    tl_end = tl_ends.get(row["timeline"])
    if tl_end:
        hi_ts = min(hi_ts, tl_end - 60)
    if hi_ts - lo_ts < 60:
        eprint(
            C_RED + f"ВНИМАНИЕ: для точки {row['label']} PITR практически недоступен — "
            f"WAL после неё почти нет (до {fmt_dt(tl_end) if tl_end else '—'})."
        )
        eprint("Будет выполнено восстановление на конец бэкапа." + C_RESET)
        mode, target = "immediate", ""
    else:
        result = ask_target(row, lo_ts, hi_ts)
        if result is None:
            eprint("Отменено.")
            sys.exit(1)
        mode, target = result
    if dry_run:
        print(row["label"])
        print(mode)
        print(target)
        return
    perform_restore(row["label"], mode, target, row["timeline"])


def usage():
    print(__doc__)


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help", "help"):
        usage()
        return

    cmd = args[0]
    if cmd == "restore":
        try:
            run_restore(dry_run="--dry-run" in args[1:])
        except KeyboardInterrupt:
            eprint("Отменено.")
            sys.exit(130)
    elif cmd in ("stanza-create", "check", "full", "diff", "incr", "list"):
        run_simple(cmd)
    elif cmd == "scheduled":
        run_scheduled()
    else:
        usage()
        sys.exit(1)


if __name__ == "__main__":
    main()
