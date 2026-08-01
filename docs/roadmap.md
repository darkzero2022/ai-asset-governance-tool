# AI-BOM Governance Tool — Technical Roadmap

This is the durable design record for evolving the current MVP (`F:\AIBOM`) into a full **AI Risk Register + AI-SBOM + AI Governance platform**. `CLAUDE.md` and `AGENTS.md` reference this file rather than duplicating it. Decisions here are agreed with the user — don't relitigate without flagging it explicitly.

## Current state (as of this writing)

- **Backend**: TypeScript + Express + Prisma + PostgreSQL. Entry `backend/src/server.ts`, routes `backend/src/app.ts`, auth `backend/src/auth.ts`, CycloneDX export `backend/src/cyclonedx.ts`, schema `backend/prisma/schema.prisma`, seed `backend/prisma/seed.ts`.
- **Frontend**: React 19 + Vite + Tailwind, a single ~500-line component `frontend/src/App.tsx` (no routing, no component split).
- **Data model**: `User` (flat, no role), `AIAsset` (1:many → `Risk`, 1:many → `GovernanceWorkflow`), `Risk` (1:1 to `AIAsset` via `assetId`, 1:many → `Control`), `Control` (1:1 to `Risk` via `riskId`, not reusable), `GovernanceWorkflow` (append-only log of `AIAsset` status transitions only), `FrameworkCategory` + `EuAiActRiskTierReference` (seeded reference data).
- **Auth**: JWT-based, single flat role, `requireAuth` middleware gates every route equally — no authorization differentiation at all.
- **Export**: CycloneDX 1.7 BOM per asset, validated against the live schema fetched from `raw.githubusercontent.com` on first use per process lifetime (cached in-memory only).
- **No tests, no CI, not a git repo yet.** `docker-compose.yml` exists and stands up local Postgres only.

## Top 5 critical issues (fix before/alongside Phase 1)

1. **Silent JWT secret fallback** — `backend/src/auth.ts:18,31` uses `process.env.JWT_SECRET ?? "development-secret"`. Any deployment that forgets to set the env var silently signs/verifies tokens with a public, hardcoded string, letting anyone forge a valid JWT for any user id.
2. **Zero authorization on mutating routes** — every route in `backend/src/app.ts` only calls `requireAuth`. Any authenticated user can `DELETE /assets/:id`, `DELETE /risks/:id`, `DELETE /controls/:id`, or `POST /assets/:id/transition` to self-approve DRAFT→...→DEPLOYED, with no role check anywhere.
3. **CycloneDX live schema fetch with no fallback** — `backend/src/cyclonedx.ts` (`validateCycloneDxBom`/`loadValidator`) fetches the schema from GitHub on first use per process; if GitHub is unreachable or rate-limits, every export fails with a 500 until a fetch happens to succeed.
4. **No audit trail on Risk/Control mutations** — `PUT`/`DELETE` on risks and controls perform no logging at all. A reviewer can't answer "who changed the likelihood/impact or deleted this control and when," undermining the audit story `GovernanceWorkflow` was meant to provide.
5. **No pagination + brute-forceable login** — `GET /assets` and `GET /risks` return unbounded `findMany`; `POST /auth/login` has no rate limit, lockout, or throttling.

## RBAC design

New enum in `backend/prisma/schema.prisma`:
```prisma
enum Role { ADMIN RISK_OWNER APPROVER VIEWER }
```
Add `role Role @default(VIEWER)` to `User`. Single role per user for now (no multi-role).

**Permission matrix**

| Action | ADMIN | RISK_OWNER | APPROVER | VIEWER |
|---|---|---|---|---|
| Asset create/edit | Yes | Yes (own) | No | No |
| Asset delete | Yes | No | No | No |
| Transition → UNDER_REVIEW | Yes | Yes (own asset) | No | No |
| Transition → APPROVED/DEPLOYED | Yes | No | Yes | No |
| Transition → RETIRED | Yes | No | Yes | No |
| Risk create/edit | Yes | Yes (own) | No | No |
| Risk delete | Yes | No | No | No |
| Risk status → ACCEPTED | Yes | No | Yes | No |
| Risk status (other) | Yes | Yes | Yes | No |
| Control catalog create/edit | Yes | Yes | No | No |
| Control catalog delete | Yes | No | No | No |
| Control-link (risk↔control) CRUD | Yes | Yes (own risk) | No | No |
| Export CycloneDX/SPDX | Yes | Yes | Yes | Yes |
| View everything | Yes | Yes | Yes | Yes |

Implementation: new `backend/src/rbac.ts` exporting `requireRole(...roles: Role[])` middleware plus an ownership helper (compare `createdById`/risk owner to `req.user.id`). Add `role` to the JWT payload and the `AuthUser` type in `backend/src/auth.ts`.

## Many-to-many data model reshape

**Risk ↔ Asset** — replace `Risk.assetId` (1:1 FK) with a join table:
```prisma
model AssetRisk {
  id        String   @id @default(cuid())
  assetId   String
  asset     AIAsset  @relation(fields: [assetId], references: [id], onDelete: Cascade)
  riskId    String
  risk      Risk     @relation(fields: [riskId], references: [id], onDelete: Cascade)
  linkedAt  DateTime @default(now())
  @@unique([assetId, riskId])
  @@index([riskId])
}
```
`Risk` drops `assetId`/`asset`, gains `assets AssetRisk[]`. `AIAsset` drops direct `risks Risk[]`, gains `riskLinks AssetRisk[]`.

**Control catalog + reusable linking** — `Control` becomes catalog-only (drops `riskId`); a join table carries the per-link status/evidence that used to live on `Control` itself:
```prisma
model Control {
  id              String   @id @default(cuid())
  name            String
  mappedFramework SourceFramework
  mappedControlId String
  description     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  links           RiskControl[]
  @@unique([mappedFramework, mappedControlId])
}

model RiskControl {
  id                   String   @id @default(cuid())
  riskId               String
  risk                 Risk     @relation(fields: [riskId], references: [id], onDelete: Cascade)
  controlId            String
  control              Control  @relation(fields: [controlId], references: [id], onDelete: Restrict)
  implementationStatus ControlImplementationStatus @default(NOT_STARTED)
  evidenceNotes        String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  @@unique([riskId, controlId])
  @@index([controlId])
}
```

