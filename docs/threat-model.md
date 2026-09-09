# Threat model — AI Asset Governance Tool

Scope: the application itself (backend API, SPA, database, setup/ops scripts),
**not** the AI systems it catalogues. Last reviewed against `master` on
2026-09-09. Revisit on any change to authentication, the request pipeline, the
export surface, or the deployment story.

Methodology: STRIDE per element over the data-flow diagram below, then a
mitigation table. This is a living document — gaps are tracked in
[ROADMAP.md](../ROADMAP.md) and [SECURITY.md](../SECURITY.md).

## System overview

Single deployable: one Node process serves the REST API under `/api/v1` and the
built React SPA on the same origin (`SERVE_STATIC=true`). State lives in one
PostgreSQL database (bundled, container, or external). No multi-tenancy — one
deployment is one organisation.

### Data-flow diagram

```
                          trust boundary: the browser
   ┌───────────────────────────────────────────────────────────┐
   │  Operator browser (SPA)                                    │
   │   - access token in JS memory only (never localStorage)    │
   │   - httpOnly refresh cookie, Path=/api/v1/auth             │
   └───────────────┬───────────────────────────────────────────┘
                   │ HTTPS (TLS terminated at the reverse proxy)
                   ▼
        trust boundary: the reverse proxy / network edge
   ┌───────────────────────────────────────────────────────────┐
   │  Reverse proxy (operator-supplied: Caddy / nginx)          │
   │   - TLS, HSTS, forwards X-Forwarded-* (TRUST_PROXY)        │
   └───────────────┬───────────────────────────────────────────┘
                   │ HTTP on the loopback / compose network
                   ▼
        trust boundary: the application process
   ┌───────────────────────────────────────────────────────────┐
   │  Express app                                              │
   │   helmet · CORS allow-list · rate limits · requestId      │
   │   requireAuth (JWT: memory token OR access cookie)        │
   │   requireRole(...) per mutating route                     │
   │   zod validation on every body · central error envelope  │
   │   Prisma audit extension → AuditLog                       │
   │   static SPA (Accept-negotiated fallback, CSP)           │
   └───────┬───────────────────────────────┬──────────────────┘
           │ Prisma (parameterised SQL)    │ export builders
           ▼                               ▼
   ┌────────────────────┐         CycloneDX / CSV / JSON documents
   │  PostgreSQL        │         (bounded row counts)
   │   users, assets,   │
   │   risks, projects, │
   │   sessions,        │
   │   audit log,       │
   │   framework ref.   │
   └────────────────────┘
```

### Assets worth protecting

| Asset                                                                  | Why                                                                               |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Operator credentials + sessions                                        | account takeover → full read/write of the governance record                       |
| The governance record (assets, risks, controls, evidence, model cards) | integrity: it is the organisation's audit trail; tampering undermines its purpose |
| `JWT_SECRET`                                                           | forge any token                                                                   |
| `DATABASE_URL` / `POSTGRES_PASSWORD`                                   | direct database access                                                            |
| The audit log                                                          | must be append-only in practice; its loss hides an incident                       |
| Availability of the API                                                | it is a system-of-record for compliance work                                      |

### Trusted vs untrusted

- **Trusted:** the host OS, the operator-supplied reverse proxy, the database, the
  `JWT_SECRET`, environment variables, framework reference data shipped in the repo.
- **Untrusted:** every HTTP request body / query / header, uploaded content,
  anything a non-ADMIN authenticated user sends, the public network.
- **Out of scope:** a malicious ADMIN (they are the trust root), host compromise,
  physical access, supply-chain compromise of a pinned dependency (mitigated, not
  eliminated, by the audit gate + Dependabot + CodeQL).

## STRIDE by element

### Operator ↔ Express (the request pipeline)

