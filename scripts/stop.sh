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
  if [ -f backend/.env ]; then
    set -a
    . backend/.env
    set +a
  fi
  docker compose down
  exit 0
fi

for name in backend frontend; do
  pid_file="logs/$name.pid"
  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid"
      echo "Stopped $name (PID $pid)"
    fi
    rm -f "$pid_file"
  fi
done

docker compose stop postgres
