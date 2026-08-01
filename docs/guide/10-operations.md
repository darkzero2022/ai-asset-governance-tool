# 10 - Operations

This page summarizes operational commands and maintenance tasks. For deployment architecture and secrets guidance, also read `docs/deployment.md`.

## Setup

Run `scripts/setup.sh` for interactive setup or pass `--mode=local|docker`, `--data=empty|demo`, and `--yes` for repeatable setup. Local mode keeps Node processes on the host and Postgres in Docker. Docker mode runs the full app stack in Compose.

## Start And Stop

Run `scripts/start.sh` to start the chosen mode recorded in `.aibom-mode`. Local mode starts Postgres, backend, and frontend with logs under `logs/`. Docker mode runs `docker compose up -d`.

Run `scripts/stop.sh` to stop tracked local PIDs and Postgres, or to run `docker compose down` in Docker mode.

## Backup

Run:

```bash
scripts/backup.sh
```

The script writes `backups/aibom-<timestamp>.sql` using `pg_dump` through the Docker-managed Postgres container. Backups are ignored by git.

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
