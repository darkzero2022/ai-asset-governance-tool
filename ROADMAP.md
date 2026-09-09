# Roadmap

What's planned, roughly in priority order. Not dated — this is an open-source
project, not a product with a release train. Issues and PRs against any of these
are welcome; comment on the tracking issue first for the larger ones.

Done recently: monorepo shared types, `/api/v1` + generated OpenAPI, react-router
+ TanStack Query, RBAC UI gating, the Wazuh-style UI redesign, "AI Systems"
rename, modal-based creation, MITRE ATLAS mitigation mapping, **OWASP MCP Top 10 +
cross-framework crosswalk + framework versioning**, Linux/Windows setup scripts
with dependency auto-install.

## Security & auth hardening

- **F1 — Session tokens.** Move the access token to a short-lived `httpOnly;
  Secure; SameSite` cookie + a rotating refresh token; embed `tokenVersion` in the
  JWT and bump it on password change / deactivation / "log out everywhere"; add
  CSRF protection for cookie-auth mutations. *Why: a JWT in `localStorage` is
  readable by any injected script and cannot be revoked.*
- **F3 — Login hardening.** Per-account lockout / exponential backoff on top of
  the existing IP rate limit; a password-strength policy in the `zod` schema and
  the UI; a self-service "change my password" screen; admin "force reset" flag;
  optional TOTP for `ADMIN` behind `MFA_ENABLED`. *Why: table stakes for a
  security tool.*
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
  governance decision or a risk. *Why: GRC teams live on evidence.*
- **G3 — Real job scheduler.** An in-process scheduler (`ENABLE_SCHEDULER`,
  default on for a single instance) for recertification notices, stale-approval
  reminders, and optional backup triggers; every run writes a job-run audit
  record. Replaces the "run this cron yourself" step.
- Dated framework mappings beyond the current `FrameworkMeta.revision` — per-row
  `effectiveDate` so an assessment can pin the exact mapping version it used.

## Observability & ops

- Structured request/response metrics + a `/metrics` endpoint (Prometheus text).
- Health check that also verifies DB connectivity and pending-migration state.
- A production-grade `docker-compose.prod.yml` (or a small Helm chart) separate
  from the dev compose file, with the reverse-proxy / TLS termination wired in.

## Testing & CI/CD

- Playwright end-to-end suite run against the Docker stack in CI: bootstrap →
  login → create AI system → add risk (framework auto-fill) → link to project →
  submit for approval → approve as a second user → export + validate CycloneDX.
- Lint + format gates (ESLint + Prettier) in CI.
- Supply-chain scanning (`npm audit` gate once the pre-existing advisories are
  cleared; dependency review action) and a self-SBOM of this repo published on
  each tagged release.
- Tagged releases with a changelog and a container image published to GHCR.

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
