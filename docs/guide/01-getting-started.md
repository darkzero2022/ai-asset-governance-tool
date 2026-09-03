# 01 - Getting Started

The full setup and install guide. For the one-paragraph version see the
[project README](../../README.md#quick-start).

There are three ways to run AI-BOM. Pick the row that matches you:

| Track | You get | Needs |
|---|---|---|
| **[Docker](#track-a--docker-recommended)** (recommended) | Whole stack in containers, app on one port, restarts itself | Docker Desktop / Docker Engine + `docker compose` |
| **[No-Docker local](#track-b--no-docker-local)** | Backend + frontend on host Node, a *bundled* PostgreSQL — nothing else to install | Node 22+, Bash (WSL or Git Bash on Windows) |
| **[Linux server](#track-c--linux-server-always-on)** | The Docker track plus a systemd unit so it survives reboots | A Linux host with Docker |

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

## Data modes

- **empty** — reference data only (framework categories, EU AI Act tiers, the
  STRIDE-AI / MITRE ATLAS lookup) plus your admin account. For real data entry.
- **demo** — additionally loads a fictional portfolio (assets, risks, controls,
  projects, a filled-in Model Card, metrics, recertification schedules).

---

## Track A — Docker (recommended)

**Prerequisites:** Docker Desktop (macOS/Windows) or Docker Engine + the
`docker compose` plugin (Linux); Bash for the scripts (Git Bash on Windows).
`docker compose version` must work. You do **not** need Node.

```bash
scripts/setup.sh --mode=docker --data=demo --yes
scripts/start.sh
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

**Prerequisites:** Node 22+ and npm; Bash (WSL2 or Git Bash on Windows);
`openssl`. No Docker, no system PostgreSQL — setup downloads and runs a bundled
PostgreSQL for you.

```bash
scripts/setup.sh --mode=local --database=managed --data=demo --yes
scripts/start.sh
```

`--database=managed` is the default when `--mode=local`. Setup installs
dependencies, starts the bundled database (data under `data/pg/`, port 55432,
bound to localhost), migrates, and seeds. `start.sh` then runs the backend
(`:4000`) and the Vite dev server (`:5173`); open **http://localhost:5173**.

Other database choices for local mode:

```bash
scripts/setup.sh --mode=local --database=docker --yes   # PostgreSQL in a container
scripts/setup.sh --mode=local --database=url --yes       # set DATABASE_URL in .env first
```

**Windows:** run the scripts from **WSL2** or **Git Bash**. Plain PowerShell/CMD
can't run `.sh` files — use Track A instead, or the [manual steps](#manual-setup-no-scripts).

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

---

## Day-to-day scripts

| Script | Does |
|---|---|
| `scripts/start.sh` / `scripts/stop.sh` | Start / stop everything for the recorded mode |
| `scripts/status.sh` | Mode, versions, what's running, migration status, `/health` |
| `scripts/upgrade.sh` | `git pull` → reinstall → migrate → rebuild → restart (refuses a dirty tree; backs up first) |
| `scripts/reset.sh` | Drop all data and re-seed (asks for confirmation unless `--yes`) |
| `scripts/backup.sh` / `scripts/restore.sh <file>` | `pg_dump` to `backups/` / restore one |

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
curl http://localhost:4000/health          # {"status":"ok"}
# CI-equivalent, from a clean checkout:
cd backend  && npm test && npm run build && npm run validate:cyclonedx
cd ../frontend && npm test && npm run build
```

## First login

- **If setup created an admin** (you passed `--admin-password`, or chose `--data=demo`):
  sign in with the email on the final `Admin login:` line and that password.
- **Otherwise** (empty data, no password given): the first time you open the app it
  shows a **"Create your administrator account"** screen. Fill it in — that account
  becomes the first ADMIN and you're signed straight in.

Either way, add the rest of your users on the **Users** page. Lost the admin
password? Re-run setup with the same `--admin-email` and a new `--admin-password`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Port 4000 is in use` from setup | Stop the other process, or set `PORT` in `.env`. Setup checks this before changing anything. |
| Port 5173 / 55432 in use | Local dev uses 5173; the database uses 55432. Free them or (55432) switch to `--database=url`. |
| `POSTGRES_PASSWORD is required` from `docker compose` | Run `scripts/setup.sh` — it generates `.env`. For manual runs, create `.env` with `POSTGRES_PASSWORD` and `JWT_SECRET`. |
| Requests fail with "Failed to fetch" after a manual/custom setup | The SPA and API must share an origin. Only set `VITE_API_BASE_URL` / `CORS_ORIGIN` if you deliberately split them. |
| Managed database won't start | Needs the optional `embedded-postgres` binaries — re-run `npm install` in `backend/`, or use `--database=docker` / `--database=url`. |
| `vite preview` returns 403 behind a proxy | Set `VITE_ALLOWED_HOSTS` (comma-separated) before it starts. |
| Demo seed: "record not found" for the admin | The demo seed needs the same `ADMIN_EMAIL` the reference seed used. |
