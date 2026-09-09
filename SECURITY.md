# Security Policy

## Reporting a vulnerability

Please report suspected security issues privately rather than opening a public issue.

- Open a [GitHub private security advisory](https://github.com/darkzero2022/ai-asset-governance-tool/security/advisories/new), or
- Contact the maintainer via the email on the GitHub profile.

Include a description, affected version/commit, reproduction steps, and impact. We aim
to acknowledge within a few business days.

## Authentication (as of the auth-hardening change)

- **Access tokens** are short-lived (15 min) JWTs held **in memory** by the SPA —
  never in `localStorage`. A hard reload restores the session by trading the
  **httpOnly `refresh_token` cookie** (`SameSite=Strict`, path-scoped to
  `/api/v1/auth`, `Secure` in production) for a new access token; refresh tokens
  are stored **hashed** and **rotated** on every use.
- **Revocation** is real: every access token carries a `tokenVersion`; changing
  your password, "log out of all devices", an admin password reset, or an admin
  deactivation bumps it and rejects every outstanding token (`TOKEN_STALE`).
  Per-session revocation is available on the Account page.
- **Login hardening**: per-account lockout (15 min after 8 failed attempts) on
  top of the per-IP rate limit; a password policy (≥ 12 chars, not on a
  common/breached deny-list) enforced in the shared `zod` schema; a self-service
  change-password screen; an admin "force password change on next login" flag.
- API scripts / CI can still authenticate with an `Authorization: Bearer` header.

## Known limitations (read before deploying)

This is evaluation/pilot-grade. The items below are **known and accepted for
now** — each links to its planned fix in [ROADMAP.md](ROADMAP.md). Deploy
accordingly (single-tenant, trusted operators, behind your own reverse proxy /
SSO where possible).

| Area | Current state | Planned fix |
|---|---|---|
| MFA | No TOTP / 2FA yet | ROADMAP → *F3 remainder: optional TOTP for admins* |
| Delete semantics | A few endpoints hard-delete; most archive | ROADMAP → *F4: archive-not-delete everywhere* |
| Evidence handling | Governance decisions / risks cannot attach evidence files | ROADMAP → *G2: audited attachment storage (local FS / S3)* |
| Scheduled jobs | Recertification notices run only via an external cron of `npm run notify:recertifications` | ROADMAP → *G3: in-process scheduler with job-run audit records* |
| Multi-tenancy | Single tenant; no org isolation | ROADMAP → *multi-tenancy* |
| URL import egress | `POST /api/v1/ai-systems/import-url` fetches user-supplied URLs; blocks loopback/private/link-local/CGNAT/cloud-metadata at DNS-resolve time, but a hostile domain can DNS-rebind in the validate→connect window | run the backend with network-level egress controls (egress proxy allowlist or NAT policy) — see [`docs/deployment.md`](docs/deployment.md) |

Set `TRUST_PROXY` when running behind a reverse proxy so rate-limiting and
`req.ip` key on the real client address. When the SPA is served from a different
origin than the API, set `CORS_ORIGIN` to that exact origin (credentialed
requests require it) and terminate TLS at the proxy so the `Secure` refresh
cookie is honoured.

## Supported versions

The `master` branch is the only supported version.
