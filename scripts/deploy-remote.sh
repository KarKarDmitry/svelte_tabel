#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:?archive}"
DEPLOY_DIR="${2:?deploy dir}"
COMPOSE_PROJECT="${3:-svelte_tabel}"
ENV_FILE="${4:--}"
REQUESTED="${5:-app}"
APP_IMAGE="${6:-svelte_tabel-app:latest}"
DB_IMAGE="${7:-tabel-db:latest}"
NGINX_IMAGE="${8:-svelte_tabel-nginx:latest}"

APP_PREVIOUS="${APP_IMAGE%:*}:previous"
DB_PREVIOUS="${DB_IMAGE%:*}:previous"
NGINX_PREVIOUS="${NGINX_IMAGE%:*}:previous"

STAGING="${DEPLOY_DIR}.new"
ROLLBACK_ARMED=0
DEPLOYED_SERVICES=""

export APP_IMAGE DB_IMAGE NGINX_IMAGE

log() {
	printf '\n== %s ==\n' "$*"
}

container_for() {
	case "$1" in
		app) echo tabel-app ;;
		db) echo tabel-db ;;
		nginx) echo tabel-nginx ;;
	esac
}

image_for() {
	case "$1" in
		app) echo "$APP_IMAGE" ;;
		db) echo "$DB_IMAGE" ;;
		nginx) echo "$NGINX_IMAGE" ;;
	esac
}

previous_for() {
	case "$1" in
		app) echo "$APP_PREVIOUS" ;;
		db) echo "$DB_PREVIOUS" ;;
		nginx) echo "$NGINX_PREVIOUS" ;;
	esac
}

image_var_for() {
	case "$1" in
		app) echo APP_IMAGE ;;
		db) echo DB_IMAGE ;;
		nginx) echo NGINX_IMAGE ;;
	esac
}

build_service() {
	case "$1" in
		app) docker build --secret id=env,src=.env -t "$APP_IMAGE" . ;;
		db) docker build -f Dockerfile.db -t "$DB_IMAGE" . ;;
		nginx) docker build -f Dockerfile.nginx -t "$NGINX_IMAGE" . ;;
	esac
}

save_previous() {
	local service="$1"
	local container
	local previous
	local previous_id
	container="$(container_for "$service")"
	previous="$(previous_for "$service")"
	if docker inspect "$container" >/dev/null 2>&1; then
		previous_id=$(docker inspect "$container" --format '{{.Image}}')
		if docker image inspect "$previous_id" >/dev/null 2>&1; then
			docker tag "$previous_id" "$previous" >/dev/null 2>&1 \
				|| echo "Could not save $service previous image" >&2
		elif ! docker commit "$container" "$previous" >/dev/null 2>&1; then
			echo "Could not save $service previous image; rollback disabled for it" >&2
		fi
	else
		echo "No current $container; no previous image saved" >&2
	fi
}

compose_up() {
	local service="$1"
	local image="$2"
	local var
	var="$(image_var_for "$service")"
	env "$var=$image" docker compose -p "$COMPOSE_PROJECT" up -d --force-recreate --no-build --no-deps "$service"
}

normalize_services() {
	local requested="$1"
	local out=""
	local service
	if [ "$requested" = "all" ]; then
		requested="db nginx app"
	fi
	for service in db nginx app; do
		case " $requested " in
			*" $service "*) out="$out $service" ;;
		esac
	done
	out="${out# }"
	if [ -z "$out" ]; then
		echo "No valid services in: $requested" >&2
		exit 2
	fi
	echo "$out"
}

health_app() {
	local root_code=""
	local login_code
	local body
	local db_code
	for _ in $(seq 1 40); do
		root_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1/ || true)
		if [ "$root_code" = "302" ]; then
			break
		fi
		sleep 1
	done
	if [ "$root_code" != "302" ]; then
		echo "App root check failed: HTTP $root_code" >&2
		return 1
	fi

	login_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1/auth/login || true)
	if [ "$login_code" != "200" ]; then
		echo "App login page check failed: HTTP $login_code" >&2
		return 1
	fi

	body=$(mktemp)
	db_code=$(curl -sS -o "$body" -w '%{http_code}' --max-time 10 \
		-X POST -H 'Content-Type: application/x-www-form-urlencoded' \
		--data "username=deploy-check-$(date +%s)&password=deploy-check-invalid" \
		'http://127.0.0.1/auth/login?/signIn' || true)
	if [ "$db_code" -ge 500 ] 2>/dev/null || grep -q 'Failed query' "$body"; then
		echo "App DB check failed: HTTP $db_code" >&2
		cat "$body" >&2 || true
		rm -f "$body"
		return 1
	fi
	rm -f "$body"
}

