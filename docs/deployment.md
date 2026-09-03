# Deployment Notes

This project is still optimized for local evaluation, but a real deployment should separate build, runtime, database, and secret management concerns.

## Services

- Backend: build with `npm run build` in `backend/`, then run `node dist/server.js`.
- Frontend: build with `npm run build` in `frontend/`, then serve the static `frontend/dist/` assets from a web server or object storage/CDN.
- Database: use managed PostgreSQL or a production PostgreSQL cluster. Do not use the local `docker-compose.yml` database for production data.

## Containers

- Backend container should install production dependencies, run `npm run build`, and start `node dist/server.js`.
- Frontend container should build static assets and serve them with a minimal HTTP server such as nginx.
- Run the backend and frontend as separate deployable services so API scaling and static asset caching can be managed independently.

## Secrets

- Store `DATABASE_URL`, `JWT_SECRET`, OIDC client secrets, and webhook URLs in a secrets manager or platform secret store.
- Do not bake `.env` files into images.
- Required backend secrets/config include `DATABASE_URL` and `JWT_SECRET`.
- Optional backend config includes `CORS_ORIGIN`, `TRUST_PROXY`, `SLACK_WEBHOOK_URL`, `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, and `OIDC_POST_LOGIN_REDIRECT_URL`.
- `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` (seed-time only, read by `prisma:seed:reference`): the initial admin account. `scripts/setup.sh` prompts for the email and password; pass `--admin-email` / `--admin-password` (or set the env vars) to seed non-interactively. `ADMIN_EMAIL` defaults to `admin@example.com`; a blank `ADMIN_PASSWORD` on a fresh DB generates a random password and prints it once. Setting `ADMIN_PASSWORD` on a later run resets it (recovery). Changing `ADMIN_EMAIL` on a later run creates an additional admin rather than renaming the existing one.
- Frontend config should provide `VITE_API_BASE_URL` at build time.

## Serving model

Since the enhancement plan's A1, the backend serves the built SPA itself when
`SERVE_STATIC` is set (default on under `NODE_ENV=production`), so a single
`node dist/server.js` process — and a single container — is the whole app on one
port. The standalone `frontend` container in `docker-compose.yml` is now behind
the `standalone-frontend` profile for deployments that still want to serve the
SPA separately. `FRONTEND_DIST` overrides where the backend looks for the build.

## Reverse proxy (TLS)

Bind the app to localhost (`BIND_HOST=127.0.0.1`, the default) and terminate TLS
at a proxy. A complete Caddy config:

```
app.example.com {
    reverse_proxy 127.0.0.1:4000
}
```

nginx equivalent:

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;
    # ssl_certificate / ssl_certificate_key ...
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then set `APP_URL=https://app.example.com`, `CORS_ORIGIN=https://app.example.com`,
and `TRUST_PROXY=1` in `.env`.

## Network & Security Hardening

- **Reverse proxy**: terminate TLS at a proxy/ingress and set the backend `TRUST_PROXY`
  env var (`1` for a single hop, or a subnet) so login rate-limiting and `req.ip`
  key on the real client address rather than the proxy's.
- **Security headers**: the API sets `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, a restrictive `Content-Security-Policy`, and (when
  `NODE_ENV=production`) HSTS. The proxy serving the frontend should send an
  equivalent header set for the SPA.
- **URL import egress**: `POST /assets/import-url` and `/assets/:id/import-url` fetch
  arbitrary user-supplied URLs. The app blocks loopback/private/link-local/CGNAT and
  cloud-metadata addresses at DNS-resolve time, but a hostile domain can still rebind
  DNS in the window between validation and connection. Run the backend with
  network-level egress controls in production — an egress proxy allowlist or a NAT/
  security-group policy that denies the backend access to link-local (`169.254.0.0/16`),
  RFC1918, and CGNAT ranges.
- **Token storage**: the SPA stores its JWT in `localStorage`, which is readable by
  any injected script. Keep the frontend's dependency surface minimal and its CSP
  strict; consider moving to an httpOnly cookie + CSRF token if the threat model
  warrants it.

## Database Migrations

- CI/CD should run `prisma migrate deploy` against the target database before starting the new backend version.
- Do not run `prisma migrate dev` in production.
- Schema changes that touch non-empty existing tables should continue to use expand/backfill/contract migrations with checked-in backfill scripts.

## Jobs

- Run `npm run notify:recertifications` from an external scheduler such as cron, a platform scheduled job, or a CI scheduler.
- Keep scheduled jobs outside the web process; this app does not use an in-process scheduler.

## Operational Checks

- Health endpoint: `GET /health`.
- Verify CycloneDX export validation in CI with `npm run validate:cyclonedx`.
- Run backend tests and frontend tests/builds before deployment.
