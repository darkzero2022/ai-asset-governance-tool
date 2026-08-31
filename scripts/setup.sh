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

require_command docker
require_command openssl
if [ "$MODE" = "local" ]; then
  require_command node
  require_command npm
fi

cd "$ROOT_DIR"

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
fi

JWT_SECRET="$(openssl rand -hex 32)"
if ! grep -q '^JWT_SECRET=' backend/.env || grep -q '^JWT_SECRET="change-this-in-development"' backend/.env; then
  if grep -q '^JWT_SECRET=' backend/.env; then
    sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=\"$JWT_SECRET\"/" backend/.env
    rm -f backend/.env.bak
  else
    printf '\nJWT_SECRET="%s"\n' "$JWT_SECRET" >> backend/.env
  fi
fi

# The admin account is created by the reference seed from these env vars. The
# password is used for this run only and never written to disk; a blank password
# tells the seed to generate a strong random one and print it.
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
  # Load backend/.env (JWT_SECRET etc.) for docker compose, but keep the admin
  # credentials resolved from the flags/prompt above — they win over the file.
  _admin_email="$ADMIN_EMAIL"; _admin_password="$ADMIN_PASSWORD"
  set -a
  . backend/.env
  set +a
  ADMIN_EMAIL="$_admin_email"; ADMIN_PASSWORD="$_admin_password"
  export ADMIN_EMAIL ADMIN_PASSWORD
  docker compose build backend frontend
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
echo "Admin login: $ADMIN_EMAIL"
if [ -n "$ADMIN_PASSWORD" ]; then
  echo "Admin password: the value you supplied."
else
  echo "Admin password: printed by the reference seed above (randomly generated)."
fi
echo "Change it on the Users page after first login. To reset it later, re-run:"
echo "  scripts/setup.sh --mode=$MODE --data=$DATA --admin-email='$ADMIN_EMAIL' --admin-password='NEW' --yes"