**Migration strategy** (breaking change — expand → backfill → contract, not a single destructive migration):
1. **Expand**: add `AssetRisk`, `Control` (new shape as a separate table or additive columns), `RiskControl` alongside the existing columns.
2. **Backfill**: a script (`backend/prisma/scripts/backfill-asset-risk.ts` and a control-catalog equivalent) that for every existing `Risk.assetId` inserts one `AssetRisk` row, and for every existing `Control` row inserts a deduped catalog `Control` row (`mappedFramework`+`mappedControlId`) plus a `RiskControl` row carrying the old `implementationStatus`/`evidenceNotes` back to the originating risk.
3. **Contract**: a follow-up migration dropping `Risk.assetId` and the old `Control.riskId` once the backfill is verified.

## Project entity & reuse tracking

Two more governance requirements sit on top of the reshape above: (1) every AI module needs to be mappable to how many downstream **Projects** use it — today `AIAsset.downstreamConsumers` is free text, so this can't be counted or filtered; (2) governance needs a first-class **Project** (business AI use case/application) as a peer entity to `AIAsset` (the component), with Risks attachable to either. Both fold into the same Phase 2 migration as the `AssetRisk`/`Control`/`RiskControl` reshape above — `Project`/`ProjectAsset`/`ProjectRisk` are net-new/additive tables (no legacy data), so unlike `AssetRisk`/`RiskControl` they need no backfill script, just a straightforward `prisma migrate dev`.

**Network dependency** — add a field to `AIAsset` separate from the existing `hostingModel` enum, because `hostingModel` describes *who packages/runs it*, not *whether it needs to reach the internet*. A `SELF_HOSTED` model that still phones home for updates/telemetry (hybrid) can't be expressed by `hostingModel` alone:
```prisma
enum NetworkDependency { AIR_GAPPED HYBRID FULLY_CONNECTED }
```
Add `networkDependency NetworkDependency @default(FULLY_CONNECTED)` to `AIAsset`, with `@@index([networkDependency])`. Deliberately no DB-level constraint tying it to `hostingModel` (e.g. forbidding `SAAS_API` + `AIR_GAPPED`) — keep any such check as a soft warning in the `backend/src/app.ts` asset create/update handler, not a hard rule, so hybrid/edge cases stay representable.

**`Project`** (new top-level model, not a repurposed `AIAsset` of type `SERVICE` — it has its own lifecycle and is the thing that *consumes* assets, not one itself):
```prisma
enum ProjectStatus { ACTIVE INACTIVE RETIRED }

model Project {
  id            String        @id @default(cuid())
  name          String
  description   String?
  businessOwner String?
  status        ProjectStatus @default(ACTIVE)
  createdById   String
  createdBy     User          @relation("ProjectCreator", fields: [createdById], references: [id])
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  assetLinks    ProjectAsset[]
  riskLinks     ProjectRisk[]
  @@index([status])
}
```
`User` gains `projects Project[] @relation("ProjectCreator")`.

**`Project` ↔ `AIAsset`** join (same shape/style as `AssetRisk`) — this is what makes the "used in N projects" reuse count possible via `_count`:
```prisma
model ProjectAsset {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assetId   String
  asset     AIAsset  @relation(fields: [assetId], references: [id], onDelete: Cascade)
  linkedAt  DateTime @default(now())
  @@unique([projectId, assetId])
  @@index([assetId])
}
```
`AIAsset` gains `projectLinks ProjectAsset[]`.

**`Project` ↔ `Risk`**: a join table, not a nullable FK on `Risk` — for the same reason `Risk.assetId` was replaced with `AssetRisk`: a project-scoped risk (e.g. "this use case processes PII") can legitimately recur across multiple projects without duplicating rows, and keeping `Risk` link-agnostic (join tables only, no direct FKs to either `Project` or `AIAsset`) avoids two inconsistent linking patterns on the same model.
```prisma
model ProjectRisk {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  riskId    String
  risk      Risk     @relation(fields: [riskId], references: [id], onDelete: Cascade)
  linkedAt  DateTime @default(now())
  @@unique([projectId, riskId])
  @@index([riskId])
}
```
`Risk` gains `projects ProjectRisk[]` alongside `assets AssetRisk[]`. A project's risk view (`GET /projects/:id/risks`) merges its direct `ProjectRisk` rows with the rolled-up `AssetRisk` rows of every asset it links to, deduped by `risk.id` and tagged `origin: "project" | "asset"`.

**New API surface** (`backend/src/app.ts`): `GET/POST/PUT/DELETE /projects` + `/projects/:id`; `POST/DELETE /projects/:projectId/assets/:assetId` and `/projects/:projectId/risks/:riskId` (link/unlink); `GET /projects/:id/risks` (merged view, see above); `_count`-based `projectUsageCount` added to `GET /assets`/`GET /assets/:id`, plus `GET /assets/:id/projects` for the drill-down; `GET /search?q=` (cross-entity search over `AIAsset.name`, `Project.name`/`description`, `Risk.description`); `GET /dashboard/summary` (counts by status/type/hostingModel/networkDependency, risk severity buckets, project count, top-N assets by reuse count) and `GET /dashboard/exposure` (Projects/Assets with open High/Critical risk). Severity banding for both the risk heatmap and the dashboard is centralized in a new `backend/src/riskScoring.ts` exporting `severityOf(score)`, so the logic isn't duplicated between the two features.

## Stabilization pass (verified gaps after Phase 1–5 backlog was marked complete)

A supervisor review after all five phases were checked off found the backlog items were mostly implemented as literally worded, but several either had incorrect/underspecified wording in the first place, or were agreed with the user in conversation and never actually written into this document before Codex ran. Fix these before any further phase work:

