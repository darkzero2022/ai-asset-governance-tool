#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-deps.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib-deps.sh"

MODE=""
DATABASE=""
DATA=""
YES="false"
INSTALL_DEPS="false"
SKIP_DEPS="false"
ADMIN_DEFER="false"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_NAME="${ADMIN_NAME:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
APP_PORT_OPT=""
DB_PORT_OPT=""
FRONTEND_PORT_OPT=""
MIN_PASSWORD_LEN=12

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
  --port=N                    API + web app port (default: 4000)
  --db-port=N                 PostgreSQL host port (default: 55432)
  --frontend-port=N           Vite dev-server port, local mode only (default: 5173)
  --admin-email=EMAIL         Login (email) for the initial admin account
  --admin-name=NAME           Display name for the initial admin (default: "Admin User")
  --admin-password=PASSWORD   Password for the initial admin (>= ${MIN_PASSWORD_LEN} chars, not common; default: random, printed)
  --admin-defer               Don't create the admin now — do it on the app's first-run screen
  --install-deps              Install any missing system dependencies without asking
  --skip-deps                 Do not check or install system dependencies
  --yes                       Non-interactive: take defaults, and install missing deps
  -h, --help                  Show this help

Dependencies checked/installed: Node ${NODE_MIN_MAJOR}+, npm (for local mode); Docker + the
compose plugin (for docker mode / --database=docker); openssl (optional — a
Node/urandom fallback is used if absent).
EOF
}

for arg in "$@"; do
  case "$arg" in
    --mode=*) MODE="${arg#*=}" ;;
    --database=*) DATABASE="${arg#*=}" ;;
    --data=*) DATA="${arg#*=}" ;;
    --port=*) APP_PORT_OPT="${arg#*=}" ;;
    --db-port=*) DB_PORT_OPT="${arg#*=}" ;;
    --frontend-port=*) FRONTEND_PORT_OPT="${arg#*=}" ;;
    --admin-email=*) ADMIN_EMAIL="${arg#*=}" ;;
    --admin-name=*) ADMIN_NAME="${arg#*=}" ;;
    --admin-password=*) ADMIN_PASSWORD="${arg#*=}" ;;
    --admin-defer) ADMIN_DEFER="true" ;;
    --install-deps) INSTALL_DEPS="true" ;;
    --skip-deps) SKIP_DEPS="true" ;;
    --yes) YES="true" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage; exit 1 ;;
  esac
done

valid_port() {
  case "$1" in *[!0-9]*|"") return 1 ;; esac
  [ "$1" -ge 1024 ] && [ "$1" -le 65535 ]
}

ask_choice() {
  local prompt="$1" default="$2" answer=""
  read -r -p "$prompt [$default]: " answer
  echo "${answer:-$default}"
}

ask_password() {
  local p1 p2 allow_blank="${1:-false}"
  while true; do
    if [ "$allow_blank" = "true" ]; then
      read -rs -p "Admin password (blank = generate a strong random one): " p1; printf '\n' >&2
    else
      read -rs -p "Admin password (>= ${MIN_PASSWORD_LEN} chars, not a common password): " p1; printf '\n' >&2
    fi
    if [ -z "$p1" ]; then
      [ "$allow_blank" = "true" ] && { echo ""; return; }
      echo "  A password is required. (Re-run with --admin-defer to set it in the app instead.)" >&2; continue
    fi
    if [ "${#p1}" -lt "$MIN_PASSWORD_LEN" ]; then echo "  Password must be at least ${MIN_PASSWORD_LEN} characters." >&2; continue; fi
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

# rand_hex32 / rand_password come from lib-deps.sh (openssl → node → urandom fallback).
rand_secret() { rand_hex32; }

# --- resolve options -----------------------------------------------------
echo "── Environment ──────────────────────────────────────────────" >&2
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

# --- ports --------------------------------------------------------------
echo "── Ports ────────────────────────────────────────────────────" >&2
existing_port() { env_get .env "$1"; }
APP_PORT="${APP_PORT_OPT:-$(existing_port PORT)}"; APP_PORT="${APP_PORT:-4000}"
DB_PORT="${DB_PORT_OPT:-$(existing_port DB_PORT)}"; DB_PORT="${DB_PORT:-55432}"
FRONTEND_PORT="${FRONTEND_PORT_OPT:-$(existing_port FRONTEND_PORT)}"; FRONTEND_PORT="${FRONTEND_PORT:-5173}"
if [ "$YES" != "true" ]; then
  [ -z "$APP_PORT_OPT" ] && APP_PORT="$(ask_choice "API + web app port" "$APP_PORT")"
  if [ "$DATABASE" != "url" ]; then [ -z "$DB_PORT_OPT" ] && DB_PORT="$(ask_choice "PostgreSQL host port" "$DB_PORT")"; fi
  if [ "$MODE" = "local" ]; then [ -z "$FRONTEND_PORT_OPT" ] && FRONTEND_PORT="$(ask_choice "Vite dev-server port" "$FRONTEND_PORT")"; fi
fi
for p in "$APP_PORT" "$DB_PORT" "$FRONTEND_PORT"; do
  valid_port "$p" || { echo "Port '$p' must be an integer 1024-65535." >&2; exit 1; }
done
if [ "$APP_PORT" = "$DB_PORT" ] || [ "$APP_PORT" = "$FRONTEND_PORT" ] || { [ "$DATABASE" != "url" ] && [ "$DB_PORT" = "$FRONTEND_PORT" ]; }; then
  echo "The app, database, and frontend ports must all be different." >&2; exit 1
fi

# --- admin account ----------------------------------------------------
echo "── Admin account ────────────────────────────────────────────" >&2
if [ -z "$ADMIN_EMAIL" ]; then
  if [ "$YES" = "true" ]; then ADMIN_EMAIL="admin@example.com"; else ADMIN_EMAIL="$(ask_choice "Admin email (this is the login)" "admin@example.com")"; fi
fi
case "$ADMIN_EMAIL" in *@*.*) ;; *) echo "--admin-email must look like an email address" >&2; exit 1 ;; esac

