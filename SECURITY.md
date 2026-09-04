# Security Policy

## Reporting a vulnerability

Please report suspected security issues privately rather than opening a public issue.

- Open a [GitHub private security advisory](https://github.com/darkzero2022/ai-asset-governance-tool/security/advisories/new), or
- Contact the maintainer via the email on the GitHub profile.

Include a description, affected version/commit, reproduction steps, and impact. We aim
to acknowledge within a few business days.

## Scope notes

This is an evaluation/pilot-grade project. Known hardening items are tracked in
[`docs/deployment.md`](docs/deployment.md), including:

- The SPA stores its JWT in `localStorage`.
- `POST /api/v1/assets/import-url` fetches user-supplied URLs; it filters private/loopback/
  link-local/CGNAT/metadata addresses at DNS-resolve time but should be run with
  network-level egress controls in production.
- Rate limiting is applied to `POST /api/v1/auth/login` only; set `TRUST_PROXY` behind a proxy.

## Supported versions

The `master` branch is the only supported version.
