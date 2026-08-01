#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p backups
timestamp="$(date +%Y%m%d-%H%M%S)"
output="backups/aibom-$timestamp.sql"

docker compose up -d postgres >/dev/null
docker compose exec -T postgres pg_dump -U aibom aibom > "$output"

echo "Backup written to $output"
