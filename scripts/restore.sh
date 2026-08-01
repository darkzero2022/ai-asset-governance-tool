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

echo "WARNING: restore overwrites the current AI-BOM database."
echo "Recommended: run scripts/backup.sh before continuing."

if [ "$YES" != "true" ]; then
  read -r -p "Type RESTORE to continue: " confirmation
  if [ "$confirmation" != "RESTORE" ]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

docker compose up -d postgres >/dev/null
docker compose exec -T postgres psql -U aibom -d aibom -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null
docker compose exec -T postgres psql -U aibom -d aibom < "$FILE"

echo "Database restored from $FILE"