health_db() {
	local db_user
	db_user=$(docker inspect tabel-db --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
		| sed -n 's/^POSTGRES_USER=//p' | head -n 1 || true)
	for _ in $(seq 1 30); do
		if docker exec tabel-db pg_isready -U "${db_user:-postgres}" >/dev/null 2>&1; then
			return 0
		fi
		sleep 1
	done
	echo "DB pg_isready check failed" >&2
	return 1
}

health_nginx() {
	local root_code=""
	if ! docker exec tabel-nginx nginx -t >/dev/null 2>&1; then
		echo "Nginx config test failed" >&2
		return 1
	fi
	for _ in $(seq 1 30); do
		root_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1/ || true)
		if [ "$root_code" = "302" ]; then
			return 0
		fi
		sleep 1
	done
	echo "Nginx root check failed: HTTP $root_code" >&2
	return 1
}

health_service() {
	case "$1" in
		app) health_app ;;
		db) health_db ;;
		nginx) health_nginx ;;
	esac
}

rollback() {
	local service
	local previous
	cd "$DEPLOY_DIR" 2>/dev/null || true
	echo "Rolling back deployed services..." >&2
	for service in app nginx db; do
		case " $DEPLOYED_SERVICES " in
			*" $service "*)
				previous="$(previous_for "$service")"
				if docker image inspect "$previous" >/dev/null 2>&1; then
					echo "Restoring $service from $previous" >&2
					compose_up "$service" "$previous" >/dev/null 2>&1 \
						&& echo "$service restored" >&2 \
						|| echo "Failed to restore $service" >&2
				else
					echo "No previous image for $service" >&2
				fi
				;;
		esac
	done
}

on_exit() {
	rc=$?
	trap - EXIT
	if [ "$ROLLBACK_ARMED" = "1" ]; then
		rollback
	fi
	exit "$rc"
}
trap on_exit EXIT

SERVICES="$(normalize_services "$REQUESTED")"

log "Extracting source to $STAGING"
rm -rf "$STAGING"
mkdir -p "$STAGING"
tar -xzf "$ARCHIVE" -C "$STAGING"

log "Preparing .env"
if [ "$ENV_FILE" != "-" ] && [ -f "$ENV_FILE" ]; then
	cp "$ENV_FILE" "$STAGING/.env"
elif [ -f "$DEPLOY_DIR/.env" ]; then
	cp "$DEPLOY_DIR/.env" "$STAGING/.env"
else
	echo "Remote .env not found: $DEPLOY_DIR/.env" >&2
	echo "Run with DEPLOY_SYNC_ENV=1 to upload local .env" >&2
	exit 1
fi
chmod 600 "$STAGING/.env"
sed -i 's/\r$//' "$STAGING/.env"

log "Saving previous images"
docker rm -f tabel-app-old >/dev/null 2>&1 || true
for service in $SERVICES; do
	save_previous "$service"
done

cd "$STAGING"
for service in $SERVICES; do
	log "Building $service -> $(image_for "$service")"
	build_service "$service"
done

log "Syncing source into $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -a "$STAGING/." "$DEPLOY_DIR/"
rm -rf "$STAGING"

cd "$DEPLOY_DIR"

log "Validating compose config"
docker compose -p "$COMPOSE_PROJECT" config >/dev/null

log "Preparing containers"
ROLLBACK_ARMED=1
for service in $SERVICES; do
	container="$(container_for "$service")"
	if docker inspect "$container" >/dev/null 2>&1; then
		current_project=$(docker inspect "$container" --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || true)
		if [ -z "$current_project" ] || [ "$current_project" != "$COMPOSE_PROJECT" ]; then
			case " $DEPLOYED_SERVICES " in
				*" $service "*) ;;
				*) DEPLOYED_SERVICES="$DEPLOYED_SERVICES $service" ;;
			esac
			docker rm -f "$container" >/dev/null 2>&1 || true
		fi
	fi
done

for service in $SERVICES; do
	case " $DEPLOYED_SERVICES " in
		*" $service "*) ;;
		*) DEPLOYED_SERVICES="$DEPLOYED_SERVICES $service" ;;
	esac
	log "Recreating $service -> $(image_for "$service")"
	compose_up "$service" "$(image_for "$service")"
	health_service "$service"
done

ROLLBACK_ARMED=0
log "Deploy OK: $SERVICES"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
