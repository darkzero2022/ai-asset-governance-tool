#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .aibom-mode ]; then
  echo "Not set up yet — run scripts/setup.sh."
  exit 1
fi
# shellcheck disable=SC1091
. .aibom-mode
DATABASE="${DATABASE:-docker}"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
APP_PORT="${PORT:-4000}"

echo "AI-BOM status"
echo "  mode:     $MODE"
echo "  database: $DATABASE"
echo "  data:     ${DATA:-unknown}"
echo

echo "Versions"
command -v node >/dev/null 2>&1 && echo "  node: $(node -v)"
command -v npm  >/dev/null 2>&1 && echo "  npm:  $(npm -v)"
command -v docker >/dev/null 2>&1 && echo "  docker compose: $(docker compose version --short 2>/dev/null || echo n/a)"
echo

echo "Processes"
if [ "$MODE" = "docker" ]; then
  docker compose ps 2>/dev/null || echo "  (docker compose not responding)"
else
  for name in backend frontend; do
    pid_file="logs/$name.pid"
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
      echo "  $name: running (pid $(cat "$pid_file"))"
    else
      echo "  $name: stopped"
    fi
  done
  case "$DATABASE" in
    managed) (cd backend && npm run --silent db:status) || true ;;
    docker) docker compose ps postgres 2>/dev/null || true ;;
    url) echo "  database: external (DATABASE_URL)" ;;
  esac
fi
echo

echo "Migrations"
if [ "$MODE" = "docker" ]; then
  docker compose run --rm -T backend npx prisma migrate status 2>&1 | sed 's/^/  /' || true
else
  (cd backend && npx prisma migrate status 2>&1 | sed 's/^/  /') || true
fi
echo

echo "Endpoints"
if curl -fsS "http://localhost:${APP_PORT}/health" >/dev/null 2>&1; then
  echo "  http://localhost:${APP_PORT}/health — ok"
else
  echo "  http://localhost:${APP_PORT}/health — unreachable"
fi
