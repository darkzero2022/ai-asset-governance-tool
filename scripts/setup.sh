#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE=""
DATA=""
YES="false"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

usage() {
  cat >&2 <<EOF
Usage: scripts/setup.sh [options]

  --mode=local|docker        Install mode
  --data=empty|demo          Seed data
  --admin-email=EMAIL        Login for the initial admin account (default admin@example.com)
  --admin-password=PASSWORD  Password for the initial admin (default: a random one is generated)
  --yes                      Non-interactive; take defaults for anything not given
EOF
}

for arg in "$@"; do
  case "$arg" in
    --mode=*) MODE="${arg#*=}" ;;
    --data=*) DATA="${arg#*=}" ;;
    --admin-email=*) ADMIN_EMAIL="${arg#*=}" ;;
    --admin-password=*) ADMIN_PASSWORD="${arg#*=}" ;;
    --yes) YES="true" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage; exit 1 ;;
  esac
done

ask_choice() {
  local prompt="$1"
  local default="$2"
  local answer=""
  read -r -p "$prompt [$default]: " answer
  echo "${answer:-$default}"
}

ask_password() {
  local p1 p2
  while true; do
    read -rs -p "Admin password (leave blank to generate a strong random one): " p1; printf '\n' >&2
    if [ -z "$p1" ]; then echo ""; return; fi
    if [ "${#p1}" -lt 8 ]; then echo "  Password must be at least 8 characters." >&2; continue; fi
    read -rs -p "Confirm admin password: " p2; printf '\n' >&2
    if [ "$p1" = "$p2" ]; then echo "$p1"; return; fi
    echo "  Passwords did not match, try again." >&2
  done
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

# --- .env helpers -----------------------------------------------------------
# Read KEY from an env file (value only, no quotes stripped beyond the first =).
env_get() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  sed -n "s/^${key}=//p" "$file" | head -n1
}

# Upsert KEY=VALUE in an env file, preserving the rest of the file.
env_set() {
  local file="$1" key="$2" value="$3"
  if [ -f "$file" ] && grep -q "^${key}=" "$file"; then
    # Use a portable in-place edit (BSD/GNU sed differ on -i).
    local tmp; tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k"="v; next} {print}' "$file" > "$tmp"
    mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

rand_secret() { openssl rand -hex 32; }
rand_password() { openssl rand -base64 24 | tr -d '/+=' | cut -c1-32; }

if [ -z "$MODE" ]; then
  if [ "$YES" = "true" ]; then MODE="local"; else MODE="$(ask_choice "Install mode: local or docker" "local")"; fi
fi

if [ -z "$DATA" ]; then
  if [ "$YES" = "true" ]; then DATA="empty"; else DATA="$(ask_choice "Data mode: empty or demo" "empty")"; fi
fi

if [ -z "$ADMIN_EMAIL" ]; then
  if [ "$YES" = "true" ]; then ADMIN_EMAIL="admin@example.com"; else ADMIN_EMAIL="$(ask_choice "Admin email (login)" "admin@example.com")"; fi
fi

if [ -z "$ADMIN_PASSWORD" ] && [ "$YES" != "true" ]; then
  ADMIN_PASSWORD="$(ask_password)"
fi

case "$MODE" in local|docker) ;; *) echo "--mode must be local or docker" >&2; exit 1 ;; esac
case "$DATA" in empty|demo) ;; *) echo "--data must be empty or demo" >&2; exit 1 ;; esac
case "$ADMIN_EMAIL" in *@*.*) ;; *) echo "--admin-email must look like an email address" >&2; exit 1 ;; esac
if [ -n "$ADMIN_PASSWORD" ] && [ "${#ADMIN_PASSWORD}" -lt 8 ]; then
  echo "Admin password must be at least 8 characters" >&2; exit 1
fi

require_command openssl
if [ "$MODE" = "docker" ]; then
  require_command docker
fi
if [ "$MODE" = "local" ]; then
  require_command node
  require_command npm
  require_command docker
fi

cd "$ROOT_DIR"

