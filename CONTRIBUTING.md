# Contributing

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Open an issue before starting anything large — check [ROADMAP.md](ROADMAP.md) first.

## Development setup

```bash
scripts/setup.sh --mode=local --data=demo --yes           # Linux / macOS / Git Bash
# or:  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Mode local -Data demo -Yes
scripts/start.sh
```

- Backend: `cd backend && npm run dev` (Express + Prisma, port 4000)
- Frontend: `cd frontend && npm run dev` (Vite, port 5173)
- Database: bundled PostgreSQL (`cd backend && npm run db:start`) or `docker compose up -d postgres`
- Shared types: `cd packages/shared && npm run build` after changing `packages/shared/src/*`

## Before opening a PR

Run what CI runs:

```bash
npm ci && npm run lint && npm run format:check   # repo root — ESLint + Prettier
cd packages/shared && npm run build
cd backend  && npm run test && npm run build && npm run validate:cyclonedx
cd frontend && npm run test && npm run build
npx tsc --noEmit   # in backend/ and frontend/
```

`npm run format` (root) reformats; `npm run lint:fix` auto-fixes what ESLint can.
The PR template has the full checklist.

## Sign your commits (DCO)

This project uses the [Developer Certificate of Origin](https://developercertificate.org).
Every commit in a PR must carry a `Signed-off-by:` trailer matching the commit
author — add it with the `-s` / `--signoff` flag:

```bash
git commit -s -m "fix: ..."
git rebase --signoff origin/master   # to sign off a branch after the fact
```

The **DCO** check enforces this on every PR (merge commits are exempt).

## Conventions

- **Backend**: validate every request body with `zod` (put schemas the frontend
  reuses in `packages/shared`); every mutating route gets an explicit role check
  (`requireRole(...)`), not just `requireAuth`; every mutation to a core entity
  writes an `AuditLog` row (the Prisma audit extension is a safety net, not a
  substitute for a domain `audit()` call where there's a meaningful event).
- **Migrations**: additive where possible. Schema changes that alter or drop
  columns on non-empty tables ship as expand → backfill → contract, with the
  backfill script checked in. Pure reference-data tables may be dropped/recreated
  (they are re-seeded by `prisma:seed:reference`).
- **Frontend**: no **new** runtime dependency without discussion in the issue.
  The app deliberately uses Radix UI, `cmdk`, `lucide-react`, `class-variance-authority`,
  `clsx`/`tailwind-merge`, and `@tanstack/react-query` — additions beyond that
  bar need a reason. **Charts stay hand-rolled SVG** (`components/BarChart`,
  `DonutChart`, `RiskHeatmap`) — do not add a charting library.
- **Tests**: new logic ships with a test. Backend integration tests share one
  PostgreSQL database and run sequentially (`fileParallelism: false`).
- **API**: everything lives under `/api/v1` except `/health`. The OpenAPI doc at
  `/api/docs` is generated from the mounted routers — keep route paths and role
  middleware introspectable.

## Framework & mapping data

All framework reference data is seeded from `backend/prisma/seed-reference.ts`:

| Table                                                 | What it holds                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `FrameworkMeta`                                       | one row per framework: title, exact revision, DRAFT/RELEASED status, source URL, licence note                       |
| `FrameworkCategory`                                   | the categories of each framework (NIST functions, EU tiers, LLM01–LLM10, MCP01–MCP10)                               |
| `FrameworkThreatMapping`                              | category → STRIDE-AI category + ATLAS technique(s) + suggested ATLAS mitigation(s) — drives the risk-form auto-fill |
| `FrameworkCrosswalk`                                  | a relationship between a category in one framework and one in another, with a `rationale`                           |
| `AtlasTechniqueReference`, `AtlasMitigationReference` | the MITRE ATLAS catalogues                                                                                          |

- The cross-framework mappings and the category→STRIDE-AI/ATLAS mappings are
  **this project's analysis**, not official OWASP/NIST/MITRE crosswalks. Every
  `FrameworkCrosswalk` row carries a `rationale`.
- To propose a change, use the **Framework mapping** issue template — include the
  current value, the proposed value, and a source.
- Bumping a framework revision is additive: keep the old `FrameworkCategory` rows,
  add new ones, and update the `FrameworkMeta.revision` string so historical
  assessments and exports stay reproducible.
- Keep [ATTRIBUTION.md](ATTRIBUTION.md) and [NOTICE](NOTICE) accurate. **OWASP MCP
  Top 10 is CC BY-NC-SA (non-commercial)** — do not paste large verbatim blocks
  of its text.

## Reporting security issues

See [SECURITY.md](SECURITY.md) — do not file security bugs as public issues.
