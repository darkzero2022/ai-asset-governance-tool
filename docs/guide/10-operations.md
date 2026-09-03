# 10 - Operations

This page summarizes operational commands and maintenance tasks. For deployment architecture and secrets guidance, also read `docs/deployment.md`.

## Setup

Run `scripts/setup.sh` interactively, or pass `--mode=local|docker`,
`--database=managed|docker|url`, `--data=empty|demo`, and `--yes`. All
configuration lands in a single root `.env` (generated, gitignored). `--database=managed`
runs a bundled PostgreSQL with no Docker; `--database=docker` uses the compose
service; `--database=url` uses an existing server via `DATABASE_URL`. Setup runs
preflight checks (ports, Node version) and refuses to change anything if they fail.

## Start, Stop, Status

- `scripts/start.sh` / `scripts/stop.sh` — start/stop everything for the mode
  recorded in `.aibom-mode`. Docker mode is `docker compose up -d` / `down`;
  local mode manages backend/frontend PIDs (logs under `logs/`) plus the database
  (`npm run db:start`/`db:stop` for managed, the postgres container for docker).
- `scripts/status.sh` — mode, versions, what's running, `prisma migrate status`,
  `/health`.
- `scripts/upgrade.sh` — `git pull` → reinstall → migrate → rebuild → restart.
  Refuses a dirty/untracked tree; backs up first.
- `scripts/reset.sh [--yes]` — drop all tables and re-seed the recorded data mode.

## Backup

Run:

```bash
scripts/backup.sh
```

The script writes `backups/aibom-<timestamp>.sql` using `pg_dump` against the
configured database. Backups are ignored by git. Take one before `scripts/upgrade.sh`
or `scripts/reset.sh` (upgrade does this automatically).

## Restore

Run:

```bash
scripts/restore.sh backups/aibom-YYYYMMDD-HHMMSS.sql
```

Restore is destructive. It warns, recommends a fresh backup, requires typing `RESTORE`, drops and recreates the public schema, and replays the SQL file. Use `--yes` only in controlled automation.

## Recertification Notifications

Run `npm run notify:recertifications` in `backend/` to scan for overdue/due-soon recertification items and stale assets. Configure Slack webhook environment variables before relying on notifications in operations.

## Routine Checks

Use `npm run build` and `npm run test` in both backend and frontend after changes. Use `npx prisma validate` after schema edits and `prisma migrate deploy` for deployed environments.
