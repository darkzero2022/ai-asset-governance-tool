#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE_FILE="$ROOT_DIR/.aibom-mode"

if [ ! -f "$MODE_FILE" ]; then
  echo "Setup has not been run. Run scripts/setup.sh first." >&2
  exit 1
fi

. "$MODE_FILE"
cd "$ROOT_DIR"

if [ "$MODE" = "docker" ]; then
  set -a
  . backend/.env
  set +a
  docker compose up -d
  echo "Frontend: http://localhost:5173"
  echo "Backend:  http://localhost:4000/health"
  exit 0
fi

mkdir -p logs
docker compose up -d postgres

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

start_process backend backend npm run dev
start_process frontend frontend npm run dev -- --host 127.0.0.1

for _ in $(seq 1 30); do
  if curl -fsS http://localhost:4000/health >/dev/null 2>&1; then
    echo "Frontend: http://localhost:5173"
    echo "Backend:  http://localhost:4000/health"
    exit 0
  fi
  sleep 1
done

echo "Services started, but backend health did not respond within 30 seconds. See logs/backend.log." >&2
exit 1
