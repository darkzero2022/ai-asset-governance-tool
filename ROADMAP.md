# Roadmap

What's planned, roughly in priority order. Not dated — this is an open-source
project, not a product with a release train. Issues and PRs against any of these
are welcome; comment on the tracking issue first for the larger ones.

Done recently: monorepo shared types, `/api/v1` + generated OpenAPI, react-router

- TanStack Query, RBAC UI gating, the Wazuh-style UI redesign, "AI Systems"
  rename, modal-based creation, MITRE ATLAS mitigation mapping, **OWASP MCP Top 10 +
  cross-framework crosswalk + framework versioning**, Linux/Windows setup scripts
  with dependency auto-install, **auth hardening (F1 + F3 core)** — in-memory access
  token + httpOnly rotating refresh cookie + `tokenVersion` revocation + a `Session`
  table + per-account lockout + a password policy + self-service change-password +
  admin force-reset.

## Security & auth hardening

- **F3 — TOTP / 2FA (remainder).** Optional time-based OTP for `ADMIN` accounts
  behind `MFA_ENABLED`: enrollment (QR + secret), recovery codes, a second step
  on login. _The rest of F3 (lockout, password policy, change-password,
  force-reset) shipped._
- **F2 — RBAC meta-test.** A test that asserts every mutating route has an
  explicit `requireRole` and matches the documented permission matrix, so the
  matrix can't silently drift.
- **F4 — Archive-not-delete everywhere.** Replace the remaining hard-deletes with
  an `archived` flag + filter, so nothing an auditor might need disappears.

## Data model & integrity

- **G2 — Evidence / attachment storage.** A storage interface (`put` / `get` /
  `delete` / `signedUrl`) with a local-filesystem driver (default) and an
  S3-compatible driver, size-capped and content-type-allowlisted, audited, served
  only with `Content-Disposition: attachment`. Attach a PDF sign-off to a
  governance decision or a risk. _Why: GRC teams live on evidence._
- **G3 — Real job scheduler.** An in-process scheduler (`ENABLE_SCHEDULER`,
  default on for a single instance) for recertification notices, stale-approval
  reminders, and optional backup triggers; every run writes a job-run audit
  record. Replaces the "run this cron yourself" step.
- Dated framework mappings beyond the current `FrameworkMeta.revision` — per-row
  `effectiveDate` so an assessment can pin the exact mapping version it used.

## Observability & ops

- Structured request/response metrics + a `/metrics` endpoint (Prometheus text).
- Health check that also verifies DB connectivity and pending-migration state.
- Wire the reverse-proxy / TLS termination into `docker-compose.prod.yml` (a
  Caddy sidecar), or ship a small Helm chart.
- Refresh `docs/screenshots/` — the current set pre-dates the UI redesign and the
  "Assets → AI Systems" rename (capture script in `docs/screenshots/README.md`).

## Testing & CI/CD

- Playwright end-to-end suite run against the Docker stack in CI: bootstrap →
  login → create AI system → add risk (framework auto-fill) → link to project →
  submit for approval → approve as a second user → export + validate CycloneDX.
- ~~Lint + format gates (ESLint + Prettier) in CI.~~ — **done** (`c36200c`).
- ~~Supply-chain scanning (`npm audit` gate…)~~ — **done**: production `npm audit`
  gate + Dependabot in CI (`e29efc3`).
  - **CodeQL** — workflow committed, but code scanning needs a **public repo or
    GitHub Advanced Security**. The `analyze` job self-skips while the repo is
    private without GHAS and auto-activates when it goes public.
  - **Secret scanning + push protection** — same gate (GHAS / public repo). Not
    available on this private repo today.
  - Still to add: a `dependency-review` action on PRs (also GHAS-gated for
    private repos).
- ~~Self-SBOM + tagged releases + GHCR image~~ — **done** (`v0.1.0`, `e29efc3` +
  the release): GitHub Release with CycloneDX SBOMs +
  `ghcr.io/darkzero2022/ai-asset-governance-tool` with provenance/SBOM
  attestations. `CHANGELOG.md` maintained.

## Framework coverage

- OWASP MCP Top 10 → track it to v1.0 when OWASP releases it (bump
  `FrameworkMeta`, flip `status` to `RELEASED`, revise categories/mappings).
- MITRE ATLAS → refresh the technique/mitigation catalogues from the published
  matrix on a schedule; add the `AML.T####` / `AML.M####` IDs alongside the names.
- OWASP AI Exchange, ISO/IEC 42001, and NIST AI 600-1 (Generative AI Profile) as
  additional `SourceFramework` options with crosswalks.
- A "framework coverage matrix" dashboard view (every category × how many risks)
  and a per-risk "also tag the related category" action off the crosswalk.

## Integrations

- Importers: CSV / JSON bulk import for AI systems and risks; pull model metadata
  from a model registry.
- Outbound: Jira / ServiceNow ticket creation from a risk; SIEM (webhook / syslog)
  for audit events; richer Slack notifications.
- SSO: the OIDC flow exists — document and test it against common IdPs; SCIM for
  user provisioning.
- Multi-tenancy: org scoping on every entity + a tenant admin role, so one
  deployment can serve multiple teams.
