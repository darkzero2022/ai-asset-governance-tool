#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE=""
DATABASE=""
DATA=""
YES="false"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

usage() {
  cat >&2 <<EOF
Usage: scripts/setup.sh [options]

  --mode=local|docker         Where the app runs (default: local)
  --database=managed|docker|url
                              Where PostgreSQL comes from:
                                managed - bundled PostgreSQL, no Docker (local default)
                                docker  - the postgres service in docker-compose.yml
                                url     - an existing server (set DATABASE_URL in .env)
  --data=empty|demo           Seed data (default: empty)
  --admin-email=EMAIL         Login for the initial admin account
  --admin-password=PASSWORD   Password for the initial admin (default: random, printed)
  --yes                       Non-interactive; take defaults for anything not given
EOF
}

for arg in "$@"; do
  case "$arg" in
    --mode=*) MODE="${arg#*=}" ;;
    --database=*) DATABASE="${arg#*=}" ;;
    --data=*) DATA="${arg#*=}" ;;
    --admin-email=*) ADMIN_EMAIL="${arg#*=}" ;;
    --admin-password=*) ADMIN_PASSWORD="${arg#*=}" ;;
    --yes) YES="true" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage; exit 1 ;;
  esac
done

ask_choice() {
  local prompt="$1" default="$2" answer=""
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

# --- .env helpers ----------------------------------------------------------
env_get() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  sed -n "s/^${key}=//p" "$file" | head -n1
}

env_set() {
  local file="$1" key="$2" value="$3"
  if [ -f "$file" ] && grep -q "^${key}=" "$file"; then
    local tmp; tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k"="v; next} {print}' "$file" > "$tmp"
    mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

rand_secret() { openssl rand -hex 32; }
rand_password() { openssl rand -base64 24 | tr -d '/+=' | cut -c1-32; }

# --- resolve options -----------------------------------------------------
if [ -z "$MODE" ]; then
  if [ "$YES" = "true" ]; then MODE="local"; else MODE="$(ask_choice "Install mode: local or docker" "local")"; fi
fi
case "$MODE" in local|docker) ;; *) echo "--mode must be local or docker" >&2; exit 1 ;; esac

if [ -z "$DATABASE" ]; then
  if [ "$MODE" = "docker" ]; then
    DATABASE="docker"
  elif [ "$YES" = "true" ]; then
    DATABASE="managed"
  else
    DATABASE="$(ask_choice "Database: managed (bundled, no Docker), docker, or url" "managed")"
  fi
fi
case "$DATABASE" in managed|docker|url) ;; *) echo "--database must be managed, docker, or url" >&2; exit 1 ;; esac
if [ "$MODE" = "docker" ] && [ "$DATABASE" != "docker" ]; then
  echo "--mode=docker requires --database=docker" >&2; exit 1
fi

if [ -z "$DATA" ]; then
  if [ "$YES" = "true" ]; then DATA="empty"; else DATA="$(ask_choice "Data mode: empty or demo" "empty")"; fi
fi
case "$DATA" in empty|demo) ;; *) echo "--data must be empty or demo" >&2; exit 1 ;; esac

if [ -z "$ADMIN_EMAIL" ]; then
  if [ "$YES" = "true" ]; then ADMIN_EMAIL="admin@example.com"; else ADMIN_EMAIL="$(ask_choice "Admin email (login)" "admin@example.com")"; fi
fi
case "$ADMIN_EMAIL" in *@*.*) ;; *) echo "--admin-email must look like an email address" >&2; exit 1 ;; esac

if [ -z "$ADMIN_PASSWORD" ] && [ "$YES" != "true" ]; then
  ADMIN_PASSWORD="$(ask_password)"
fi
if [ -n "$ADMIN_PASSWORD" ] && [ "${#ADMIN_PASSWORD}" -lt 8 ]; then
  echo "Admin password must be at least 8 characters" >&2; exit 1
fi

# --- prerequisites -----------------------------------------------------
require_command openssl
if [ "$MODE" = "local" ]; then
  require_command node
  require_command npm
fi
if [ "$DATABASE" = "docker" ]; then
  require_command docker
fi

cd "$ROOT_DIR"

# --- preflight: fail early, before touching anything -------------------
port_listening() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1
}

