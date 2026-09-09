# 01 - Getting Started

The full setup and install guide. For the one-paragraph version see the
[project README](../../README.md#quick-start).

There are three ways to run AI-BOM. Pick the row that matches you:

| Track                                                    | You get                                                                           | Needs                                                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **[Docker](#track-a--docker-recommended)** (recommended) | Whole stack in containers, app on one port, restarts itself                       | Docker Desktop / Docker Engine + `docker compose`                                                              |
| **[No-Docker local](#track-b--no-docker-local)**         | Backend + frontend on host Node, a _bundled_ PostgreSQL — nothing else to install | Node 22+ (setup installs it if missing). `setup.sh` on Linux/macOS/Git Bash, `setup.ps1` on Windows PowerShell |
| **[Linux server](#track-c--linux-server-always-on)**     | The Docker track plus a systemd unit so it survives reboots                       | A Linux host with Docker                                                                                       |

---

## Clone

```bash
git clone https://github.com/darkzero2022/ai-asset-governance-tool.git
cd ai-asset-governance-tool
```

## Configuration — one file

All configuration lives in a single **`.env`** at the repo root. `scripts/setup.sh`
creates it from [`.env.example`](../../.env.example) on first run and fills in a
random `JWT_SECRET` and `POSTGRES_PASSWORD`. In local mode it also derives a
`backend/.env` for the Prisma CLI. `.env` is gitignored — the generated secrets
never leave your machine.

Key settings: `DB_MODE` (`managed` / `docker` / `url`), `PORT` (default 4000),
`BIND_HOST` (default `127.0.0.1` — set `0.0.0.0` only behind a reverse proxy),
`APP_URL`, `LOG_LEVEL`.

### Custom ports

Three ports are configurable end to end — setup prompts for each (interactive),
or take a flag, and writes them to `.env`:

| `.env` key      | flag (`.sh` / `.ps1`)               | what                                    | default |
| --------------- | ----------------------------------- | --------------------------------------- | ------- |
| `PORT`          | `--port` / `-Port`                  | API + web app                           | 4000    |
| `DB_PORT`       | `--db-port` / `-DbPort`             | PostgreSQL host port (managed + docker) | 55432   |
| `FRONTEND_PORT` | `--frontend-port` / `-FrontendPort` | Vite dev server (local mode only)       | 5173    |

Each must be an integer 1024–65535 and the three must differ. `DATABASE_URL`,
`APP_URL`, `CORS_ORIGIN`, the Docker port mappings, and the start/stop/status
scripts all follow the values in `.env` — change them there and re-run
`scripts/start.*`, no other edits needed.

```bash
scripts/setup.sh --mode=local --data=demo --port=4200 --db-port=55440 --frontend-port=5200 --yes
```

## Data modes

- **empty** — reference data only (framework categories, EU AI Act tiers, the
  STRIDE-AI / MITRE ATLAS lookup) plus your admin account. For real data entry.
- **demo** — additionally loads a fictional portfolio (assets, risks, controls,
  projects, a filled-in Model Card, metrics, recertification schedules).

---

## Track A — Docker (recommended)

**Prerequisites:** Docker Desktop (macOS/Windows) or Docker Engine + the
`docker compose` plugin (Linux). `docker compose version` must work — if Docker
is missing, setup offers to install it (`winget` on Windows, `get.docker.com` on
Linux). You do **not** need Node for this track.

```bash
scripts/setup.sh --mode=docker --data=demo --yes          # Linux / macOS / Git Bash
scripts/start.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Mode docker -Data demo -Yes   # Windows
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

Setup builds the image (it bundles the frontend), starts Postgres, migrates,
seeds, and records your choices in `.aibom-mode`. The app is then at
**http://localhost:4000** — one container serves both the API and the web app.

Non-interactively you can supply the admin account:

```bash
scripts/setup.sh --mode=docker --data=demo \
  --admin-email=grc-admin@yourco.com --admin-password='choose-a-strong-one' --yes
```

Leave `--admin-password` off and the reference seed prints a random one.

**Always-on:** the containers use `restart: unless-stopped`. Set Docker Desktop to
start on login (Settings → General) and the app comes back after every reboot.

---

## Track B — No-Docker local

**Prerequisites:** Node 22+ and npm. No Docker, no system PostgreSQL, no
`openssl` — setup detects what's missing, offers to install it, and downloads a
bundled PostgreSQL to run for you.

**Linux / macOS / Git Bash:**

```bash
scripts/setup.sh --mode=local --database=managed --data=demo --yes
scripts/start.sh
```

**Windows (PowerShell — no Git Bash needed):**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Mode local -Database managed -Data demo -Yes
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

`--database=managed` (`-Database managed`) is the default for local mode. Setup
checks for **Node 22+** (and Docker, for docker mode); if something is missing it
prints the install command and — with `--install-deps` / `-InstallDeps`, or
`--yes` / `-Yes` — installs it automatically (a distro package manager or `nvm`
on Linux/macOS, `winget` on Windows). It then installs npm packages, starts the
bundled database (data under `data/pg/`, port 55432, localhost-only), migrates,
and seeds. `start.sh` / `start.ps1` runs the backend (`:4000`) and the Vite dev
server (`:5173`); open **http://localhost:5173**.

**Admin account:** an interactive run (no `--yes`) always finishes with a working
login — it prompts for email, display name, and a password (**≥ 12 characters,
not a common/breached one** — the same policy the app enforces). Pass
`--admin-email` / `--admin-name` / `--admin-password` (`-AdminEmail` /
`-AdminName` / `-AdminPassword`) to set them non-interactively. With `--yes` and
no `--admin-password`, a strong random one is generated and printed. To skip
seeding an admin and use the app's first-run screen instead, pass
`--admin-defer` / `-AdminDefer`.

Other database choices for local mode:

```bash
scripts/setup.sh --mode=local --database=docker --yes   # PostgreSQL in a container
scripts/setup.sh --mode=local --database=url --yes       # set DATABASE_URL in .env first
```

**Windows without Git Bash and without PowerShell** (rare): use Track A (Docker)
or the [manual steps](#manual-setup-no-scripts).

---

## Track C — Linux server (always-on)

Do the Docker track, then keep it running across reboots with systemd. Bind to
localhost and put a TLS-terminating reverse proxy in front — see
[deployment.md](../deployment.md) for a ready-to-use Caddy config.

```ini
# /etc/systemd/system/aibom.service
[Unit]
Description=AI Asset Governance Tool
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/ai-asset-governance-tool
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now aibom.service
```

`scripts/install-service.sh --systemd` prints a unit like this filled in for your
paths. For a non-Docker Linux install it prints one that runs `serve-prod.sh`
(the built app on one port); `scripts/install-service.sh` with no flag sets up
pm2 instead and works on macOS/Windows too.

---

## Day-to-day scripts

Every `.sh` script below has a `.ps1` twin for Windows PowerShell
(`setup.ps1`, `start.ps1`, `stop.ps1`); the rest run from Git Bash / WSL.

| Script                                            | Does                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `scripts/setup.sh` / `scripts/setup.ps1`          | Check/install deps, write `.env`, install packages, migrate, seed, create the admin               |
| `scripts/start.sh` / `scripts/stop.sh` (`.ps1`)   | Start / stop everything for the recorded mode                                                     |
| `scripts/status.sh`                               | Mode, versions, what's running, migration status, `/health`                                       |
| `scripts/upgrade.sh`                              | `git pull` → reinstall → migrate → rebuild → restart (refuses a dirty tree; backs up first)       |
| `scripts/reset.sh`                                | Drop all data and re-seed (asks for confirmation unless `--yes`)                                  |
| `scripts/install-service.sh`                      | Run on boot — pm2 (any OS) or `--systemd` (Linux). Docker mode: prints the "start on login" steps |
| `scripts/serve-prod.sh`                           | Run the built app in production locally (DB + API + SPA on `$PORT`, no dev servers)               |
| `scripts/backup.sh` / `scripts/restore.sh <file>` | `pg_dump` to `backups/` / restore one                                                             |

Re-running `scripts/setup.sh` is safe and idempotent — it never overwrites an
existing secret or an admin password you changed in the UI (pass
`--admin-password` again to reset it).

---

## Manual setup (no scripts)

Same steps by hand, for Windows without WSL/Git Bash.

### Docker, by hand

```bash
# PowerShell: use $env:NAME = "..." for each export
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
export JWT_SECRET=$(openssl rand -hex 32)
printf 'POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\n' "$POSTGRES_PASSWORD" "$JWT_SECRET" > .env

docker compose build backend
docker compose up -d postgres
docker compose run --rm backend npx prisma migrate deploy
docker compose run --rm -e ADMIN_EMAIL=admin@example.com backend npm run prisma:seed:reference
docker compose run --rm -e ADMIN_EMAIL=admin@example.com backend npm run prisma:seed:demo   # optional
docker compose up -d
# app: http://localhost:4000
```

### Local, by hand

```bash
cp .env.example .env
# edit .env: set JWT_SECRET (openssl rand -hex 32), POSTGRES_PASSWORD, and
# DATABASE_URL=postgresql://aibom:<POSTGRES_PASSWORD>@127.0.0.1:55432/aibom?schema=public
cp .env backend/.env

cd backend
npm install
npm run prisma:generate
npm run db:start                 # bundled PostgreSQL   (or: docker compose up -d postgres)
npx prisma migrate deploy
ADMIN_EMAIL=admin@example.com npm run prisma:seed:reference
npm run prisma:seed:demo         # optional
npm run dev &                    # backend :4000
cd ../frontend && npm install && npm run dev    # frontend :5173
```

## Verify

```bash
curl http://localhost:4000/health          # {"status":"ok"} — liveness (process up)
curl http://localhost:4000/ready           # {"status":"ready", ...} — DB + migrations OK (503 if not)
# CI-equivalent, from a clean checkout:
cd backend  && npm test && npm run build && npm run validate:cyclonedx
cd ../frontend && npm test && npm run build
```

## First login

- **If setup created an admin** (any interactive run, or `--admin-password`, or
  `--yes`): sign in with the email on the final `Admin login:` line and that
  password.
- **If you passed `--admin-defer`**: the first time you open the app it shows a
  **"Create your administrator account"** screen. Fill it in — that account
  becomes the first ADMIN and you're signed straight in.

Either way, add the rest of your users on the **Users** page. Lost the admin
password? Re-run setup with the same `--admin-email` and a new `--admin-password`.

## Troubleshooting

| Symptom                                                          | Fix                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Port 4000 is in use` from setup                                 | Re-run with `--port=<n>` / `-Port <n>` (or set `PORT` in `.env`). Setup checks this before changing anything.                        |
| Port 5173 / 55432 in use                                         | Re-run with `--frontend-port=<n>` / `--db-port=<n>` (`-FrontendPort` / `-DbPort`), or for the DB switch to `--database=url`.         |
| `POSTGRES_PASSWORD is required` from `docker compose`            | Run `scripts/setup.sh` — it generates `.env`. For manual runs, create `.env` with `POSTGRES_PASSWORD` and `JWT_SECRET`.              |
| Requests fail with "Failed to fetch" after a manual/custom setup | The SPA and API must share an origin. Only set `VITE_API_BASE_URL` / `CORS_ORIGIN` if you deliberately split them.                   |
| Managed database won't start                                     | Needs the optional `embedded-postgres` binaries — re-run `npm install` in `backend/`, or use `--database=docker` / `--database=url`. |
| `vite preview` returns 403 behind a proxy                        | Set `VITE_ALLOWED_HOSTS` (comma-separated) before it starts.                                                                         |
| Demo seed: "record not found" for the admin                      | The demo seed needs the same `ADMIN_EMAIL` the reference seed used.                                                                  |
