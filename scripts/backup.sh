#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DATABASE="docker"
[ -f .aibom-mode ] && { . .aibom-mode; DATABASE="${DATABASE:-docker}"; }
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

mkdir -p backups
timestamp="$(date +%Y%m%d-%H%M%S)"
output="backups/aibom-$timestamp.sql"

case "$DATABASE" in
  docker)
    docker compose up -d postgres >/dev/null
    docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-aibom}" "${POSTGRES_DB:-aibom}" > "$output"
    ;;
  managed|url)
    if ! command -v pg_dump >/dev/null 2>&1; then
      echo "pg_dump not found — install the postgresql-client package (or run backups in docker mode)." >&2
      exit 1
    fi
    [ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL is not set." >&2; exit 1; }
    # libpq rejects Prisma's ?schema= parameter.
    pg_dump "${DATABASE_URL%%\?*}" > "$output"
    ;;
esac

echo "Backup written to $output"

# Prune old backups (BACKUP_RETENTION_DAYS, default 14; 0 disables).
retention="${BACKUP_RETENTION_DAYS:-14}"
if [ "$retention" -gt 0 ] 2>/dev/null; then
  find backups -name 'aibom-*.sql' -type f -mtime "+$retention" -print -delete
fi