preflight() {
  local errors=0

  # Node 22+ for local mode.
  if [ "$MODE" = "local" ]; then
    local major
    major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [ "$major" -lt 22 ]; then
      echo "Node 22+ is required for local mode (found $(node -v 2>/dev/null || echo none)) — install a newer Node or use --mode=docker." >&2
      errors=1
    fi
  fi

  # App port.
  local app_port; app_port="$(env_get .env PORT)"; app_port="${app_port:-4000}"
  if port_listening "$app_port"; then
    echo "Port $app_port is in use — stop the other process or set PORT in .env." >&2
    errors=1
  fi

  # Vite dev port (local mode only).
  if [ "$MODE" = "local" ] && port_listening 5173; then
    echo "Port 5173 (frontend dev server) is in use — stop the other process before running scripts/start.sh." >&2
    errors=1
  fi

  # Database port — only when we would be the one to bind it.
  case "$DATABASE" in
    managed)
      # Skip if data/pg already exists — a running instance there is our own.
      if [ ! -d data/pg ] && port_listening 55432; then
        echo "Port 55432 is in use — the bundled database can't start. Stop whatever is on 55432 or use --database=url." >&2
        errors=1
      fi
      ;;
    docker)
      if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx aibom-postgres && port_listening 55432; then
        echo "Port 55432 is in use — free it or point --database=url at the existing server." >&2
        errors=1
      fi
      ;;
    url)
      local url host port
      url="$(env_get .env DATABASE_URL)"
      host="$(printf '%s' "$url" | sed -nE 's#.*@([^:/]+):([0-9]+)/.*#\1#p')"
      port="$(printf '%s' "$url" | sed -nE 's#.*@([^:/]+):([0-9]+)/.*#\2#p')"
      if [ -n "$host" ] && [ -n "$port" ] && [ "$host" = "127.0.0.1" -o "$host" = "localhost" ]; then
        if ! port_listening "$port"; then
          echo "DATABASE_URL points at $host:$port but nothing is listening there — start your database first." >&2
          errors=1
        fi
      fi
      ;;
  esac

  [ "$errors" -eq 0 ] || { echo "Preflight checks failed. Nothing was changed." >&2; exit 1; }
}
preflight

# --- Root .env: the single source of truth ---------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

env_set .env DB_MODE "$DATABASE"

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

if [ "$DATABASE" = "url" ]; then
  if [ -z "$(env_get .env DATABASE_URL)" ]; then
    echo "--database=url needs DATABASE_URL set in .env. Add it and re-run." >&2
    exit 1
  fi
else
  # managed + docker: bundled/containered PostgreSQL on 127.0.0.1:55432.
  env_set .env DATABASE_URL "postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:55432/${PG_DB}?schema=public"
fi
[ -n "$(env_get .env APP_URL)" ] || env_set .env APP_URL "http://localhost:${APP_PORT}"
[ -n "$(env_get .env CORS_ORIGIN)" ] || env_set .env CORS_ORIGIN "http://localhost:${APP_PORT}"

# backend/.env: derived, for local backend runs + the Prisma CLI.
if [ "$MODE" = "local" ]; then
  [ -f backend/.env ] || : > backend/.env
  env_set backend/.env DATABASE_URL "$(env_get .env DATABASE_URL)"
  env_set backend/.env JWT_SECRET "$(env_get .env JWT_SECRET)"
  env_set backend/.env PORT "$(env_get .env PORT)"
  env_set backend/.env CORS_ORIGIN "$(env_get .env CORS_ORIGIN)"
  env_set backend/.env APP_URL "$(env_get .env APP_URL)"
fi

# Demo data needs an admin to own it, so generate a password when none was given.
# Empty data leaves the admin account to the app's first-run screen.
ADMIN_VIA_WIZARD="false"
if [ -z "$ADMIN_PASSWORD" ]; then
  if [ "$DATA" = "demo" ]; then
    ADMIN_PASSWORD="$(rand_password)"
    ADMIN_GENERATED="true"
  else
    ADMIN_VIA_WIZARD="true"
  fi
fi

export ADMIN_EMAIL ADMIN_PASSWORD
set -a
# shellcheck disable=SC1091
. ./.env
set +a
export ADMIN_EMAIL ADMIN_PASSWORD

if [ "$MODE" = "docker" ]; then
  docker compose build backend
  docker compose up -d postgres
  docker compose run --rm backend npx prisma migrate deploy
  docker compose run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD backend npm run prisma:seed:reference
  if [ "$DATA" = "demo" ]; then
    docker compose run --rm -e ADMIN_EMAIL backend npm run prisma:seed:demo
  fi
else
  (cd backend && npm install && npm run prisma:generate)
  (cd frontend && npm install)

  case "$DATABASE" in
    managed) (cd backend && npm run db:start) ;;
    docker) docker compose up -d postgres ;;
    url) : ;;  # external server
  esac

  (cd backend && npx prisma migrate deploy)
  (cd backend && npm run prisma:seed:reference)
  if [ "$DATA" = "demo" ]; then
    (cd backend && npm run prisma:seed:demo)
  fi
fi

cat > .aibom-mode <<EOF
MODE=$MODE
DATABASE=$DATABASE
DATA=$DATA
EOF

APP_URL_OUT="$(env_get .env APP_URL)"
echo
echo "Setup complete. Run scripts/start.sh to start AI-BOM."
echo "Mode: $MODE   Database: $DATABASE"
echo "Config is in .env (generated secrets are gitignored)."
if [ "$ADMIN_VIA_WIZARD" = "true" ]; then
  echo "Admin account: none seeded — open ${APP_URL_OUT} and create it on first visit."
elif [ "${ADMIN_GENERATED:-false}" = "true" ]; then
  echo "Admin login: $ADMIN_EMAIL"
  echo "Admin password: $ADMIN_PASSWORD   (generated — change it on the Users page)"
else
  echo "Admin login: $ADMIN_EMAIL"
  echo "Admin password: the value you supplied."
fi
echo "To reset the admin password later, re-run:"
echo "  scripts/setup.sh --mode=$MODE --database=$DATABASE --data=$DATA --admin-email='$ADMIN_EMAIL' --admin-password='NEW' --yes"
