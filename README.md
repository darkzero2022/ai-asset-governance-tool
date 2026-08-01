# AI Asset Governance Tool

Standalone web application for maintaining a governed inventory of AI assets, tracking AI risks and controls, managing approval workflow, and exporting CycloneDX AI-BOM documents.

## Structure

- `backend/` - TypeScript, Express, Prisma API
- `frontend/` - React 19, Vite, Tailwind CSS UI
- `docker-compose.yml` - local PostgreSQL database

## Local Development

1. Copy `backend/.env.example` to `backend/.env`.
2. Start PostgreSQL with `docker compose up -d`.
3. Install dependencies in `backend/` and `frontend/`.
4. Run Prisma migration and seed from `backend/`.
5. Start backend and frontend dev servers.
