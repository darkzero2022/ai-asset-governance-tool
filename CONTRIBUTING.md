# Contributing

## Development setup

```bash
scripts/setup.sh --mode=local --data=demo --yes
scripts/start.sh
```

- Backend: `cd backend && npm run dev` (Express + Prisma, port 4000)
- Frontend: `cd frontend && npm run dev` (Vite, port 5173)
- Database: PostgreSQL via `docker compose up -d postgres`

## Before opening a PR

Run the checks CI runs:

```bash
cd backend  && npm run test && npm run build && npm run validate:cyclonedx
cd frontend && npm run test && npm run build
```

## Conventions

- **Backend**: validate every request body with `zod`; every mutating route gets an
  explicit role check (`requireRole(...)`), not just `requireAuth`; every mutation to
  a core entity writes an `AuditLog` row.
- **Migrations**: schema changes that alter or drop columns on non-empty tables ship
  as expand → backfill → contract, with the backfill script checked in.
- **Frontend**: no new heavy UI/charting dependencies — the SVG charts are hand-rolled
  on purpose to keep the dependency surface small.
- **Tests**: new logic ships with a test.

## Reporting security issues

See [SECURITY.md](SECURITY.md) — do not file security bugs as public issues.
