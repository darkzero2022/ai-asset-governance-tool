# 01 - Getting Started

This is the full setup and install guide. For a one-paragraph version see the
[project README](../../README.md#quick-start).

## Prerequisites

| Tool | Needed for | Notes |
|---|---|---|
| **Docker Engine + Docker Compose v2** | Both install modes | Docker Desktop on macOS/Windows, or Docker Engine + the `docker compose` plugin on Linux. `docker compose version` must work. |
| **Git** | Cloning the repo | — |
| **Node.js 22+ and npm** | *Local* install mode only | Not needed for Docker mode. Check with `node -v`. |
| **Bash** | Running `scripts/*.sh` | Pre-installed on macOS/Linux. On Windows use **WSL** or **Git Bash**, or follow the [Manual setup](#manual-setup-no-scripts) commands instead. |
| `openssl` | `scripts/setup.sh` (JWT secret) | Present on macOS/Linux and in Git Bash. |

Ports used on the host: **5173** (frontend), **4000** (backend), **55432** (Postgres).
Make sure they are free, or see [Troubleshooting](#troubleshooting).

## Clone

```bash
git clone https://github.com/darkzero2022/ai-asset-governance-tool.git
cd ai-asset-governance-tool
```

## Install modes

**Local mode** runs the backend and frontend directly with host Node/npm, while
PostgreSQL runs in Docker. Use it for active development, file watching, and
debugging.

**Docker mode** runs Postgres, backend, and frontend all in Docker Compose. Use it
for a repeatable, self-contained stack with nothing to manage on the host after
setup.

## Data modes

**Empty** seeds only reference data (framework categories, EU AI Act tiers, the
STRIDE-AI / MITRE ATLAS lookup, and your admin account). Choose this for real
evaluation or production data entry.

**Demo** additionally loads a fictional portfolio — assets, risks, controls,
projects, a filled-in Model Card, metrics, and recertification schedules — so you
can explore the UI without typing anything in.

## Setup (recommended)

Run interactive setup from the repository root:

```bash
scripts/setup.sh
```

It prompts for:

1. **Install mode** — `local` or `docker`
2. **Data mode** — `empty` or `demo`
3. **Admin email** — the login for the first admin account (default `admin@example.com`)
4. **Admin password** — typed twice, hidden; leave blank to generate a strong random
   one and print it. The password is used for that run only and is never written to disk.

Non-interactive: pass what you want, add `--yes` for the rest.

```bash
# Local, empty data, default admin (random password printed at the end)
scripts/setup.sh --mode=local --data=empty --yes

# Docker, demo data, your own admin credentials
scripts/setup.sh --mode=docker --data=demo \
  --admin-email=grc-admin@yourco.com --admin-password='choose-a-strong-one' --yes
```

Setup checks prerequisites, creates `backend/.env` from `backend/.env.example` if
missing, generates a strong `JWT_SECRET`, installs dependencies or builds
containers, runs `prisma migrate deploy`, seeds the chosen data set with your admin
account, and writes `.aibom-mode` so `start.sh` / `stop.sh` know what to run.

Re-running setup is safe and idempotent. It will **not** overwrite an admin
password you later changed in the UI unless you pass `--admin-password` again — and
that doubles as a password reset.

`scripts/setup.sh --help` lists every flag.

## Start and stop

```bash
scripts/start.sh   # reads .aibom-mode; prints the URLs once the backend is healthy
scripts/stop.sh
```

Local mode writes backend/frontend logs and PID files under `logs/`. Docker mode
delegates to `docker compose`.

## Manual setup (no scripts)

If you can't run the bash scripts (e.g. Windows without WSL/Git Bash), do the same
steps by hand.

### Docker mode, by hand

```bash
# 1. A strong JWT secret for docker compose to interpolate
export JWT_SECRET=$(openssl rand -hex 32)        # PowerShell: $env:JWT_SECRET = "<64 hex chars>"

# 2. Build and start the database
docker compose build backend frontend
docker compose up -d postgres

# 3. Migrate and seed (choose your admin credentials here)
docker compose run --rm -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD='choose-a-strong-one' \
  backend npx prisma migrate deploy
docker compose run --rm -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD='choose-a-strong-one' \
  backend npm run prisma:seed:reference
# optional demo data:
docker compose run --rm -e ADMIN_EMAIL=admin@example.com backend npm run prisma:seed:demo

# 4. Bring up the full stack
docker compose up -d
```

### Local mode, by hand

```bash
cp backend/.env.example backend/.env
# edit backend/.env: set JWT_SECRET to `openssl rand -hex 32`

docker compose up -d postgres

cd backend
npm install
npm run prisma:generate
npx prisma migrate deploy
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='choose-a-strong-one' npm run prisma:seed:reference
npm run prisma:seed:demo          # optional demo data
npm run dev &                     # backend on :4000
cd ../frontend
npm install
npm run dev                       # frontend on :5173
```

If you leave `ADMIN_PASSWORD` unset, the reference seed generates a random password
and prints it in a boxed message — copy it from that output.

## Verify

- Backend health: `curl http://localhost:4000/health` → `{"status":"ok"}`
- Frontend: open `http://localhost:5173`
- CI-equivalent checks (from a clean checkout):
  ```bash
  cd backend  && npm test && npm run build && npm run validate:cyclonedx
  cd ../frontend && npm test && npm run build
  ```

## First login

Open `http://localhost:5173` and sign in with the admin account from setup:

- **Email** — what you entered (default `admin@example.com`); setup echoes it on the
  final `Admin login:` line.
- **Password** — what you entered, or the random one printed during setup if you
  left it blank.

Change this password on the **Users** page before entering real governance data.
Lost it? Re-run setup with the same `--admin-email` and a new `--admin-password`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `port is already allocated` (5173 / 4000 / 55432) | Stop whatever holds the port, or change the mapping in `docker-compose.yml` (and `VITE_API_BASE_URL` / `CORS_ORIGIN` to match). |
| Frontend loads but every request fails with "Failed to fetch" | CORS: the browser origin isn't in `CORS_ORIGIN`. Set it (comma-separated) to the URL you're opening the app at and recreate the backend. |
| `vite preview` returns 403 behind a proxy or a custom hostname | Set `VITE_ALLOWED_HOSTS` (comma-separated hostnames) on the frontend before it starts. |
| Seed fails with "record not found" for the admin | The demo seed needs the same `ADMIN_EMAIL` the reference seed used — pass it to both. |
| `docker compose` can't interpolate `JWT_SECRET` | Export it in your shell (or put it in `backend/.env` and let `start.sh` load it) before running compose. |
| Migrations don't apply on first backend start | The backend container runs `prisma migrate deploy` on boot; check `docker compose logs backend`. |
