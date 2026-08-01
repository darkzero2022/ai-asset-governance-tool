# AI Asset Governance Tool — Build Specification

## 1. Overview

A standalone web application for security/GRC teams to maintain a governed inventory
of AI assets (models, datasets, AI-powered services) used across an organization,
assess and track risk against each asset, map governance controls to recognized
frameworks, and export CycloneDX-compliant AI-BOM documents.

This is **not** a codebase scanner. Data is entered through GRC-style intake forms
by the security/GRC team, not auto-discovered from source code.

**Primary user:** Security/GRC team members (single org, small number of users).

## 2. Tech Stack

- Backend: TypeScript + Express
- ORM: Prisma
- Database: PostgreSQL
- Frontend: React 19 + Tailwind CSS
- Auth: Simple session/JWT-based login, single organization, small user count
  (no multi-tenant complexity needed for v1)

## 3. Core Data Model

### AIAsset (the AI-BOM entry)
CycloneDX AI-BOM aligned fields:
- `name`, `version`, `type` (model / dataset / service / library)
- `supplier` / `provider` (e.g. OpenAI, Anthropic, self-hosted, HuggingFace)
- `hostingModel` (SaaS API / self-hosted / embedded in app)
- `license`
- `dataClassificationTouched` (e.g. PII, financial, confidential — free text/enum)
- `trainingDataProvenance` (free text description)
- `downstreamConsumers` (which internal systems/apps use this asset)
- `status`: `Draft` → `Under Review` → `Approved` → `Deployed` → `Retired`
- `createdBy`, `createdAt`, `updatedAt`

Relationships: one `AIAsset` has many `Risk` and many `GovernanceWorkflow` entries.

### Risk
- linked to one `AIAsset`
- `sourceFramework`: enum — `NIST_AI_RMF` / `EU_AI_ACT` / `OWASP_LLM_TOP10`
- `sourceCategoryId`: the specific category/control ID within that framework
  (e.g. an OWASP LLM Top 10 item like "LLM01: Prompt Injection")
- `euAiActRiskTier`: enum — `Unacceptable` / `High` / `Limited` / `Minimal`
  (populated when `sourceFramework` includes EU AI Act relevance)
- `description`
- `likelihood` (1–5), `impact` (1–5)
- `inherentRiskScore` (calculated: likelihood × impact)
- `residualRiskScore` (post-mitigation, manually adjustable)
- `treatmentPlan` (free text)
- `owner`, `dueDate`, `status` (`Open` / `In Progress` / `Mitigated` / `Accepted`)

### Control
- linked to one `Risk` (a risk can have multiple mitigating controls)
- `mappedFramework` + `mappedControlId` (NIST AI RMF function, EU AI Act obligation, etc.)
- `implementationStatus`: `Not Started` / `In Progress` / `Implemented` / `Verified`
- `evidenceNotes` (free text, for audit trail)

### GovernanceWorkflow
- linked to one `AIAsset`
- records each status transition: `fromStatus`, `toStatus`, `approvedBy`, `timestamp`, `comments`
- effectively an approval audit trail for the asset's lifecycle

## 4. Framework Reference Data

Seed the database with static reference tables (not user-editable in v1) for:
- **NIST AI RMF** categories (Govern, Map, Measure, Manage functions and their sub-categories)
- **EU AI Act** risk tiers (Unacceptable / High / Limited / Minimal) with brief definitions
- **OWASP LLM Top 10 (2025)** categories with IDs and short descriptions

These populate dropdowns when a user links a `Risk` to a framework category —
no free-typing of framework categories.

## 5. Key Screens (v1 MVP)

1. **AI Asset List** — table view of all AI assets, filterable by status/type/hosting model
2. **AI Asset Detail / Intake Form** — create/edit an asset; CycloneDX-aligned fields;
   shows linked risks and workflow history inline
3. **Risk Register** — table view across all risks, filterable by framework/status/score;
   can also be viewed scoped to a single asset
4. **Risk Detail Form** — create/edit a risk, link to an asset, select framework category
   from seeded reference data, set scores, add controls
5. **Governance / Approval view** — shows an asset's current status and lets an
   authorized user transition it through the workflow (Draft → ... → Retired), logging
   the transition
6. **CycloneDX Export** — from the Asset List or Asset Detail, export one or more
   assets as a CycloneDX AI-BOM-compliant JSON file

## 6. Explicit Non-Goals for v1

- No codebase/repo scanning or auto-discovery
- No multi-tenant / multi-org support
- No analytics dashboards or executive reporting (v2)
- No integration with external GRC platforms (v2 — potential future Riscover tie-in)
- No editable framework reference data via UI (seed via migration/script only)

## 7. CycloneDX Compliance Note

Output JSON must validate against the current CycloneDX AI-BOM (ML-BOM) schema.
Claude Code should pull the official CycloneDX schema (from the CycloneDX
specification repository) as the source of truth for field names/structure rather
than inferring it, and validate exported documents against it.