1. **RBAC gap on the original asset/risk CRUD routes.** `POST /assets`, `PUT /assets/:id`, `POST /risks`, `PUT /risks/:id` in `backend/src/app.ts` only call `requireAuth`, never `requireRole` — any authenticated user, including the default `VIEWER` role, can create or edit any asset or risk. Root cause: the original "Fix first" backlog item only said *"apply it to every delete/transition/control route,"* omitting create/edit, which contradicts the RBAC permission matrix above. Fix: add `requireRole("ADMIN", "RISK_OWNER")` to all four routes.
2. **Project management UI was never wired up.** `frontend/src/components/ProjectTable.tsx` and `ProjectDetail.tsx` exist as files (the Phase 2 backlog item is technically satisfied) but neither is imported or rendered anywhere in `frontend/src/App.tsx` — there is no "New Project" form, no way to link an asset or risk to a project, and no route to view a project's detail page. The backend (`/projects`, `/projects/:id/assets/:assetId`, `/projects/:id/risks/:riskId`) is fully built and correct; only the UI is missing. **Superseded by the "Frontend IA overhaul" section below** — build Projects directly as its own page in the new structure rather than wiring it into the single-page layout that's about to be split apart; don't do this item as originally worded.
3. **Risk/Control deletion is still a hard cascade delete**, contradicting the agreed decision to archive instead. `DELETE /risks/:id` and `DELETE /controls/:id` in `backend/src/app.ts` still call `prisma.risk.delete`/`prisma.control.delete` directly, silently removing the row from every linked project/asset at once. Fix: add an `archived Boolean @default(false)` (or a `status` value) to `Risk` and `Control`; `DELETE` sets `archived: true` instead of removing the row when any links exist; only allow a true hard delete (ADMIN-only) when there are zero links.
4. **No segregation-of-duties note exists anywhere**, despite the agreed "design now, build later." Add a documented requirement to the "Governance workflow maturity" section below: the user who creates/edits a `Risk` should not also be the one who transitions it to `ACCEPTED`, and the person who moves an asset to `UNDER_REVIEW` should not be the same person who approves it to `APPROVED`. Enforcement is deferred (needs `Risk.createdById`/`ownerId`, which doesn't exist yet — today `Risk.owner` is a free-text string, not a `User` FK), but the requirement must stay visible so it isn't silently dropped again.
5. **Dashboard/report aggregate routes reintroduced the unbounded-`findMany` anti-pattern** the very first fix-first item was written to eliminate elsewhere. `GET /dashboard/summary` and `GET /reports/risk-summary` in `backend/src/app.ts` both run `prisma.risk.findMany` over the whole table to bucket severity in JS. Fix: replace with `prisma.risk.groupBy`/`count` at the DB level, using range filters derived from the `severityOf()` bands in `backend/src/riskScoring.ts`.
6. **SPDX export has no `relationships` array.** `backend/src/spdx.ts` `buildSpdxDocument` produces `packages` with no `DESCRIBES` relationship from `SPDXRef-DOCUMENT` to each package — likely not a spec-valid SPDX 2.3 document. Add a `relationships` array.
7. **Severity threshold duplicated instead of derived.** `backend/src/app.ts` hardcodes `inherentRiskScore: { gte: 12 }` independently in both the transition policy gate and `GET /dashboard/exposure`, instead of deriving the cutoff from `severityOf()` in `backend/src/riskScoring.ts`. Fix: export a `HIGH_SEVERITY_MIN_SCORE` constant from `riskScoring.ts` and use it in both places.
8. **Stale backfill scripts.** `backend/prisma/scripts/backfill-asset-risk.ts` and `backfill-risk-control.ts` reference fields (`Risk.assetId`, `Control.riskId`) that no longer exist in the current `schema.prisma` after the contract migrations — they'd fail to compile if run again. Move them to `backend/prisma/scripts/archive/` with a comment noting they're historical, one-time-use records of the Phase 2 migration, not runnable against the current schema.
9. **The asset create/edit form has no field to set `networkDependency`.** Verified live: the "Create Asset" form in `frontend/src/App.tsx` has Name/Version/Type/Hosting Model/Supplier/Provider/License/Data Classification/Training Data Provenance/Downstream Consumers, but no Network selector — even though the field is fully filterable and displayed elsewhere in the UI. Every asset silently keeps the DB default (`FULLY_CONNECTED`) unless set via a raw API call. Add a `networkDependency` `Select` (`AIR_GAPPED`/`HYBRID`/`FULLY_CONNECTED`) to the create/edit form in `frontend/src/App.tsx`, alongside the existing Hosting Model select.
10. **No Project-level SBOM export.** Only per-asset export exists (`GET /assets/:id/export/cyclonedx`). Add `GET /projects/:id/export/cyclonedx` producing one BOM listing every asset linked to that project as a component/service — this is the natural payoff of the `Project` entity and folds into the Model Card module below (both touch `backend/src/cyclonedx.ts`).

## Frontend IA overhaul: separate Risk Register from Asset Management, richer Dashboard

A live walkthrough plus reading the actual components confirmed the complaint: `frontend/src/App.tsx` renders the asset table, asset form, risk form, and the entire Risk Register (heatmap + risk cards) stacked on one screen sharing one filter bar (`RiskFilters.tsx`) that mixes asset and risk filters together. There is no dedicated Risk Register view, no dedicated Asset Management view, and the Dashboard is a flat grid of label/value rows with no real charts. Concrete problems found:

- `RiskHeatmap.tsx` colors a cell amber if count > 0, slate otherwise — a single Critical (5×5) and a single Low (1×1) risk render identically. No axis labels.
- `RiskTable.tsx` always renders the score in the same amber pill regardless of severity, shows only one linked asset (`risk.asset?.name`, the backward-compat first-linked shim) even though a risk can now be linked to many, and shows no linked controls or projects.
- The `>= 12` "high severity" threshold is now hardcoded a **third** time in `ApprovalBanner.tsx` (on top of the two backend duplicates in the stabilization pass above) — three places to keep in sync by hand.
- `RecertificationSchedule` (built in Phase 3) has zero UI visibility anywhere — not on the asset page, not on the Dashboard.
- No pagination controls exist in the UI despite the backend supporting `skip`/`take`.

Agreed with the user:
- Detail views (asset, risk, project) are **dedicated pages with their own URL**, not slide-over panels — there's enough content per record (workflow history, dependency graph, model card, linked risks/controls) to warrant the room.
- Dashboard charts are **hand-rolled lightweight SVG** (bars/donuts), no new charting dependency — consistent with the earlier call to drop `react-router-dom` over npm audit findings; keep the dependency surface small.
- **Do not reintroduce `react-router-dom`** — it was deliberately removed (see `CHANGES.log`, "Close backlog and audit cleanup") after `npm audit` found no patched release available. Extend the existing lightweight `pushState`-based switch in `frontend/src/App.tsx` into a real path-param-capable router instead.

**Routing**: add `frontend/src/router.tsx` exporting a small `useRoute()` hook that matches `window.location.pathname` against a route table (`/dashboard`, `/assets`, `/assets/:id`, `/risks`, `/risks/:id`, `/projects`, `/projects/:id`) and returns `{ name, params }`; keep the existing `navigate(path)` pushState helper. Top nav becomes Dashboard | Assets | Risk Register | Projects.

**Backend support needed for the frontend to stop re-deriving severity**: add `severity` (via `severityOf()`) directly onto risk objects in `riskResponse()` in `backend/src/app.ts`, so the frontend has one source of truth instead of a fourth reimplementation of the threshold. Add `GET /dashboard/recertification` (or fold into `/dashboard/summary`) returning `MODEL`/`SERVICE` assets whose `RecertificationSchedule.nextDueDate` is overdue or due within N days — nothing surfaces this data today.

**Pages** (new, `frontend/src/pages/`):
- `AssetList.tsx` — asset table + asset-only filters + "New Asset" + click-through to `AssetDetail`.
- `AssetDetail.tsx` — the asset record: fields/edit form, `ApprovalBanner`, `DependencyGraph`, `ModelCardForm` (once the Model Card module lands), Governance Workflow history, a "Linked Risks" panel (via `AssetRisk`, add/remove), a "Linked Projects" panel (via `ProjectAsset`).
- `RiskRegister.tsx` — dedicated risk list: real `<table>` (not stacked cards) with sortable columns (severity, framework/category, status, due date, linked-asset count, linked-control count), severity-colored via a shared `SeverityBadge` component reading `risk.severity` from the API, risk-only filters, pagination controls, "New Risk."
- `RiskDetail.tsx` — full risk record: description/treatment/owner/due date, linked assets (add/remove via `AssetRisk` endpoints), linked projects (via `ProjectRisk`), linked controls with implementation status (via `RiskControl`, add/edit/remove), and an audit history panel reading `AuditLog` filtered by `entityType: "Risk"`.
- `ProjectList.tsx` / `ProjectDetail.tsx` — supersedes stabilization item 2 above: built directly into this new structure rather than wired into the old single page. `ProjectDetail` shows the merged risk view from `GET /projects/:id/risks` (origin-tagged), linked assets (add/remove), and the Project-level CycloneDX export button once that route exists (stabilization item 10).

**Components** (new/extended, `frontend/src/components/`):
- `SeverityBadge.tsx` — shared badge colored by `severity` (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`), read from the API, not recomputed client-side.
- Extend `RiskHeatmap.tsx` to color each cell by the severity band of that likelihood×impact score (not just "any count vs. none"), add axis labels, and make cells clickable to filter the risk table to that combination.
- Extend `RiskTable.tsx` into a real sortable table using `SeverityBadge`, with a `Pagination.tsx` component (new, reusable, driven by the API's existing `{ skip, take, total }` metadata).
- `BarChart.tsx` / `DonutChart.tsx` — small hand-rolled SVG chart components, no dependency, used by the Dashboard.

**Dashboard reorganization** (`frontend/src/pages/Dashboard.tsx`): replace the flat `Panel`/`Row` grid with clearly labeled sections — Governance Overview (metric tiles + a severity donut chart), Exposure (open High/Critical risks, clickable through to `RiskDetail`), Reuse (top assets by project count, bar chart), Coverage (framework coverage gaps, bar chart), **Recertification** (new — due/overdue list from `GET /dashboard/recertification`), Search. The Model Card Coverage panel (from the Model Card module below) slots in here too.

## Model Card module

The user asked whether "model card" is the same concept as AI-BOM. It is: a Model Card (Mitchell et al. — intended use, training/eval data, performance metrics, limitations, ethical considerations) is what CycloneDX's ML-BOM extension formalizes as the `modelCard` object on a component. This is the same gap already identified as critical issue — CycloneDX export uses ad hoc `aibom:*` properties instead of real `modelCard` fields. Don't build Model Card as a separate top-level governed entity like `Project`/`Risk` — a model card is inherently 1:1 with one `AIAsset`, not something reused/shared across many, so it doesn't need the many-to-many treatment those entities got.

Agreed with the user:
- Model Card applies to `AIAsset` of type `MODEL` and `SERVICE` (a SaaS API service still carries governance-relevant considerations even though the org doesn't train/host the underlying model).
- Analytics scope was **portfolio-level only** at first ship: completeness/coverage tracking (which assets have a card, completeness %, which are missing fairness/limitations sections) — not cross-model quantitative metric comparison, with `performanceMetrics` as a flexible `Json` field. **Now superseded — see "Model Card metric-level analytics" below**, where the user asked for real cross-model metric comparison.
- A Model Card is **required** before a `MODEL`/`SERVICE` asset can transition to `APPROVED` or `DEPLOYED` — a real governance gate, not just tracked-only.

**Schema** (new, 1:1 with `AIAsset`, additive migration — no backfill needed):
```prisma
model ModelCard {
  id                           String   @id @default(cuid())
  assetId                      String   @unique
  asset                        AIAsset  @relation(fields: [assetId], references: [id], onDelete: Cascade)
  approach                     String?
  task                         String?
  architectureFamily           String?
  modelArchitecture            String?
  datasetsDescription          String?
  inputsDescription             String?
  outputsDescription            String?
  intendedUsers                String?
  useCases                     String?
  technicalLimitations         String?
  performanceTradeoffs         String?
  ethicalConsiderations        String?
  fairnessAssessments          String?
  environmentalConsiderations  String?
  performanceMetrics           Json?
  createdAt                    DateTime @default(now())
  updatedAt                    DateTime @updatedAt
}
```
`AIAsset` gains `modelCard ModelCard?`.

**Completeness scoring**: add `backend/src/modelCardScoring.ts` exporting a `REQUIRED_MODEL_CARD_FIELDS` list (`task`, `architectureFamily` or `modelArchitecture`, `intendedUsers`, `useCases`, `technicalLimitations`, `ethicalConsiderations`) and `modelCardCompleteness(card): { percent: number; missingFields: string[] }`, used by both the policy gate and the dashboard.

**API** (`backend/src/app.ts`): `GET /assets/:id/model-card`; `PUT /assets/:id/model-card` (upsert, `requireRole("ADMIN", "RISK_OWNER")`, `zod`-validated); extend `POST /assets/:id/transition` — when `toStatus` is `APPROVED`/`DEPLOYED` and `asset.type` is `MODEL` or `SERVICE`, require a `ModelCard` exists and `modelCardCompleteness` has no missing required fields, else block with `{ error: "Model card incomplete", missingFields }` (same pattern as the existing open-risk block); add `GET /dashboard/model-card-coverage` returning counts of `MODEL`/`SERVICE` assets with/without a card, average completeness, and a list of assets missing one.

**CycloneDX export** (`backend/src/cyclonedx.ts`): `mapComponent`/`mapService` gain a `modelCard` field populated from the linked `ModelCard` record (when present), shaped to the real CycloneDX `modelCard` structure (`modelParameters`, `quantitativeAnalysis.performanceMetrics`, `considerations`) instead of flattening everything into `aibom:*` properties. This is the same work as stabilization item 9 above (both touch this file) — do them together.

**Frontend**: `frontend/src/components/ModelCardForm.tsx` (the fill-in form, shown on `frontend/src/pages/AssetDetail.tsx` for `MODEL`/`SERVICE` types — see the "Frontend IA overhaul" section above); extend `frontend/src/components/ApprovalBanner.tsx` to also show "model card incomplete" as a blocking reason alongside the existing open-risk reason (and switch it to read `risk.severity` from the API instead of its own hardcoded threshold, per that same section); add a "Model Card Coverage" panel to the reorganized `frontend/src/pages/Dashboard.tsx` backed by `GET /dashboard/model-card-coverage`.

## UI polish pass (verified live after the Frontend IA overhaul + Model Card module were marked complete)

The IA split genuinely happened — four real pages/routes, working navigation, functional linked-assets/projects/controls panels, both policy gates verified blocking server-side by logging in at `http://localhost:5173` and walking through Assets, Risk Register, Projects, and Dashboard. But live testing found concrete defects, not vague ones:

1. **Model Card blocking message is broken for every asset without a card yet** (i.e. all of them today). Live: the asset detail banner reads *"Model Card incomplete: modelCard"* — a literal placeholder string, not real field names.
   - Root cause: `modelCardResponse()` in `backend/src/app.ts` (~line 143-144) does `return card ? { ...card, completeness: modelCardCompleteness(card) } : null;` — when no `ModelCard` row exists yet, it returns `null` and the completeness calculation is discarded entirely.
   - `frontend/src/components/ApprovalBanner.tsx:7` then falls back to a hardcoded placeholder: `modelCard?.completeness?.missingFields ?? ["modelCard"]`.
   - Fix: change the `GET /assets/:id/model-card` handler (`backend/src/app.ts` ~line 304-318) to always return a `completeness` field computed via `modelCardCompleteness(modelCard)` (already null-safe per `backend/src/modelCardScoring.ts`), independent of whether `modelCard` itself is null — e.g. `res.json({ modelCard: modelCardResponse(modelCard), completeness: modelCardCompleteness(modelCard) })`. Update `frontend/src/pages/AssetDetail.tsx` to pass this top-level `completeness` into `ApprovalBanner`/`ModelCardForm` instead of `modelCard?.completeness`. Remove the `["modelCard"]` placeholder fallback from `ApprovalBanner.tsx` entirely.
2. **"Framework Coverage Gaps" chart shows fake data.** `frontend/src/pages/Dashboard.tsx:142` filters to zero-risk categories then hardcodes every bar to `value: 1` — every bar renders identically regardless of anything real; it looks like a chart but conveys no information. Fix: show **all** categories with `value: item.riskCount` as real bar height (depth + gaps in one view), with zero-count bars colored distinctly via a new optional per-datum `color` on `BarChart.tsx` (default to the existing cyan when omitted, so other call sites are unaffected).
3. **Stray import placement.** `frontend/src/pages/RiskDetail.tsx:193` has `import type { ReactNode } from "react";` after all component code at the end of the file instead of at the top. Works today (ES module hoisting) but is sloppy and likely fails lint. Move it to the top with the other imports.
4. **Visual inconsistency across the four main pages.** `Dashboard.tsx` and `RiskRegister.tsx` both open with a bold dark (`bg-slate-950`) hero panel; `AssetList.tsx` and `ProjectList.tsx` use plain light cards with no equivalent treatment. Agreed direction: **light everywhere** — restyle the `RiskRegister.tsx` risk-list/heatmap container and the `Dashboard.tsx` top hero from dark (`bg-slate-950 text-white`) to the same light card treatment already used in `AssetList.tsx`/`ProjectList.tsx` (`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200`), adjusting internal text/input colors (e.g. Dashboard's search input) to their light equivalents accordingly.

## Demo data seeding

Every live review so far has worked against essentially one asset and one risk from `backend/prisma/seed.ts` — zero projects, zero controls linked, no recertification data, no filled-in Model Card. That makes it hard to judge the Dashboard, Risk Register, and Model Card Coverage panels, which all render mostly-empty/zero states. This is still a prototype/evaluation phase (not moving toward real deployment yet), so richer **synthetic** demo data is the right call, not real production data.

Extend `backend/prisma/seed.ts` (all via `upsert`, matching the existing idempotent pattern) to add:
- Several more `AIAsset` rows spanning `type` (MODEL/DATASET/SERVICE/LIBRARY), `hostingModel`, `networkDependency`, and `status` (including at least one in each of DRAFT/UNDER_REVIEW/APPROVED/DEPLOYED/RETIRED) so status/type/hosting/network filters all have real variety to filter across.
- A few `Project` rows, each linked (via `ProjectAsset`) to more than one asset, so `projectUsageCount`/reuse-count panels show non-zero data and at least one asset is shared across 2+ projects.
- More `Risk` rows across different `sourceFramework`/`sourceCategoryId` combinations and likelihood×impact pairs, deliberately spanning all four `severityOf()` bands (LOW/MEDIUM/HIGH/CRITICAL) — today only one HIGH risk exists. Include some in `MITIGATED`/`ACCEPTED` status, and at least one `Risk` linked to more than one asset (via `AssetRisk`) and one linked directly to a `Project` (via `ProjectRisk`) to exercise the merged risk view.
- A few catalog `Control` rows linked via `RiskControl` with varied `implementationStatus`.
- At least one fully-filled `ModelCard` (all required fields present, high completeness) on a `MODEL` asset, and leave at least one `MODEL`/`SERVICE` asset without one — so the Model Card Coverage panel shows a real with/without split instead of "1 required, 0 with card."
- One `RecertificationSchedule` row with a `nextDueDate` in the past (to populate the "Recertification" dashboard panel with an OVERDUE entry) and one due soon.

## Model Card metric-level analytics

The Model Card module originally scoped `performanceMetrics` as a flexible `Json` blob with portfolio-level completeness tracking only, explicitly flagging that real cross-model metric comparison would need a normalized table "at that time." That time is now — the user wants to compare quantitative metrics (e.g. accuracy, F1) across models, not just track whether a card exists.

**Schema**: add a new `ModelCardMetric` model (expand migration; the existing `ModelCard.performanceMetrics` `Json?` field stays as-is for freeform/extra data, this is additive, not a replacement):
```prisma
model ModelCardMetric {
  id          String    @id @default(cuid())
  modelCardId String
  modelCard   ModelCard @relation(fields: [modelCardId], references: [id], onDelete: Cascade)
  metricName  String
  metricValue Float
  slice       String?
  recordedAt  DateTime  @default(now())
  @@index([modelCardId])
  @@index([metricName])
}
```
`ModelCard` gains `metrics ModelCardMetric[]`.

**API** (`backend/src/app.ts`): `POST/PUT/DELETE /assets/:id/model-card/metrics/:metricId` (or nested create/update on the existing `PUT /assets/:id/model-card` upsert — either is fine, but keep metric CRUD auditable like other mutations); add `GET /reports/model-metrics?metricName=accuracy` returning every model's value for that metric (asset id/name, task, value, slice) so the frontend can chart a real comparison, plus an aggregate (avg/min/max) grouped by `task` or `architectureFamily`.

**CycloneDX export** (`backend/src/cyclonedx.ts`): build `modelCard.quantitativeAnalysis.performanceMetrics` from the linked `ModelCardMetric` rows instead of the raw `performanceMetrics` JSON blob.

**Frontend**: extend `frontend/src/components/ModelCardForm.tsx` with a structured metric-row editor (name, value, optional slice — add/remove rows) instead of only the raw JSON textarea; add a "Model Performance Metrics" panel to `frontend/src/pages/Dashboard.tsx` — a metric-name picker plus a `BarChart` comparing that metric's value across every model that reports it.

### Fix: metric CRUD was never actually built (found live, `CHANGES.log` claim doesn't match reality)

The reporting side of this section shipped correctly and is verified live (`GET /reports/model-metrics`, the Dashboard panel, real seeded data flowing through). But `CHANGES.log` claims "audited CRUD" for `ModelCardMetric` that does not exist:

1. **No mutation routes exist at all.** `backend/src/app.ts` has no `POST`/`PUT`/`DELETE` for `/assets/:id/model-card/metrics[...]` — only the read-only `/reports/model-metrics`. The frontend (`ModelCardForm.tsx`'s structured metric editor, wired up in `frontend/src/App.tsx`'s `saveModelCard`) calls these routes expecting them to exist. Reproduced live: adding a metric and saving produces `POST /assets/:id/model-card/metrics → 404 Not Found`, shown to the user as a bare "Not Found" error, and the typed metric is lost.
2. **Even existing metrics don't display on the asset detail page.** `GET /assets/:id/model-card` (~line 304-318) never includes the `metrics` relation in its `prisma.modelCard.findUnique` call (unlike the CycloneDX export queries, which correctly do `include: { metrics: true }`). So a model with real seeded `ModelCardMetric` rows still shows "No structured metrics yet." on its own detail page — the data only surfaces through the separate reporting endpoint.
3. **No test caught this** because none of the new tests exercise the metric mutation routes — the RBAC integration tests stop at `PUT /assets/:id/model-card` and never touch `/model-card/metrics`.

Fix: add `POST /assets/:id/model-card/metrics` (create), `PUT /assets/:id/model-card/metrics/:metricId` (update), `DELETE /assets/:id/model-card/metrics/:metricId` (delete) to `backend/src/app.ts`, all `requireRole("ADMIN", "RISK_OWNER")` and audited via the existing `audit()` helper, matching the pattern used by every other link/mutation route in the file. Add `metrics: true` to the `include` on the `GET /assets/:id/model-card` handler's `prisma.modelCard.findUnique` call. Add at least one integration test exercising create/update/delete on a metric so this can't silently regress again.

## Test coverage pass

Test coverage has stayed thin through every phase — one backend login test, one frontend login-form test, and everything since (RBAC, migrations/backfills, policy gates, CycloneDX/SPDX export) has been verified only by manual live review. Build out real coverage, cheapest/highest-value first:

1. **Unit tests for pure functions that currently have none**: `severityOf()`/`HIGH_SEVERITY_MIN_SCORE` (`backend/src/riskScoring.ts`), `modelCardCompleteness()` (`backend/src/modelCardScoring.ts`), `canTransitionAsset()` (`backend/src/rbac.ts`). Cheap, no DB/HTTP setup needed, immediate regression protection for the exact logic that's been hand-verified live three separate times in this project already.
2. **RBAC permission-matrix integration tests** (`backend/src/app.test.ts` or a new `rbac.test.ts`): table-driven tests hitting each mutating route (`POST/PUT /assets`, `POST/PUT /risks`, deletes, transitions, control/project/model-card routes) with `ADMIN`/`RISK_OWNER`/`APPROVER`/`VIEWER` tokens, asserting the permission matrix in this file is actually enforced — this is the exact class of gap (missing `requireRole` on create/edit routes) that a live review caught once already.
3. **Policy-gate tests**: transition blocked when an open HIGH/CRITICAL risk exists, transition blocked when a `MODEL`/`SERVICE` asset has no complete Model Card, both unblocked once resolved.
4. **Archive-not-delete tests**: deleting a linked `Risk`/`Control` archives instead of hard-deleting; deleting an unlinked one hard-deletes.
5. **CycloneDX/SPDX export fixture tests**: build a BOM from a known fixture asset (with risks/controls/Model Card) and assert it validates against the vendored schema via `validateCycloneDxBom`; assert the SPDX document includes the `DESCRIBES` `relationships` entries.
6. **Frontend component tests**: `SeverityBadge` color mapping, `ApprovalBanner` blocking logic (risk severity + Model Card completeness), `BarChart` per-datum `color` override, `RiskHeatmap` cell coloring/click-filter callback.

## Maturity gaps identified in supervisor review (post Model-Card-metrics round)

A holistic review of the whole project — not a single-feature review — surfaced structural gaps that go beyond "add another feature." Verdict: solid enough for a small internal pilot (one admin account, a handful of real assets), not yet ready for real multi-user or audit-facing use. These are the gaps, in priority order.

### 1. Version control & change discipline

This repository has had no git history through the entire build — every round has been "Codex edits files directly, supervisor diffs by re-reading files afterward." That's part of why gaps like the metric-CRUD one above shipped silently: there's no commit history to review, no diff to read, no rollback path except manual file surgery. Fix: `git init`, an initial commit capturing the current state as a baseline, then a commit alongside every `CHANGES.log` entry going forward (not instead of it — `CHANGES.log` keeps the rationale/testing narrative, git commits make the actual diff reviewable and revertible). Update `AGENTS.md` to require this.

### 2. User management

There is no way to create a second real user, reset a password, or deactivate someone short of touching the database directly via `seed.ts` or raw SQL — today only `admin@example.com` exists. This blocks any real multi-person pilot. Add:
- `GET/POST /users` (`ADMIN`-only) and `PUT /users/:id` (role change, deactivate via a new `active Boolean @default(true)` on `User`, admin-set password reset — no email infra exists yet, so an admin-set temporary password is the pragmatic v1, not a self-service email flow).
- `requireAuth` should reject deactivated users (check `active` in the JWT verification path or on each request).
- A `frontend/src/pages/Users.tsx` admin-only page: list, invite/create, role change, deactivate, reset password.

### 3. RBAC ownership scoping was never real

The permission matrix has said `RISK_OWNER (own)` since it was first designed, but no `createdById`/ownership check was ever implemented anywhere — any `RISK_OWNER` can edit any other `RISK_OWNER`'s asset or risk today. Root cause: `Risk` has no `createdById` field at all (only `AIAsset` does), so there was never anything to check against for risks. Fix:
- Add `Risk.createdById` (`User` FK, expand migration; backfill existing rows to the seed admin user since there's no way to recover the real historical creator, this is synthetic demo data anyway).
- Enforce in `PUT /risks/:id` and `PUT /assets/:id`: `RISK_OWNER` may only edit rows where `req.user.id === row.createdById`; `ADMIN` bypasses the check.
- Update the RBAC integration tests to cover both the "own" and "not own" cases for `RISK_OWNER`.

### 4. Segregation of duties (deferred earlier, now buildable)

This was documented as "design now, build later" back in Phase 3, blocked on not having a real ownership field. Item 3 above unblocks it. Enforce:
- The user who transitioned an asset to `UNDER_REVIEW` (from `GovernanceWorkflow`, already recorded) cannot be the same user who approves it to `APPROVED`.
- The user who created/owns a `Risk` (now `Risk.createdById`) cannot be the one who transitions it to `ACCEPTED`.
- Both checks live in `POST /assets/:id/transition` and `PUT /risks/:id` respectively, returning a clear 403 with an explanatory message, mirroring the existing policy-gate error shape.

### 5. Real OIDC/SSO

`GET /auth/oidc/login` and `/auth/oidc/callback` are stubs returning 501. Implement a real generic OIDC authorization-code flow (a standard library such as `openid-client`, not a hand-rolled one) so it's functional once an org points it at a real identity provider — actual production SSO usage still depends on deployment configuration, which is out of scope while this stays in evaluation phase, but the code path itself should work end-to-end against a real IdP, not just return "not configured."

### 6. Notifications beyond Slack-on-status-change

The only proactive notification today is a Slack ping when a risk's status changes. Nothing nudges anyone about overdue/due-soon recertification (`RecertificationSchedule` + `GET /dashboard/recertification` already exist, just never trigger anything) or an asset stuck in `DRAFT`/`UNDER_REVIEW` too long. Add `backend/src/jobs/notifyRecertifications.ts`, runnable via `npm run` (manually or by an external cron/task scheduler — no in-process scheduler exists and adding one is out of scope for now), reusing the existing `sendSlackRiskStatusChange`-style webhook sender for recertification and stale-asset alerts.

### 7. Reporting export (CSV)

CycloneDX/SPDX JSON isn't what you hand a board or an auditor. Add `GET /risks/export/csv` and `GET /assets/export/csv` (respecting the same filters as the list endpoints), producing a flat CSV a GRC team can open in Excel. PDF export is a real future want but meaningfully more work (a rendering pipeline); scope CSV first as the practical, low-effort, high-value option.

### 8. Deployment documentation

Everything today assumes local dev (`docker-compose.yml` Postgres, Vite dev server, `.env` files). Since real deployment isn't imminent, don't build infrastructure prematurely — instead add `docs/deployment.md` documenting what production would need: containerizing both services, a real Postgres target, a secrets manager instead of `.env` files, and the `prisma migrate deploy` process. Documentation now, infrastructure when it's actually time.

### 9. Control catalog dedup

Flagged early, never addressed: creating a control has no search/typeahead against the existing catalog, so near-duplicate entries (e.g. "MFA Enabled" vs. "Multi-Factor Authentication") can accumulate. Add a simple search-as-you-type suggestion (case-insensitive `contains` match against `Control.name`/`mappedControlId`) when creating a control from `frontend/src/pages/RiskDetail.tsx`'s control-link picker.

### 10. EU AI Act tier suggestion

`euAiActRiskTier` is pure manual entry today. Add a lightweight, non-binding suggestion (not an enforced rule) based on asset attributes (`dataClassificationTouched` containing biometric/sensitive-category keywords, or the linked risk's `sourceCategoryId`) that pre-fills the dropdown for the user to confirm or override — never silently auto-set it.

### 11. Asset field history (cheap win — reuse existing infrastructure)

Flagged early as "no versioning story for `AIAsset`," but the fix doesn't need a schema change: `AuditLog` already captures `beforeJson`/`afterJson` on every `AIAsset` update. Add a "Field History" panel to `frontend/src/pages/AssetDetail.tsx` reading `GET /audit-logs?entityType=AIAsset&entityId=` (the endpoint already exists, added for the Risk audit history panel) and rendering a diff of what changed between versions over time.

## Import asset and Model Card data from a URL

New capability: let a user paste a URL (a vendor's model card page, an internal wiki page, a HuggingFace model card, etc.) and pre-fill asset/Model Card fields from it instead of retyping everything by hand. This touches both `AIAsset` creation and the Model Card form.

**Security note first, since this is a security/GRC tool fetching arbitrary user-supplied URLs server-side — this is a textbook SSRF surface if built carelessly.** The fetch must happen server-side (to avoid CORS and to control what's fetched), and the backend must:
- Only allow `http`/`https` schemes.
- Resolve the hostname and reject requests to loopback, private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`, including the cloud metadata endpoint `169.254.169.254`), and other non-public IP ranges.
- Enforce a short timeout (e.g. 5s) and a response size cap (e.g. 2MB) to prevent slow-loris/large-payload abuse.
- Never follow redirects to a blocked destination (re-validate after each redirect hop, or disable redirect-following entirely).

**Design**: don't auto-populate structured governance fields directly from scraped content — a webpage shouldn't silently become the authoritative source for compliance data. Fetch and extract, but let the user review and place content into fields themselves.

**Schema**: add `sourceUrl String?` to `AIAsset` (provenance — where this asset's documentation came from; shown on `AssetDetail.tsx` and included in CycloneDX export as an external reference).

**API** (`backend/src/app.ts`): `POST /assets/import-url` (also usable for an existing asset via `POST /assets/:id/import-url`), `requireRole("ADMIN", "RISK_OWNER")`, body `{ url }`. Server-side: validate/fetch per the security rules above, strip HTML to extract `<title>`, the meta description, and a truncated plain-text excerpt of the visible body content. Response: `{ sourceUrl, suggestedTitle, suggestedDescription, excerpt }` — a suggestion payload, not a direct write.

**Frontend**: an "Import from URL" field on the asset create form and on `ModelCardForm.tsx` — a URL input plus a "Fetch" button that calls the import endpoint and shows the extracted title/description/excerpt in a preview panel the user can copy from into the real fields (`datasetsDescription`, `task`, etc.) and edit before saving. The `sourceUrl` itself always gets stored on the asset regardless of whether extraction succeeds, so there's always a citation trail even if the page couldn't be parsed usefully.

## Phase 1 — Harden MVP

**Prisma**: add `Role` enum + `User.role`; add a generic `AuditLog` model (`entityType`, `entityId`, `action`, `actorId`, `beforeJson`, `afterJson`, `timestamp`).
**API**: remove the JWT fallback and fail fast at boot if `JWT_SECRET` is unset; add rate limiting to `/auth/login`; add `backend/src/rbac.ts` and apply it across mutating routes in `backend/src/app.ts`; add `take`/`skip` pagination to `GET /assets` and `GET /risks`; write an `AuditLog` row from every risk/control/asset mutation handler.
**Frontend**: move `apiBaseUrl` in `frontend/src/App.tsx` to `import.meta.env.VITE_API_BASE_URL`; remove the hardcoded demo credentials from the login form's initial state; add 401/403 handling.
**Testing/CI**: add Vitest + Supertest to `backend/package.json`; add Vitest + React Testing Library to `frontend/package.json`; add `.github/workflows/ci.yml` running lint/test/build against the existing `docker-compose.yml` Postgres.

## Phase 2 — Risk Register & Project Reuse Maturity

**Prisma**: implement the `AssetRisk` and `Control`/`RiskControl` reshape via expand/backfill/contract migrations, *plus* the net-new `Project`/`ProjectAsset`/`ProjectRisk` models and `AIAsset.networkDependency` field from the "Project entity & reuse tracking" section above, all in one migration pass.
**API**: `POST/DELETE /assets/:assetId/risks/:riskId` (link/unlink); `GET /risks?assetId=` joins through `AssetRisk`; control routes become catalog CRUD (`GET /controls`) plus link CRUD (`POST/PUT/DELETE /risks/:riskId/controls/:controlId`); the full Project API surface (CRUD, link/unlink, merged risk view, reuse count, search, dashboard aggregates) described above.
**Frontend**: introduce React Router (pulled forward from Phase 5 — Project detail pages and the Dashboard both need real routes); split `frontend/src/App.tsx` into components (`RiskTable`, `AssetTable`, `RiskFilters`, `RiskHeatmap`, `AssetPicker`, `ProjectTable`, `ProjectDetail`); wire the backend's already-supported but UI-unused `status`/`type`/`hostingModel`/`sourceFramework`/`networkDependency` filters into real controls; add a likelihood×impact heatmap and bulk-select/bulk-status-update; ship a **minimal Dashboard** (`frontend/src/pages/Dashboard.tsx`) — search box, filter bar, reuse-count table, exposure table — backed by the new `/search` and `/dashboard/*` endpoints. Framework-coverage/risk-summary charts and integrations stay out of scope here; see Phase 5.

## Phase 3 — Governance workflow maturity

**Prisma**: extend `GovernanceWorkflow` with `stepIndex`/`requiredRole` for multi-step approval; add `RecertificationSchedule` (`assetId`, `cadenceDays`, `nextDueDate`); extend `AuditLog` (from Phase 1) to cover asset field edits, not just status.
**API**: policy-gate check in `POST /assets/:id/transition` blocking APPROVED/DEPLOYED while any linked `Risk.status === OPEN` above a severity threshold; `GET/POST /assets/:id/recertification`.
**Frontend**: approval UI showing pending-step/required-role and blocked-transition reasons; recertification due-date banner.

**Segregation of duties (documented requirement, enforcement deferred)**: the user who creates/edits a `Risk` should not also be the one who transitions it to `ACCEPTED`, and the person who moves an asset to `UNDER_REVIEW` should not be the same person who approves it to `APPROVED`. Not enforceable today — `Risk.owner` is a free-text string, not a `User` FK, so there's no identity to compare against. Enforcing this requires adding `Risk.createdById`/`ownerId` as a real `User` relation first, then checking `req.user.id !== risk.createdById` in the `ACCEPTED` transition and `req.user.id !== workflow.find(step => step.toStatus === "UNDER_REVIEW").approvedById` in the `APPROVED` transition. Out of scope until the user prioritizes it, but keep it here so it isn't silently dropped again.

## Phase 4 — AI-SBOM depth

**Prisma**: add `AssetDependency` self-relation join table (`parentAssetId`, `childAssetId`) so a SERVICE can declare which MODEL/DATASET assets compose it.
**API**: vendor the CycloneDX schema JSON on disk (`backend/vendor/cyclonedx-1.7.schema.json`); rewrite `validateCycloneDxBom` in `backend/src/cyclonedx.ts` to load from disk (no network call in the hot path); add `backend/src/spdx.ts` for SPDX export and `GET /assets/:id/export/spdx`; document the `aibom:*` CycloneDX property taxonomy properly instead of ad hoc names.
**Frontend**: dependency-graph view on the asset detail page; export-format picker (CycloneDX/SPDX).

## Phase 5 — Dashboards, reporting, integrations

**Prisma**: no new core models; optionally a `WebhookSubscription` model.
**API**: aggregate endpoints `GET /reports/framework-coverage`, `GET /reports/risk-summary`; `backend/src/integrations/{jira,servicenow,slack}.ts` webhook senders; SSO/OIDC login alongside `POST /auth/login`.
**Frontend**: *extend* the minimal `frontend/src/pages/Dashboard.tsx` shipped in Phase 2 (React Router is already in place by this point) with risk-by-framework charts and framework-coverage gap analysis, backed by the new report endpoints.

## Critical files

- `backend/prisma/schema.prisma`
- `backend/src/app.ts`
- `backend/src/auth.ts`
- `backend/src/cyclonedx.ts`
- `frontend/src/App.tsx`
- `aibom-governance-tool-spec - Copy.md` — original v1 spec; this roadmap supersedes/extends it for v2+.
