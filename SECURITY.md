# Security Policy

## Reporting a vulnerability

Please report suspected security issues privately rather than opening a public issue.

- Open a [GitHub private security advisory](https://github.com/darkzero2022/ai-asset-governance-tool/security/advisories/new), or
- Contact the maintainer via the email on the GitHub profile.

Include a description, affected version/commit, reproduction steps, and impact. We aim
to acknowledge within a few business days.

## Known limitations (read before deploying)

This is evaluation/pilot-grade. The items below are **known and accepted for
now** — each links to its planned fix in [ROADMAP.md](ROADMAP.md). Deploy
accordingly (single-tenant, trusted operators, behind your own reverse proxy /
SSO where possible).

| Area | Current state | Planned fix |
|---|---|---|
| Session tokens | JWT in `localStorage` (readable by any injected script); no server-side revocation or "log out everywhere" | ROADMAP → *F1: httpOnly-cookie access token + `tokenVersion` revocation + CSRF* |
| Login hardening | IP-based rate limit on `POST /api/v1/auth/login` only; no per-account lockout, no password-strength policy, no MFA | ROADMAP → *F3: lockout + password policy + optional TOTP for admins* |
| Delete semantics | A few endpoints hard-delete; most archive | ROADMAP → *F4: archive-not-delete everywhere* |
| Evidence handling | Governance decisions / risks cannot attach evidence files | ROADMAP → *G2: audited attachment storage (local FS / S3)* |
| Scheduled jobs | Recertification notices run only via an external cron of `npm run notify:recertifications` | ROADMAP → *G3: in-process scheduler with job-run audit records* |
| Multi-tenancy | Single tenant; no org isolation | ROADMAP → *multi-tenancy* |
| URL import egress | `POST /api/v1/ai-systems/import-url` fetches user-supplied URLs; blocks loopback/private/link-local/CGNAT/cloud-metadata at DNS-resolve time, but a hostile domain can DNS-rebind in the validate→connect window | run the backend with network-level egress controls (egress proxy allowlist or NAT policy) — see [`docs/deployment.md`](docs/deployment.md) |

Set `TRUST_PROXY` when running behind a reverse proxy so rate-limiting and
`req.ip` key on the real client address.

## Supported versions

The `master` branch is the only supported version.
