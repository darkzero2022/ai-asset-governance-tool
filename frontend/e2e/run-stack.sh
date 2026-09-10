#!/usr/bin/env bash
# Bring up the built app on one origin for the Playwright golden-path run:
# a fresh, admin-less database so the suite starts at the bootstrap screen.
#
# The target database must already exist (locally: `createdb -p 55433 aibom_e2e`
# once; in CI: a step before `playwright test`). This script drops its schema,
# re-migrates, seeds reference data only, builds, and serves.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

E2E_PORT="${E2E_PORT:-4600}"
E2E_DB_PORT="${E2E_DB_PORT:-55433}"
E2E_DATABASE_URL="${E2E_DATABASE_URL:-postgresql://aibom:x@127.0.0.1:${E2E_DB_PORT}/aibom_e2e?schema=public}"

export DATABASE_URL="$E2E_DATABASE_URL"
export JWT_SECRET="${JWT_SECRET:-e2e-secret-not-for-production}"
export PORT="$E2E_PORT"
export NODE_ENV=production
export SERVE_STATIC=true
export FRONTEND_DIST="$ROOT_DIR/frontend/dist"
export MANAGED_PG_PORT="$E2E_DB_PORT"
# No ADMIN_PASSWORD -> the reference seed skips the admin -> bootstrap screen.
unset ADMIN_PASSWORD || true

echo "[e2e] build"
npm --prefix packages/shared run --silent build
(cd backend && npm run --silent build)
(cd frontend && npm run --silent build)

echo "[e2e] reset schema + migrate + seed reference (no admin)"
(cd backend && npx --no-install prisma migrate reset --force --skip-seed && npm run --silent prisma:seed:reference)

echo "[e2e] serve on :$E2E_PORT"
exec node backend/dist/server.js
