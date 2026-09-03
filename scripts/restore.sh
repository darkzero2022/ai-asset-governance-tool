#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
YES="false"
FILE=""

for arg in "$@"; do
  case "$arg" in
    --yes) YES="true" ;;
    *) FILE="$arg" ;;
  esac
done

if [ -z "$FILE" ]; then
  echo "Usage: scripts/restore.sh [--yes] <backup-file>" >&2
  exit 1
fi
if [ ! -f "$FILE" ]; then
  echo "Backup file not found: $FILE" >&2
  exit 1
fi

cd "$ROOT_DIR"

DATABASE="docker"
[ -f .aibom-mode ] && { . .aibom-mode; DATABASE="${DATABASE:-docker}"; }
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

echo "WARNING: restore overwrites the current AI-BOM database."
echo "Recommended: run scripts/backup.sh before continuing."
if [ "$YES" != "true" ]; then
  read -r -p "Type RESTORE to continue: " confirmation
  [ "$confirmation" = "RESTORE" ] || { echo "Restore cancelled."; exit 1; }
fi

reset_sql="DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

case "$DATABASE" in
  docker)
    U="${POSTGRES_USER:-aibom}"; D="${POSTGRES_DB:-aibom}"
    docker compose up -d postgres >/dev/null
    docker compose exec -T postgres psql -U "$U" -d "$D" -c "$reset_sql" >/dev/null
    docker compose exec -T postgres psql -U "$U" -d "$D" < "$FILE"
    ;;
  managed|url)
    command -v psql >/dev/null 2>&1 || { echo "psql not found — install the postgresql-client package." >&2; exit 1; }
    [ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL is not set." >&2; exit 1; }
    url="${DATABASE_URL%%\?*}"   # libpq rejects Prisma's ?schema= parameter
    psql "$url" -c "$reset_sql" >/dev/null
    psql "$url" < "$FILE"
    ;;
esac

echo "Database restored from $FILE"
