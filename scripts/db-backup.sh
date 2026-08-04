#!/usr/bin/env bash
#
# Резервное копирование PostgreSQL (pgBackRest) для стека «табель».
# Работает с контейнером tabel-db, репозиторий — том svelte_tabel_pgbackups (D:/pg/tabel/pgbackups).
#
set -eu

STANZA="tabel"
CONTAINER="tabel-db"
IMAGE="tabel-db:latest"
PROJECT="svelte_tabel"
PGDATA_VOLUME="${PROJECT}_pgdata"
BACKUP_VOLUME="${PROJECT}_pgbackups"

usage() {
  cat <<EOF
Использование: db-backup.sh <команда> [label]

Команды:
  stanza-create   Инициализация репозитория (один раз после первого подъёма)
  check           Проверка конфигурации (репозиторий, архив)
  full            Полное копирование
  diff            Дифф копирование (разница с последним полным)
  incr            Инкремент копирование (разница с последним любым)
  list            Список точек восстановления
  restore [label] Восстановление из точки (интерактивный выбор, если label не задан)

Примеры:
  ./db-backup.sh full
  ./db-backup.sh restore 20260807-160000F
EOF
}

# Выполнить pgbackrest внутри работающего контейнера БД (от пользователя postgres)
# shellcheck disable=SC2317
in_container() {
  docker exec -u postgres "$CONTAINER" pgbackrest --stanza="$STANZA" "$@"
}

# Восстановление выполняется во временном контейнере (БД остановлена)
restore_from() {
  local label="$1"
  docker run --rm --name pgbackrest-restore \
    --user postgres \
    -v "${PGDATA_VOLUME}:/var/lib/postgresql" \
    -v "${BACKUP_VOLUME}:/var/lib/pgbackrest" \
    -v "$(pwd)/pgbackrest.conf:/etc/pgbackrest.conf:ro" \
    "$IMAGE" pgbackrest --stanza="$STANZA" --set="$label" --delta restore
}

case "${1:-}" in
  stanza-create)
    in_container stanza-create
    echo "OK: репозиторий инициализирован (stanza: $STANZA)"
    ;;
  check)
    in_container check
    ;;
	  full | diff | incr)
	    echo "Запуск ${1} бэкапа..."
	    in_container --type="$1" backup
	    echo "OK: ${1} бэкап завершён"
	    ;;
	  scheduled)
	    # Для планировщика: пятница 16:00 — полный, всё остальное — дифф
	    dow=$(date +%u) # 1=Пн ... 5=Пт ... 7=Вс
	    hour=$(date +%H)
	    if [[ "$dow" == "5" && "$hour" == "16" ]]; then
	      in_container --type=full backup
	      echo "OK: полный бэкап (пятница 16:00)"
	    else
	      in_container --type=diff backup
	      echo "OK: дифф бэкап"
	    fi
	    ;;
  list)
    in_container info
    ;;
  restore)
    label="${2:-}"
    if [[ -z "$label" ]]; then
      echo "Доступные точки восстановления:"
      in_container info
      echo
      read -r -p "Введите label точки (например 20260807-160000F): " label
    fi

    read -r -p "Восстановить '${label}'? Текущие данные будут заменены. Введите yes: " confirm
    if [[ "$confirm" != "yes" ]]; then
      echo "Отменено."
      exit 1
    fi

    echo "Останавливаю app и db..."
    docker compose stop app db

    echo "Восстанавливаю из ${label}..."
    if restore_from "$label"; then
      echo "Запускаю db и app..."
      docker compose start db app
      echo "OK: восстановлено из ${label}"
    else
      echo "ОШИБКА: восстановление не удалось. БД остановлена, смотри логи pgBackRest."
      exit 1
    fi
    ;;
  *)
    usage
    ;;
esac
