# Codex Backlog

Ordered task list for the Code Executor. Pull tasks top-to-bottom within a section; don't skip ahead to a later phase without the user's explicit go-ahead. Background/rationale for each item is in `docs/roadmap.md`. Log every completed item in `CHANGES.log` per the format in `AGENTS.md`.

Everything through the Model Card metric CRUD fix, the maturity-gaps round (version control, user management, ownership RBAC, segregation of duties, real OIDC, notifications, CSV export, deployment docs, control dedup, EU AI Act tier suggestion, field history), and the URL import feature (with SSRF mitigations) are complete and verified — both by reading the code and by actually running the test suites (27 backend, 6 frontend, all passing). One live-verified gap survived that round: CSV export has no formula-injection protection. **Work through the sections below in order: "Fix CSV formula-injection protection," then "Operational tooling: setup, start/stop, backup/restore, docs, repo upload."**

## Operational tooling: setup, start/stop, backup/restore, docs, repo upload (do this after the CSV fix)

- [x] Split `backend/prisma/seed.ts` into `backend/prisma/seed-reference.ts` (framework categories, EU AI Act tier reference, default admin user — always required) and `backend/prisma/seed-demo.ts` (the fictional assets/projects/risks/controls/Model Card/recertifications — optional); add `prisma:seed:reference` and `prisma:seed:demo` npm scripts to `backend/package.json`; keep `prisma:seed` running both in sequence.
- [x] Add `backend/Dockerfile` and `frontend/Dockerfile`, and extend `docker-compose.yml` (or add `docker-compose.full.yml`) with `backend`/`frontend` services alongside the existing `postgres` service, for the Docker install mode.
- [ ] Add `scripts/setup.sh` — interactive (with `--mode=local|docker`, `--data=empty|demo`, `--yes` flags for non-interactive use): checks Node/npm/Docker prerequisites; generates `backend/.env` from `.env.example` with a strong random `JWT_SECRET` (`openssl rand -hex 32`) if missing; installs dependencies or builds Docker images per the chosen mode; runs `prisma migrate deploy`; runs the chosen seed variant; writes a `.aibom-mode` marker file. Must be idempotent (safe to re-run).
- [ ] Add `scripts/start.sh` — reads `.aibom-mode` (errors with a clear message if `setup.sh` hasn't been run); local mode starts the Postgres container plus backend/frontend as background processes with PID files and logs under `logs/`, then prints both URLs once the backend health check responds; docker mode runs `docker compose up -d`.
- [ ] Add `scripts/stop.sh` — the complement to `start.sh`: local mode kills the tracked PIDs and stops the Postgres container; docker mode runs `docker compose down`.
- [ ] Add `scripts/backup.sh` — `pg_dump` via `docker compose exec -T postgres`, output to a timestamped file under `backups/`.
- [ ] Add `scripts/restore.sh <file>` — requires explicit confirmation (`--yes` flag or interactive prompt) before overwriting the current database, warns and recommends a fresh backup first, then restores via `psql`/`pg_restore` against the same container.
- [ ] Add `backups/`, `logs/`, and `.aibom-mode` to `.gitignore`.
- [ ] Add the `docs/guide/` documentation set per `docs/roadmap.md`'s "Documentation set + repository upload" section — one substantive file per feature area (`README.md` index, `01-getting-started.md` through `10-operations.md`), not a single unwieldy file.
- [ ] Create a new **private** GitHub repository (Codex has GitHub access per the user) and push the full local commit history plus every commit from this round to it. Do not make it public.

## Fix CSV formula-injection protection (do this first — live-verified gap)

## Fix Model Card metric CRUD (do this first — live-verified gap, CHANGES.log claim doesn't match reality)

- [x] Add `POST /assets/:id/model-card/metrics` to `backend/src/app.ts` — create a `ModelCardMetric` row, `requireRole("ADMIN", "RISK_OWNER")`, audited via the existing `audit()` helper. This route is currently missing entirely; the frontend already calls it and gets a 404.
- [x] Add `PUT /assets/:id/model-card/metrics/:metricId` to `backend/src/app.ts` — update a `ModelCardMetric` row, same role gate and audit pattern.
- [x] Add `DELETE /assets/:id/model-card/metrics/:metricId` to `backend/src/app.ts` — delete a `ModelCardMetric` row, same role gate and audit pattern.
- [x] Add `metrics: true` to the `include` on the `prisma.modelCard.findUnique` call in the `GET /assets/:id/model-card` handler (~line 314) — today it omits the relation entirely, so even seeded/existing metrics never show up on the asset detail page's Model Card form, only through the separate `/reports/model-metrics` endpoint.
- [x] Add an integration test in `backend/src/integration.test.ts` exercising create/update/delete on a metric (the existing RBAC matrix tests stop at `PUT /assets/:id/model-card` and never touch the metrics sub-routes — that's why this shipped broken with all tests green).

## Fix CSV formula-injection protection (do this first — live-verified gap)

- [x] In `csvValue()` in `backend/src/app.ts` (~line 321), prefix values starting with `=`, `+`, `-`, `@`, tab, or carriage return with a leading `'` before the existing quote-escaping, so free-text fields can't become live formulas when the exported CSV is opened in Excel/LibreOffice. Add a test asserting a risk description starting with `=` exports with the neutralizing prefix.

## Maturity gaps (do this second, in order — full rationale in `docs/roadmap.md`'s "Maturity gaps identified in supervisor review" section)

- [x] **Version control**: `git init` this repository, make an initial commit capturing the current state as a baseline, then commit alongside every future `CHANGES.log` entry (per the updated `AGENTS.md`).
- [x] **User management**: add `active Boolean @default(true)` to `User` in `backend/prisma/schema.prisma`; add `GET/POST /users` (`ADMIN`-only) and `PUT /users/:id` (role change, deactivate, admin-set password reset) to `backend/src/app.ts`; reject deactivated users in `requireAuth`; add `frontend/src/pages/Users.tsx` (admin-only: list, create, role change, deactivate, reset password) and a nav entry visible only to `ADMIN`.
- [x] **RBAC ownership scoping**: add `Risk.createdById` (`User` FK) to `backend/prisma/schema.prisma` (expand migration, backfill existing rows to the seed admin user); enforce in `PUT /risks/:id` and `PUT /assets/:id` that `RISK_OWNER` may only edit rows where `req.user.id === row.createdById` (`ADMIN` bypasses); extend the RBAC integration tests to cover both the "own" and "not own" cases for `RISK_OWNER`.
- [x] **Segregation of duties**: in `POST /assets/:id/transition`, block a user from approving (`APPROVED`) an asset they themselves transitioned to `UNDER_REVIEW` (check `GovernanceWorkflow.approvedById` for that step); in `PUT /risks/:id`, block a user from transitioning a risk to `ACCEPTED` if `req.user.id === risk.createdById`. Both return a clear 403 matching the existing policy-gate error shape.
- [x] **Real OIDC/SSO**: replace the `501`-stub `GET /auth/oidc/login`/`/auth/oidc/callback` in `backend/src/app.ts` with a real generic OIDC authorization-code flow using a standard library (e.g. `openid-client`), functional once pointed at a real IdP via env config.
- [x] **Recertification/stale-asset notifications**: add `backend/src/jobs/notifyRecertifications.ts`, runnable via `npm run`, reusing the existing Slack webhook sender pattern to alert on overdue/due-soon `RecertificationSchedule` rows and assets stuck in `DRAFT`/`UNDER_REVIEW` past a threshold.
- [x] **CSV export**: add `GET /risks/export/csv` and `GET /assets/export/csv` to `backend/src/app.ts`, respecting the same filters as the existing list endpoints.
- [x] **Deployment documentation**: add `docs/deployment.md` covering containerizing both services, a real Postgres target, secrets-manager guidance instead of `.env` files, and the `prisma migrate deploy` process. Documentation only — no infrastructure changes.
- [x] **Control catalog dedup**: add a search-as-you-type suggestion (case-insensitive `contains` match against `Control.name`/`mappedControlId`) to the control-link picker in `frontend/src/pages/RiskDetail.tsx`.
- [x] **EU AI Act tier suggestion**: add a non-binding pre-fill suggestion for `euAiActRiskTier` on the risk create/edit form based on asset `dataClassificationTouched` keywords or the linked risk's `sourceCategoryId` — user must still confirm/override, never auto-set silently.
- [x] **Asset field history**: add a "Field History" panel to `frontend/src/pages/AssetDetail.tsx` reading the existing `GET /audit-logs?entityType=AIAsset&entityId=` endpoint, rendering before/after diffs over time. No schema change needed — `AuditLog` already captures this.

## Import asset and Model Card data from a URL (do this third — full design, including required SSRF mitigations, in `docs/roadmap.md`)

- [x] Add `sourceUrl String?` to `AIAsset` in `backend/prisma/schema.prisma` (expand migration, no backfill needed).
- [x] Add `POST /assets/import-url` and `POST /assets/:id/import-url` to `backend/src/app.ts`, `requireRole("ADMIN", "RISK_OWNER")`. **Must implement SSRF mitigations before fetching anything**: allow only `http`/`https`; resolve the hostname and reject loopback/private/link-local IP ranges (including the `169.254.169.254` cloud metadata endpoint); enforce a short timeout (~5s) and a response size cap (~2MB); do not follow redirects to a blocked destination. Strip HTML to extract `<title>`, the meta description, and a truncated plain-text excerpt of visible body content. Return `{ sourceUrl, suggestedTitle, suggestedDescription, excerpt }` as a suggestion payload — do not write these into governance fields directly.
- [x] Add an "Import from URL" input + "Fetch" button to the asset create form in `frontend/src/pages/AssetList.tsx` and to `frontend/src/components/ModelCardForm.tsx`, showing the fetched suggestion in a preview the user copies from into real fields before saving. Always store `sourceUrl` on save regardless of whether extraction succeeded.
- [x] Show `sourceUrl` (when present) on `frontend/src/pages/AssetDetail.tsx` as a clickable citation link.
- [x] Add `sourceUrl` as an external reference in the CycloneDX export (`backend/src/cyclonedx.ts`) when present.
- [x] Add a test asserting the import endpoint rejects a private/loopback/link-local URL (e.g. `http://127.0.0.1/...` or `http://169.254.169.254/...`) with an error rather than fetching it.

## Demo data seeding (do this first)

- [x] Extend `backend/prisma/seed.ts` with several more `AIAsset` rows spanning every `type`/`hostingModel`/`networkDependency`/`status` combination worth exercising in the UI (via `upsert`, matching the existing idempotent pattern).
- [x] Add a few `Project` rows in `backend/prisma/seed.ts`, each linked to more than one asset via `ProjectAsset`, so reuse-count panels show non-zero/shared data.
- [x] Add more `Risk` rows in `backend/prisma/seed.ts` spanning all four `severityOf()` bands (LOW/MEDIUM/HIGH/CRITICAL) and multiple statuses (including MITIGATED/ACCEPTED), with at least one risk linked to multiple assets and one linked directly to a Project.
- [x] Add a few catalog `Control` rows linked via `RiskControl` with varied `implementationStatus` in `backend/prisma/seed.ts`.
- [x] Add one fully-complete `ModelCard` (all required fields filled) on a MODEL asset and leave at least one MODEL/SERVICE asset without one, in `backend/prisma/seed.ts`.
- [x] Add one `RecertificationSchedule` row overdue and one due-soon in `backend/prisma/seed.ts`.

## Test coverage pass (do this second)

- [x] Add unit tests for `severityOf()`/`HIGH_SEVERITY_MIN_SCORE` in `backend/src/riskScoring.ts`.
- [x] Add unit tests for `modelCardCompleteness()` in `backend/src/modelCardScoring.ts`.
- [x] Add unit tests for `canTransitionAsset()` in `backend/src/rbac.ts`.
- [x] Add RBAC permission-matrix integration tests covering every mutating route (`POST/PUT /assets`, `POST/PUT /risks`, deletes, transitions, control/project/model-card routes) against `ADMIN`/`RISK_OWNER`/`APPROVER`/`VIEWER` tokens, per the matrix in `docs/roadmap.md`.
- [x] Add policy-gate tests: transition blocked by an open HIGH/CRITICAL risk, transition blocked by an incomplete Model Card on MODEL/SERVICE assets, both unblocked once resolved.
- [x] Add archive-not-delete tests: deleting a linked `Risk`/`Control` archives instead of hard-deleting; deleting an unlinked one hard-deletes.
- [x] Add CycloneDX/SPDX export fixture tests: a known fixture asset's BOM validates against the vendored schema via `validateCycloneDxBom`; the SPDX document includes `DESCRIBES` `relationships` entries.
- [x] Add frontend component tests for `SeverityBadge`, `ApprovalBanner` (blocking logic), `BarChart` (per-datum `color` override), and `RiskHeatmap` (cell coloring/click-filter callback).

## Model Card metric-level analytics (do this third)

- [x] Add a `ModelCardMetric` model (`modelCardId`, `metricName`, `metricValue`, `slice`, `recordedAt`) to `backend/prisma/schema.prisma` per `docs/roadmap.md`'s "Model Card metric-level analytics" section (additive migration; `ModelCard.performanceMetrics` stays as-is).
- [x] Add metric CRUD to `backend/src/app.ts` (nested under or alongside `PUT /assets/:id/model-card`), audited like other mutations.
- [x] Add `GET /reports/model-metrics?metricName=` to `backend/src/app.ts` returning every model's value for that metric plus an aggregate grouped by `task`/`architectureFamily`.
- [x] Update `mapComponent` in `backend/src/cyclonedx.ts` to build `modelCard.quantitativeAnalysis.performanceMetrics` from `ModelCardMetric` rows instead of the raw JSON blob.
- [x] Extend `frontend/src/components/ModelCardForm.tsx` with a structured metric-row editor (name/value/slice, add/remove) alongside the existing JSON field.
- [x] Add a "Model Performance Metrics" panel to `frontend/src/pages/Dashboard.tsx` — metric-name picker plus a `BarChart` comparing that metric across every model reporting it.

## UI polish pass (complete)

- [x] Change the `GET /assets/:id/model-card` handler in `backend/src/app.ts` (~line 304-318) to always return a top-level `completeness` field via `modelCardCompleteness(modelCard)`, independent of whether `modelCard` itself is `null` — e.g. `res.json({ modelCard: modelCardResponse(modelCard), completeness: modelCardCompleteness(modelCard) })`. Today `modelCardResponse()` returns `null` (discarding completeness) whenever no `ModelCard` row exists, which is every asset until someone fills one in.
- [x] Update `frontend/src/pages/AssetDetail.tsx` to pass the new top-level `completeness` from that response into `ApprovalBanner` and `ModelCardForm` instead of `modelCard?.completeness`.
- [x] Remove the `["modelCard"]` placeholder fallback in `frontend/src/components/ApprovalBanner.tsx:7` — it should never be needed once the backend always supplies real `completeness` data. Verified live this placeholder currently renders as the literal, unhelpful text "Model Card incomplete: modelCard" instead of real field names.
- [x] Rework the "Framework Coverage Gaps" panel in `frontend/src/pages/Dashboard.tsx:142` to chart **all** framework categories with `value: item.riskCount` (real bar height) instead of filtering to zero-risk categories and hardcoding every bar to `value: 1`. Add an optional per-datum `color` to `frontend/src/components/BarChart.tsx` (default to the existing cyan) so zero-count categories can be tinted distinctly (e.g. amber/red) while still showing real relative depth for the rest.
- [x] Move the `import type { ReactNode } from "react";` in `frontend/src/pages/RiskDetail.tsx:193` from the end of the file to the top with the other imports.
- [x] Restyle `frontend/src/pages/RiskRegister.tsx`'s risk-list/heatmap container from the dark hero treatment (`rounded-2xl bg-slate-950 p-5 text-white shadow-sm`, with `text-slate-400`/`text-cyan-300` internals) to the same light card style already used in `frontend/src/pages/AssetList.tsx`/`ProjectList.tsx` (`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200`, `text-slate-500`/`text-cyan-700` internals).
- [x] Restyle `frontend/src/pages/Dashboard.tsx`'s top hero div from `bg-slate-950 text-white` to the same light card style, updating the search input's dark-theme classes (`bg-slate-900`, `border-slate-700`) to light equivalents. Agreed direction: light theme across all four main pages (Dashboard, Assets, Risk Register, Projects), not a dark hero on all of them.

## Stabilization pass (do this first, in order)

- [x] Add `requireRole("ADMIN", "RISK_OWNER")` to `POST /assets`, `PUT /assets/:id`, `POST /risks`, and `PUT /risks/:id` in `backend/src/app.ts` — these currently only check `requireAuth`, letting any authenticated user (including default-role `VIEWER`) create/edit any asset or risk.
- [x] ~~Wire `ProjectTable.tsx`/`ProjectDetail.tsx` into `App.tsx`~~ — **superseded, do not do this as originally worded.** Project UI is now built directly into the new page structure in the "Frontend IA overhaul" section below (`ProjectList.tsx`/`ProjectDetail.tsx` under `frontend/src/pages/`) instead of being wired into the single-page layout that's about to be split apart.
- [x] Add an `archived Boolean @default(false)` field to `Risk` and `Control` in `backend/prisma/schema.prisma` (expand migration, default `false`, no backfill needed). Change `DELETE /risks/:id` and `DELETE /controls/:id` in `backend/src/app.ts` to set `archived: true` instead of hard-deleting when the row has any links (`AssetRisk`/`ProjectRisk`/`RiskControl` rows exist); only allow a true `prisma.risk.delete`/`prisma.control.delete` when there are zero links, still `ADMIN`-only. Exclude archived rows from default list/dashboard queries (`GET /risks`, `GET /controls`, dashboard/report endpoints) unless an explicit `includeArchived=true` query param is passed.
- [x] Replace the unbounded `prisma.risk.findMany` calls in `GET /dashboard/summary` and `GET /reports/risk-summary` (`backend/src/app.ts`) with `prisma.risk.groupBy`/`count` at the DB level.
- [x] Add a `relationships` array to the SPDX document built in `backend/src/spdx.ts` (`buildSpdxDocument`), with a `DESCRIBES` relationship from `SPDXRef-DOCUMENT` to each package.
- [x] Export a `HIGH_SEVERITY_MIN_SCORE` constant from `backend/src/riskScoring.ts` and use it in both the transition policy gate and `GET /dashboard/exposure` in `backend/src/app.ts`, replacing the two hardcoded `gte: 12` literals.
- [x] Move `backend/prisma/scripts/backfill-asset-risk.ts` and `backfill-risk-control.ts` to `backend/prisma/scripts/archive/`, adding a one-line comment that they're historical records of a completed migration and won't compile against the current schema.
- [x] Add `GET /projects/:id/export/cyclonedx` to `backend/src/app.ts`, producing one BOM listing every asset linked to that project as a component/service (reuse `buildCycloneDxBom` from `backend/src/cyclonedx.ts`).
- [x] Add a `networkDependency` `Select` (`AIR_GAPPED`/`HYBRID`/`FULLY_CONNECTED`) to the asset create/edit form in `frontend/src/App.tsx`, alongside the existing Hosting Model select — verified live that the field is filterable/displayed everywhere but has no way to actually be set from the UI.

## Frontend IA overhaul (do after stabilization pass)

- [x] Add `severity` to risk objects in `riskResponse()` in `backend/src/app.ts`, computed via `severityOf()` from `backend/src/riskScoring.ts`, so the frontend has one source of truth for severity instead of recomputing the threshold.
- [x] Add `GET /dashboard/recertification` (or extend `GET /dashboard/summary`) in `backend/src/app.ts` returning `MODEL`/`SERVICE` assets whose `RecertificationSchedule.nextDueDate` is overdue or due within N days.
- [x] Add `frontend/src/router.tsx` exporting a `useRoute()` hook matching `window.location.pathname` against a route table (`/dashboard`, `/assets`, `/assets/:id`, `/risks`, `/risks/:id`, `/projects`, `/projects/:id`) — do **not** reintroduce `react-router-dom` (removed for npm audit reasons per `CHANGES.log`); extend the existing `pushState`-based navigation instead.
- [x] Add top navigation for Dashboard | Assets | Risk Register | Projects to `frontend/src/App.tsx`.
- [x] Add `frontend/src/pages/AssetList.tsx` (asset table, asset-only filters, "New Asset," click-through to detail) and `frontend/src/pages/AssetDetail.tsx` (fields/edit form, `ApprovalBanner`, `DependencyGraph`, Governance Workflow history, "Linked Risks" panel with add/remove via `AssetRisk` endpoints, "Linked Projects" panel via `ProjectAsset`).
- [x] Add `frontend/src/components/SeverityBadge.tsx` reading `risk.severity` from the API (color by `LOW`/`MEDIUM`/`HIGH`/`CRITICAL`).
- [x] Rewrite `frontend/src/components/RiskTable.tsx` as a real sortable `<table>` (severity, framework/category, status, due date, linked-asset count, linked-control count) using `SeverityBadge`, plus a new `frontend/src/components/Pagination.tsx` driven by the API's `{ skip, take, total }` metadata.
- [x] Extend `frontend/src/components/RiskHeatmap.tsx` to color each cell by the severity band of its likelihood×impact score (not just "any vs. none"), add axis labels, and make cells clickable to filter the risk table.
- [x] Add `frontend/src/pages/RiskRegister.tsx` (the table/heatmap/filters above, "New Risk") and `frontend/src/pages/RiskDetail.tsx` (full risk record: linked assets/projects/controls with add/remove, an audit history panel reading `AuditLog` filtered by `entityType: "Risk"`).
- [x] Add `frontend/src/pages/ProjectList.tsx` and `ProjectDetail.tsx` (supersedes the stabilization-pass Project item above) using the existing `frontend/src/components/ProjectTable.tsx`/`ProjectDetail.tsx` as a starting point: create form, asset-link picker, risk-link action, merged risk view from `GET /projects/:id/risks`, and the Project-level CycloneDX export button once that route exists.
- [x] Add `frontend/src/components/BarChart.tsx` and `DonutChart.tsx` — small hand-rolled SVG charts, no new dependency.
- [x] Reorganize `frontend/src/pages/Dashboard.tsx` into labeled sections: Governance Overview (metric tiles + severity donut), Exposure (clickable through to `RiskDetail`), Reuse (bar chart), Coverage (bar chart), Recertification (new, from `GET /dashboard/recertification`), Search.
- [x] Update `frontend/src/components/ApprovalBanner.tsx` to read `risk.severity` from the API instead of its own hardcoded `>= 12` threshold (a third duplicate of the same magic number).

## Model Card module (do after Frontend IA overhaul)

- [x] Add a `ModelCard` model (1:1 with `AIAsset`) to `backend/prisma/schema.prisma` per the schema in `docs/roadmap.md`'s "Model Card module" section (additive migration, no backfill).
- [x] Add `backend/src/modelCardScoring.ts` exporting `REQUIRED_MODEL_CARD_FIELDS` and `modelCardCompleteness(card)`.
- [x] Add `GET /assets/:id/model-card` and `PUT /assets/:id/model-card` (upsert, `requireRole("ADMIN", "RISK_OWNER")`, zod-validated) to `backend/src/app.ts`.
- [x] Extend `POST /assets/:id/transition` in `backend/src/app.ts`: when `toStatus` is `APPROVED`/`DEPLOYED` and `asset.type` is `MODEL` or `SERVICE`, block the transition unless a `ModelCard` exists with no missing required fields (mirror the existing open-risk block's response shape).
- [x] Add `GET /dashboard/model-card-coverage` to `backend/src/app.ts` (counts with/without a card, average completeness, list of assets missing one).
- [x] Update `mapComponent`/`mapService` in `backend/src/cyclonedx.ts` to populate a real CycloneDX `modelCard` field from the linked `ModelCard` record instead of flattening model-card data into `aibom:*` properties.
- [x] Add `frontend/src/components/ModelCardForm.tsx` and show it on `frontend/src/pages/AssetDetail.tsx` (from the Frontend IA overhaul above) for `MODEL`/`SERVICE` type assets.
- [x] Extend `frontend/src/components/ApprovalBanner.tsx` to show "model card incomplete" as a blocking reason alongside the existing open-risk reason.
- [x] Add a "Model Card Coverage" panel to the reorganized `frontend/src/pages/Dashboard.tsx` backed by `GET /dashboard/model-card-coverage`.

## Fix first (before/alongside Phase 1)

- [x] Remove the `?? "development-secret"` fallback in `backend/src/auth.ts` and make `backend/src/server.ts` fail fast at boot if `JWT_SECRET` is unset.
- [x] Add a `Role` enum (`ADMIN`, `RISK_OWNER`, `APPROVER`, `VIEWER`) and a `role` field on `User` in `backend/prisma/schema.prisma`, then generate the migration.
- [x] Create `backend/src/rbac.ts` with a `requireRole(...roles)` middleware and apply it to every delete/transition/control route in `backend/src/app.ts` per the permission matrix in `docs/roadmap.md`.
- [x] Add rate limiting (e.g. `express-rate-limit`) to `POST /auth/login` in `backend/src/app.ts`.
- [x] Add `take`/`skip` query params (with sane defaults/max) to `GET /assets` and `GET /risks` in `backend/src/app.ts`.
- [x] Add a generic `AuditLog` Prisma model and write an entry from every asset/risk/control mutation route in `backend/src/app.ts`.

## Phase 1 — Harden MVP

- [x] Replace the hardcoded `apiBaseUrl` in `frontend/src/App.tsx` with `import.meta.env.VITE_API_BASE_URL`, and add a `.env.example` entry for it in `frontend/`.
- [x] Remove the pre-filled demo credentials from the login form's initial state in `frontend/src/App.tsx`; add explicit 401/403 error handling in the `api()` helper.
- [x] Add Vitest + Supertest to `backend/package.json` and write a first route test covering `/auth/login` success/failure.
- [x] Add Vitest + React Testing Library to `frontend/package.json` and write a first test for the login form.
- [x] Add `.github/workflows/ci.yml` that starts Postgres via `docker-compose.yml`, then runs backend and frontend lint/test/build.

## Phase 2 — Risk Register & Project Reuse Maturity

- [x] Add the `AssetRisk` join model to `backend/prisma/schema.prisma` (expand migration) per `docs/roadmap.md`.
- [x] Write `backend/prisma/scripts/backfill-asset-risk.ts` to populate `AssetRisk` from existing `Risk.assetId`, then ship a contract migration dropping `Risk.assetId`.
- [x] Reshape `Control` into a catalog model and add the `RiskControl` join model in `backend/prisma/schema.prisma`, with a matching backfill script and contract migration for `Control.riskId`.
- [x] Add `POST/DELETE /assets/:assetId/risks/:riskId` link/unlink endpoints to `backend/src/app.ts`.
- [x] Add `GET /controls` catalog listing and `POST/PUT/DELETE /risks/:riskId/controls/:controlId` link endpoints to `backend/src/app.ts`.
- [x] Add `Project`, `ProjectAsset`, `ProjectRisk` models, the `NetworkDependency` enum, and `AIAsset.networkDependency` field to `backend/prisma/schema.prisma` in the same migration as the `AssetRisk`/`Control` reshape (additive, no backfill needed).
- [x] Add `GET/POST/PUT/DELETE /projects` and `/projects/:id` routes to `backend/src/app.ts`.
- [x] Add `POST/DELETE /projects/:projectId/assets/:assetId` and `/projects/:projectId/risks/:riskId` link/unlink routes to `backend/src/app.ts`.
- [x] Add `GET /projects/:id/risks` to `backend/src/app.ts`, merging direct `ProjectRisk` rows with rolled-up `AssetRisk` rows from linked assets, tagged by origin (`"project"` / `"asset"`).
- [x] Add `_count`-based `projectUsageCount` to `GET /assets`/`GET /assets/:id`, and a `GET /assets/:id/projects` drill-down route, in `backend/src/app.ts`.
- [x] Add `backend/src/riskScoring.ts` exporting a shared `severityOf(score)` banding helper for use by the risk heatmap and the dashboard.
- [x] Add `GET /search`, `GET /dashboard/summary`, `GET /dashboard/exposure` routes to `backend/src/app.ts`.
- [x] Introduce React Router in `frontend/src/App.tsx`.
- [x] Split `frontend/src/App.tsx` into `frontend/src/components/AssetTable.tsx`, `RiskTable.tsx`, `RiskFilters.tsx`, `ProjectTable.tsx`, `ProjectDetail.tsx`.
- [x] Wire the existing backend `status`/`type`/`hostingModel`/`sourceFramework`/`networkDependency` query params into real filter UI in the new components.
- [x] Add `frontend/src/components/RiskHeatmap.tsx` plotting likelihood × impact, plus bulk-select/bulk-status-update on the risk table.
- [x] Add a minimal `frontend/src/pages/Dashboard.tsx` (search box, status/type/hostingModel/networkDependency/severity filters, reuse-count table, exposure table) backed by the new `/search` and `/dashboard/*` routes.

## Phase 3 — Governance workflow maturity

- [x] Add `stepIndex`/`requiredRole` fields to `GovernanceWorkflow` in `backend/prisma/schema.prisma`.
- [x] Add policy-gate logic in `POST /assets/:id/transition` (`backend/src/app.ts`) blocking transitions to APPROVED/DEPLOYED while linked open risks exceed a severity threshold.
- [x] Add a `RecertificationSchedule` model and `GET/POST /assets/:id/recertification` endpoints.
- [x] Extend `AuditLog` writes to cover `PUT /assets/:id` field-level edits, not just status transitions.
- [x] Add an approval-status/blocked-reason banner component to the asset detail view in the frontend.

## Phase 4 — AI-SBOM depth

- [x] Add an `AssetDependency` model (`parentAssetId`, `childAssetId`) to `backend/prisma/schema.prisma` for asset composition.
- [x] Vendor the CycloneDX 1.7 schema into `backend/vendor/` and rewrite `validateCycloneDxBom` in `backend/src/cyclonedx.ts` to read it from disk instead of `raw.githubusercontent.com`.
- [x] Add `backend/src/spdx.ts` implementing SPDX export and a `GET /assets/:id/export/spdx` route in `backend/src/app.ts`.
- [x] Add a dependency-graph component to the frontend asset detail page.

## Phase 5 — Dashboards, reporting, integrations

- [x] Add `GET /reports/framework-coverage` and `GET /reports/risk-summary` aggregate endpoints to `backend/src/app.ts`.
- [x] Extend the `frontend/src/pages/Dashboard.tsx` shipped in Phase 2 with risk-by-framework charts and framework-coverage gap analysis, backed by the new report endpoints.
- [x] Add `backend/src/integrations/slack.ts` webhook sender triggered on risk status change.
- [x] Add OIDC/SSO login alongside `POST /auth/login` in `backend/src/app.ts`.
