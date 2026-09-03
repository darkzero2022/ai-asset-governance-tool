#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

YES="false"
for arg in "$@"; do
  case "$arg" in
    --yes) YES="true" ;;
    -h|--help) echo "Usage: scripts/reset.sh [--yes]   Drop all data and re-seed."; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [ ! -f .aibom-mode ]; then
  echo "Not set up yet — run scripts/setup.sh." >&2
  exit 1
fi
# shellcheck disable=SC1091
. .aibom-mode
DATABASE="${DATABASE:-docker}"
DATA="${DATA:-empty}"

if [ "$YES" != "true" ]; then
  echo "This DROPS every table and re-seeds ${DATA} data. Take a backup first: scripts/backup.sh"
  read -r -p "Type 'reset' to continue: " answer
  [ "$answer" = "reset" ] || { echo "Aborted."; exit 1; }
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
export ADMIN_EMAIL="${ADMIN_EMAIL:-}"

reseed_local() {
  (cd backend && npx prisma migrate reset --force --skip-seed --skip-generate)
  (cd backend && npm run prisma:seed:reference)
  [ "$DATA" = "demo" ] && (cd backend && npm run prisma:seed:demo) || true
}

if [ "$MODE" = "docker" ]; then
  docker compose up -d postgres
  docker compose run --rm backend npx prisma migrate reset --force --skip-seed --skip-generate
  docker compose run --rm -e ADMIN_EMAIL backend npm run prisma:seed:reference
  [ "$DATA" = "demo" ] && docker compose run --rm -e ADMIN_EMAIL backend npm run prisma:seed:demo || true
else
  case "$DATABASE" in
    managed) (cd backend && npm run --silent db:start) ;;
    docker) docker compose up -d postgres ;;
    url) : ;;
  esac
  reseed_local
fi

echo "Database reset and re-seeded (${DATA})."