if [ -z "$ADMIN_NAME" ]; then
  if [ "$YES" = "true" ]; then ADMIN_NAME="Admin User"; else ADMIN_NAME="$(ask_choice "Admin display name" "Admin User")"; fi
fi

if [ -z "$ADMIN_PASSWORD" ] && [ "$YES" != "true" ] && [ "$ADMIN_DEFER" != "true" ]; then
  ADMIN_PASSWORD="$(ask_password false)"
fi
if [ -n "$ADMIN_PASSWORD" ] && [ "${#ADMIN_PASSWORD}" -lt "$MIN_PASSWORD_LEN" ]; then
  echo "Admin password must be at least ${MIN_PASSWORD_LEN} characters." >&2; exit 1
fi

# --- prerequisites: detect, offer to install --------------------------
echo "── Dependencies ─────────────────────────────────────────────" >&2
if [ "$SKIP_DEPS" != "true" ]; then
  NEED="openssl"
  [ "$MODE" = "local" ] && NEED="$NEED node npm"
  { [ "$MODE" = "docker" ] || [ "$DATABASE" = "docker" ]; } && NEED="$NEED docker"
  # openssl is optional (fallback exists) — only auto-install it alongside others.
  have openssl || NEED="$(echo "$NEED" | sed 's/\bopenssl\b//')"
  ensure_dependencies "$NEED" "$INSTALL_DEPS" "$YES" "${MODE}/${DATABASE}"
fi
if [ "$MODE" = "local" ]; then require_command node; require_command npm; fi
if { [ "$MODE" = "docker" ] || [ "$DATABASE" = "docker" ]; }; then
  require_command docker
  docker compose version >/dev/null 2>&1 || { echo "The 'docker compose' plugin is required. $(install_hint docker)" >&2; exit 1; }
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
  if port_listening "$APP_PORT"; then
    echo "Port $APP_PORT is in use — pick another with --port, or stop the other process." >&2
    errors=1
  fi

  # Vite dev port (local mode only).
  if [ "$MODE" = "local" ] && port_listening "$FRONTEND_PORT"; then
    echo "Port $FRONTEND_PORT (frontend dev server) is in use — pick another with --frontend-port." >&2
    errors=1
  fi

  # Database port — only when we would be the one to bind it.
  case "$DATABASE" in
    managed)
      # Skip if data/pg already exists — a running instance there is our own.
      if [ ! -d data/pg ] && port_listening "$DB_PORT"; then
        echo "Port $DB_PORT is in use — the bundled database can't start. Pick another with --db-port or use --database=url." >&2
        errors=1
      fi
      ;;
    docker)
      if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx aibom-postgres && port_listening "$DB_PORT"; then
        echo "Port $DB_PORT is in use — pick another with --db-port or point --database=url at the existing server." >&2
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
[ -n "$(env_get .env BIND_HOST)" ] || env_set .env BIND_HOST "127.0.0.1"