| Threat                     | Vector                                              | Mitigation                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S**poofing               | stolen/guessed credentials; token replay            | bcrypt password hashes; ≥ 12-char + breached-list password policy; per-account lockout (8 fails → 15 min, `423`); login rate limit; short-lived (15 min) access token; refresh token rotated + SHA-256 hashed in the `Session` table; `tokenVersion` in the JWT — bumped by change-password / logout-all / admin reset invalidates every outstanding token |
| **T**ampering              | modified request body; parameter injection          | `zod` schema on every body (shared with the client); Prisma parameterises all SQL; optimistic concurrency (`updatedAt` / `editBaseVersion` → `409 STALE_WRITE`) stops silent overwrite                                                                                                                                                                     |
| **R**epudiation            | "I didn't change that"                              | Prisma `$allOperations` extension writes an `AuditLog` row for every mutation to an audited model; domain `audit()` events add actor + before/after; `X-Request-Id` correlates logs                                                                                                                                                                        |
| **I**nformation disclosure | verbose errors; over-broad reads; CORS              | central error envelope (`{ error: { code, message }, requestId }`) — no stack traces to the client; `CORS_ORIGIN` allow-list (no `*`); helmet security headers + a SPA CSP; access token never in `localStorage`; refresh cookie `httpOnly` + `SameSite=Strict` + `Secure` (prod) + `Path=/api/v1/auth`                                                    |
| **D**enial of service      | unbounded list/export; login flooding; large bodies | `MAX_LIST_ROWS` / `MAX_EXPORT_ROWS` caps; `assetIds` capped at 500; `express.json` body-size limit; global + per-route rate limits; `LOGIN_RATE_LIMIT`                                                                                                                                                                                                     |
| **E**levation of privilege | calling a mutating route without the role           | `requireRole(...)` on every mutating route (not just `requireAuth`); the RBAC matrix is introspectable via the generated OpenAPI doc; the SPA gates UI the same way but the server is authoritative; first-run bootstrap is disabled once any user exists                                                                                                  |

### Express ↔ PostgreSQL

| Threat                              | Mitigation                                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T**ampering / **I**nfo disclosure | Prisma parameterised queries only — no string-built SQL; `DATABASE_URL` from the environment, never logged; DB not published on the host in the prod compose overlay |
| **D**enial of service               | connection pool bounds; bounded result sets; `pg` statement timeouts inherited from the server config                                                                |
| **R**epudiation                     | `AuditLog` rows are only ever inserted by the app; no route exposes update/delete on them                                                                            |

### Operator browser (the SPA)

| Threat           | Mitigation                                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **XSS**          | React escapes by default; no `dangerouslySetInnerHTML`; CSP restricts script sources; the access token is unreachable to injected script only insofar as it is a module-scoped variable (a successful XSS still forfeits the session — XSS prevention is the real control) |
| **CSRF**         | state-changing calls need the `Authorization` header or the access cookie **plus** the refresh flow requires a custom `X-Requested-With` header (not settable cross-origin without CORS); refresh cookie is `SameSite=Strict`                                              |
| **Clickjacking** | `X-Frame-Options` / frame-ancestors via helmet                                                                                                                                                                                                                             |

### Setup / ops scripts

| Threat              | Mitigation                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weak secrets        | `setup.sh` / `setup.ps1` generate `JWT_SECRET` and `POSTGRES_PASSWORD` with a CSPRNG; `.env` is gitignored                                         |
| Weak admin password | interactive setup requires ≥ 12 chars; `seed-reference.ts` validates `ADMIN_PASSWORD` against the shared policy and exits non-zero on a weak value |
| Accidental exposure | `BIND_HOST` defaults to `127.0.0.1`; docs require a reverse proxy before `0.0.0.0`                                                                 |
| Backup handling     | `backup.sh` writes to `backups/` (gitignored); operators are responsible for encryption at rest of those dumps — documented in SECURITY.md         |

## Residual risk / known gaps

Tracked in [ROADMAP.md](../ROADMAP.md):

- **No 2FA/TOTP yet** — password + lockout is the only auth factor.
- **No field-level encryption** — evidence and model-card content sit in the clear
  in PostgreSQL; rely on disk / DB encryption.
- **Audit log is not cryptographically chained** — an attacker with direct DB
  write access can alter history undetected.
- **Single-tenant** — no data partitioning between business units.
- **Supply chain** — mitigated by the `npm audit` gate, Dependabot, and CodeQL,
  not eliminated.
- **No automated DAST / pen-test** in CI.

## Verifying the mitigations

The test suites exercise the security-relevant paths directly:
`backend/src/authHardening.test.ts` (lockout, token rotation, `X-Requested-With`,
session revocation, password policy), `backend/src/integration.test.ts` (RBAC
matrix, bounded exports), `frontend/src/api/client.test.ts` (silent refresh only
on refreshable 401s). CI additionally runs the production `npm audit` gate,
CodeQL, and a backup/restore round-trip.
