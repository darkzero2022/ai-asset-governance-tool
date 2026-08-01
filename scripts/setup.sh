#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE=""
DATA=""
YES="false"

for arg in "$@"; do
  case "$arg" in
    --mode=*) MODE="${arg#*=}" ;;
    --data=*) DATA="${arg#*=}" ;;
    --yes) YES="true" ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

ask_choice() {
  local prompt="$1"
  local default="$2"
  local answer=""
  read -r -p "$prompt [$default]: " answer
  echo "${answer:-$default}"
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

case "$MODE" in local|docker) ;; *) echo "--mode must be local or docker" >&2; exit 1 ;; esac
case "$DATA" in empty|demo) ;; *) echo "--data must be empty or demo" >&2; exit 1 ;; esac

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

if [ "$MODE" = "local" ]; then
  docker compose up -d postgres
  (cd backend && npm install && npm run prisma:generate && npx prisma migrate deploy)
  (cd frontend && npm install)
  (cd backend && npm run prisma:seed:reference)
  if [ "$DATA" = "demo" ]; then
    (cd backend && npm run prisma:seed:demo)
  fi
else
  set -a
  . backend/.env
  set +a
  docker compose build backend frontend
  docker compose up -d postgres
  docker compose run --rm backend npx prisma migrate deploy
  docker compose run --rm backend npm run prisma:seed:reference
  if [ "$DATA" = "demo" ]; then
    docker compose run --rm backend npm run prisma:seed:demo
  fi
fi

cat > .aibom-mode <<EOF
MODE=$MODE
DATA=$DATA
EOF

echo "Setup complete. Run scripts/start.sh to start AI-BOM."