# --- Root .env: the single source of truth --------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# Both install modes currently use the docker postgres service for the database.
env_set .env DB_MODE "docker"

# Secrets: generate once, never overwrite an existing value.
[ -n "$(env_get .env JWT_SECRET)" ] || env_set .env JWT_SECRET "$(rand_secret)"
[ -n "$(env_get .env POSTGRES_PASSWORD)" ] || env_set .env POSTGRES_PASSWORD "$(rand_password)"
[ -n "$(env_get .env POSTGRES_USER)" ] || env_set .env POSTGRES_USER "aibom"
[ -n "$(env_get .env POSTGRES_DB)" ] || env_set .env POSTGRES_DB "aibom"
[ -n "$(env_get .env PORT)" ] || env_set .env PORT "4000"
[ -n "$(env_get .env BIND_HOST)" ] || env_set .env BIND_HOST "127.0.0.1"

PG_USER="$(env_get .env POSTGRES_USER)"
PG_PASS="$(env_get .env POSTGRES_PASSWORD)"
PG_DB="$(env_get .env POSTGRES_DB)"
APP_PORT="$(env_get .env PORT)"

# DATABASE_URL: build the host-side URL (127.0.0.1:55432) unless one is pinned.
if [ -z "$(env_get .env DATABASE_URL)" ]; then
  env_set .env DATABASE_URL "postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:55432/${PG_DB}?schema=public"
fi
[ -n "$(env_get .env APP_URL)" ] || env_set .env APP_URL "http://localhost:${APP_PORT}"
[ -n "$(env_get .env CORS_ORIGIN)" ] || env_set .env CORS_ORIGIN "http://localhost:${APP_PORT}"

# --- backend/.env: derived, for local backend runs + the Prisma CLI -------
if [ "$MODE" = "local" ]; then
  [ -f backend/.env ] || : > backend/.env
  env_set backend/.env DATABASE_URL "$(env_get .env DATABASE_URL)"
  env_set backend/.env JWT_SECRET "$(env_get .env JWT_SECRET)"
  env_set backend/.env PORT "$(env_get .env PORT)"
  env_set backend/.env CORS_ORIGIN "$(env_get .env CORS_ORIGIN)"
  env_set backend/.env APP_URL "$(env_get .env APP_URL)"
fi

# The admin account is created by the reference seed from these env vars. The
# password is used for this run only and never written to disk; a blank password
# tells the seed to generate a strong random one and print it.
export ADMIN_EMAIL ADMIN_PASSWORD

# Make the root .env available to compose / seed subprocesses.
set -a
# shellcheck disable=SC1091
. ./.env
set +a
# Flags/prompt win over anything sourced from .env.
export ADMIN_EMAIL ADMIN_PASSWORD

if [ "$MODE" = "local" ]; then
  docker compose up -d postgres
  (cd backend && npm install && npm run prisma:generate && npx prisma migrate deploy)
  (cd frontend && npm install)
  (cd backend && npm run prisma:seed:reference)
  if [ "$DATA" = "demo" ]; then
    (cd backend && npm run prisma:seed:demo)
  fi
else
  docker compose build backend
  docker compose up -d postgres
  docker compose run --rm backend npx prisma migrate deploy
  docker compose run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD backend npm run prisma:seed:reference
  if [ "$DATA" = "demo" ]; then
    docker compose run --rm -e ADMIN_EMAIL backend npm run prisma:seed:demo
  fi
fi

cat > .aibom-mode <<EOF
MODE=$MODE
DATA=$DATA
EOF

echo
echo "Setup complete. Run scripts/start.sh to start AI-BOM."
echo "Config is in .env (secrets generated here are gitignored)."
echo "Admin login: $ADMIN_EMAIL"
if [ -n "$ADMIN_PASSWORD" ]; then
  echo "Admin password: the value you supplied."
else
  echo "Admin password: printed by the reference seed above (randomly generated)."
fi
echo "Change it on the Users page after first login. To reset it later, re-run:"
echo "  scripts/setup.sh --mode=$MODE --data=$DATA --admin-email='$ADMIN_EMAIL' --admin-password='NEW' --yes"