# Ports: persist the resolved values (the user may have changed them on a re-run).
env_set .env PORT "$APP_PORT"
env_set .env DB_PORT "$DB_PORT"
env_set .env FRONTEND_PORT "$FRONTEND_PORT"

PG_USER="$(env_get .env POSTGRES_USER)"
PG_PASS="$(env_get .env POSTGRES_PASSWORD)"
PG_DB="$(env_get .env POSTGRES_DB)"

if [ "$DATABASE" = "url" ]; then
  if [ -z "$(env_get .env DATABASE_URL)" ]; then
    echo "--database=url needs DATABASE_URL set in .env. Add it and re-run." >&2
    exit 1
  fi
else
  # managed + docker: bundled/containered PostgreSQL on 127.0.0.1:$DB_PORT.
  env_set .env DATABASE_URL "postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:${DB_PORT}/${PG_DB}?schema=public"
fi

# Localhost-based APP_URL / CORS_ORIGIN track the chosen port; a non-localhost
# value (a real deployment URL) is left alone.
_app_url="$(env_get .env APP_URL)"
case "${_app_url:-http://localhost}" in *localhost*|*127.0.0.1*|"") env_set .env APP_URL "http://localhost:${APP_PORT}" ;; esac
_cors="$(env_get .env CORS_ORIGIN)"
case "${_cors:-http://localhost}" in *localhost*|*127.0.0.1*|"") env_set .env CORS_ORIGIN "http://localhost:${APP_PORT}" ;; esac

# backend/.env: derived, for local backend runs + the Prisma CLI.
if [ "$MODE" = "local" ]; then
  [ -f backend/.env ] || : > backend/.env
  env_set backend/.env DATABASE_URL "$(env_get .env DATABASE_URL)"
  env_set backend/.env JWT_SECRET "$(env_get .env JWT_SECRET)"
  env_set backend/.env PORT "$APP_PORT"
  env_set backend/.env CORS_ORIGIN "$(env_get .env CORS_ORIGIN)"
  env_set backend/.env APP_URL "$(env_get .env APP_URL)"
  [ "$DATABASE" = "managed" ] && env_set backend/.env MANAGED_PG_PORT "$DB_PORT"
fi

# An interactive run always has a password by now. --admin-defer leaves the
# account to the app's first-run screen; otherwise (a --yes run with no
# password given) a strong one is generated and printed.
ADMIN_VIA_WIZARD="false"
if [ -z "$ADMIN_PASSWORD" ]; then
  if [ "$ADMIN_DEFER" = "true" ]; then
    ADMIN_VIA_WIZARD="true"
  else
    ADMIN_PASSWORD="$(rand_password)"  # rand_password yields 24 chars
    ADMIN_GENERATED="true"
  fi
fi

export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
set -a
# shellcheck disable=SC1091
. ./.env
set +a
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD

if [ "$MODE" = "docker" ]; then
  docker compose build backend
  docker compose up -d postgres
  docker compose run --rm backend npx prisma migrate deploy
  docker compose run --rm -e ADMIN_EMAIL -e ADMIN_NAME -e ADMIN_PASSWORD backend npm run prisma:seed:reference
  if [ "$DATA" = "demo" ]; then
    docker compose run --rm -e ADMIN_EMAIL backend npm run prisma:seed:demo
  fi
else
  (cd packages/shared && npm install && npm run build)
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
echo "Mode: $MODE   Database: $DATABASE   Data: $DATA"
echo "App:  ${APP_URL_OUT}"
[ "$MODE" = "local" ] && echo "Dev:  http://localhost:${FRONTEND_PORT}  (Vite dev server via scripts/start.sh)"
[ "$DATABASE" != "url" ] && echo "DB:   127.0.0.1:${DB_PORT}"
echo "Config is in .env (generated secrets are gitignored)."
if [ "$ADMIN_VIA_WIZARD" = "true" ]; then
  echo "Admin account: none seeded — open ${APP_URL_OUT} and create it on first visit."
elif [ "${ADMIN_GENERATED:-false}" = "true" ]; then
  echo "Admin login: $ADMIN_EMAIL   (name: $ADMIN_NAME)"
  echo "Admin password: $ADMIN_PASSWORD   (generated — change it on the Account page)"
else
  echo "Admin login: $ADMIN_EMAIL   (name: $ADMIN_NAME)"
  echo "Admin password: the value you supplied."
fi
echo "To reset the admin password later, re-run:"
echo "  scripts/setup.sh --mode=$MODE --database=$DATABASE --data=$DATA --admin-email='$ADMIN_EMAIL' --admin-password='NEW' --yes"
