#!/usr/bin/env bash
# Production run for local (non-Docker) mode: one process that (optionally starts
# the bundled database and) serves the built API + SPA on $PORT. Used by
# scripts/install-service.sh (pm2 / systemd) and runnable directly.
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

case "$DATABASE" in
  managed) (cd backend && npm run --silent db:start) ;;
  docker) docker compose up -d postgres >/dev/null ;;
  url) : ;;
esac

(cd backend && npx --no-install prisma migrate deploy)

export NODE_ENV=production
export SERVE_STATIC="${SERVE_STATIC:-true}"
export FRONTEND_DIST="${FRONTEND_DIST:-$ROOT_DIR/frontend/dist}"
exec node backend/dist/server.js
