# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from `0.1.0`.

## [Unreleased]

First tagged release is being prepared. Everything below is the state of `master`
since the project became a standalone tool.

### Added

- **One-origin serving** — the backend serves the built SPA and the API on a
  single port (`SERVE_STATIC`), with an `Accept`-negotiated SPA fallback.
- **No-Docker install path** — bundled PostgreSQL via `pg_ctl`
  (`npm run db:start|stop|status`); `DB_MODE=managed|docker|url`.
- **Guided setup** — `scripts/setup.sh` and a Windows-native `scripts/setup.ps1`:
  OS/mode-aware dependency detection and install, preflight checks, a first-run
  admin, and (new) configurable `PORT` / `DB_PORT` / `FRONTEND_PORT` threaded
  through `.env`, `docker-compose.yml`, the Dockerfile, Vite, and every helper
  script.
- **Operations scripts** — `start` / `stop` / `status` / `upgrade` / `reset` /
  `serve-prod` / `install-service` (pm2 or systemd) / mode-aware
  `backup` + `restore`.
- **`@aibom/shared`** — one source of truth for `zod` schemas and API types,
  consumed by both backend and frontend.
- **Typed API client** on the frontend; **`/api/v1`** prefix with a generated
  **OpenAPI 3.0** document and Swagger UI (`ENABLE_API_DOCS`).
- **react-router** data router, **TanStack Query** per-domain hooks, and RBAC UI
  gating that mirrors the backend role matrix.
- **Audit trail** — a Prisma client extension records every mutation to a core
  entity; domain `audit()` events supersede the automatic row.
- **Optimistic concurrency** on updates (`updatedAt` / `editBaseVersion` →
  `409 STALE_WRITE`).
- **Structured logging** (pino) with per-request context and `X-Request-Id`.
- **Framework coverage** — NIST AI RMF, EU AI Act, OWASP LLM Top 10, and
  **OWASP MCP Top 10**, each with a recorded revision and DRAFT/RELEASED status
  (`FrameworkMeta`); category-to-STRIDE-AI / MITRE ATLAS technique + mitigation
  mappings; a **cross-framework crosswalk** (MCP ↔ LLM ↔ NIST) with rationale,
  surfaced on the risk detail view and in the CycloneDX export.
- **Session hardening** — hybrid token model (short-lived in-memory access token
  + rotating httpOnly refresh cookie), `tokenVersion` revocation, per-account
  lockout, a ≥ 12-character / breached-password policy, self-service
  change-password, and admin force-reset.
- **UI redesign** — Wazuh-style shell; "Assets" renamed to **AI Systems**
  (route `/ai-systems`, API `/api/v1/ai-systems`); modal-based creation for
  AI Systems, Risks, and Projects.
- **Open-source project files** — `LICENSE` (MIT), `NOTICE`, `ATTRIBUTION.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, `ROADMAP.md`, issue/PR templates,
  `CONTRIBUTING.md`.
- **CI** — build + test on Node 22 with an ephemeral PostgreSQL, a
  backup/restore round-trip, a production `npm audit` gate, CodeQL, a DCO check,
  and Dependabot.

### Security

- Removed the hard-coded JWT secret fallback; `JWT_SECRET` is now required.
- Every growable list / export endpoint is bounded (`MAX_LIST_ROWS` /
  `MAX_EXPORT_ROWS`).
- Cleared all production `npm audit` advisories (pinned `qs` ≥ 6.16.0).

[Unreleased]: https://github.com/darkzero2022/ai-asset-governance-tool/commits/master
