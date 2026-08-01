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
- Optional backend config includes `CORS_ORIGIN`, `SLACK_WEBHOOK_URL`, `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, and `OIDC_POST_LOGIN_REDIRECT_URL`.
- Frontend config should provide `VITE_API_BASE_URL` at build time.

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
