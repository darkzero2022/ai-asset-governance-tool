#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .aibom-mode ]; then
  echo "Not set up yet — run scripts/setup.sh." >&2
  exit 1
fi
# shellcheck disable=SC1091
. .aibom-mode
DATABASE="${DATABASE:-docker}"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has uncommitted or untracked changes — commit or stash them first." >&2
  exit 1
fi

echo "Backing up the database first (scripts/backup.sh)…"
bash scripts/backup.sh || echo "  (backup skipped/failed — continuing)"

echo "Pulling latest…"
git pull --ff-only

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ "$MODE" = "docker" ]; then
  docker compose build backend
  docker compose run --rm backend npx prisma migrate deploy
  docker compose up -d
else
  (cd packages/shared && npm install && npm run build)
  (cd backend && npm install && npm run prisma:generate && npm run build)
  (cd frontend && npm install && npm run build)
  case "$DATABASE" in
    managed) (cd backend && npm run --silent db:start) ;;
    docker) docker compose up -d postgres ;;
    url) : ;;
  esac
  (cd backend && npx prisma migrate deploy)
  bash scripts/stop.sh || true
  bash scripts/start.sh
fi

echo "Upgrade complete. Run scripts/status.sh to verify."
