# 01 - Getting Started

## Install Modes

AI-BOM supports two install modes.

Local mode runs the backend and frontend directly with host Node/npm, while PostgreSQL runs in Docker through the existing compose service. Use this when you want fast local development, direct file watching, and easy debugging.

Docker mode runs Postgres, backend, and frontend in Docker Compose. Use this when you want a repeatable application stack and do not want to manage host Node processes after setup.

## Data Modes

Setup can create either an empty operational instance or a demo instance.

Empty mode runs only reference data: framework categories, EU AI Act tiers, and the default admin user. This is the right choice for real evaluation data.

Demo mode also loads fictional assets, risks, controls, projects, Model Cards, metrics, and recertification schedules. Use it to learn the UI or run demos without entering data manually.

## Setup

Run interactive setup from the repository root:

```bash
scripts/setup.sh
```

For non-interactive setup:

```bash
scripts/setup.sh --mode=local --data=empty --yes
scripts/setup.sh --mode=docker --data=demo --yes
```

Setup checks required tools, creates `backend/.env` from `backend/.env.example` if missing, generates a strong `JWT_SECRET`, installs dependencies or builds containers, applies Prisma migrations, seeds the selected data set, and writes `.aibom-mode` so start/stop know what to run.

## Start And Stop

Start services:

```bash
scripts/start.sh
```

Stop services:

```bash
scripts/stop.sh
```

Local mode writes backend/frontend logs and PID files under `logs/`. Docker mode delegates to Docker Compose.

## First Login

After setup, open `http://localhost:5173` and sign in with:

- Email: `admin@example.com`
- Password: `admin123`

Change this password before entering real governance data.
