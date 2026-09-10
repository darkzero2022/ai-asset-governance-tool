#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE_FILE="$ROOT_DIR/.aibom-mode"

if [ ! -f "$MODE_FILE" ]; then
  echo "Setup has not been run. Run scripts/setup.sh first." >&2
  exit 1
fi

. "$MODE_FILE"
DATABASE="${DATABASE:-docker}"
cd "$ROOT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
APP_PORT="${PORT:-4000}"
DB_PORT="${DB_PORT:-55432}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

if [ "$MODE" = "docker" ]; then
  docker compose up -d
  echo "App:    http://localhost:${APP_PORT}"
  echo "Health: http://localhost:${APP_PORT}/health"
  exit 0
fi

mkdir -p logs
case "$DATABASE" in
  managed) (cd backend && MANAGED_PG_PORT="$DB_PORT" npm run --silent db:start) ;;
  docker) docker compose up -d postgres ;;
  url) : ;;
esac

start_process() {
  local name="$1"
  local dir="$2"
  shift 2
  local pid_file="logs/$name.pid"
  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
    echo "$name is already running with PID $(cat "$pid_file")"
    return
  fi
  (cd "$dir" && "$@" > "$ROOT_DIR/logs/$name.log" 2>&1 & echo $! > "$ROOT_DIR/$pid_file")
}

export VITE_DEV_API_TARGET="http://localhost:${APP_PORT}"
start_process backend backend npm run dev
start_process frontend frontend npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT"

for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${APP_PORT}/health" >/dev/null 2>&1; then
    echo "Frontend: http://localhost:${FRONTEND_PORT}"
    echo "Backend:  http://localhost:${APP_PORT}/health"
    exit 0
  fi
  sleep 1
done

echo "Services started, but backend health did not respond within 30 seconds. See logs/backend.log." >&2
exit 1
