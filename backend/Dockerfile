# Build context is the repo root (see docker-compose.yml) so this image can build
# the shared package + the SPA and serve everything from the API process.
# The /repo/{packages,backend,frontend} layout is preserved through every stage
# so the `file:` symlink to @aibom/shared keeps resolving.

# --- Shared package ---
FROM node:22-alpine AS shared
WORKDIR /repo/packages/shared
COPY packages/shared/package*.json ./
RUN npm ci
COPY packages/shared/ ./
RUN npm run build

# --- Frontend build ---
FROM node:22-alpine AS frontend
COPY --from=shared /repo/packages /repo/packages
WORKDIR /repo/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Empty base URL: the SPA calls the API on its own origin (the backend serves it).
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# --- Backend build ---
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
COPY --from=shared /repo/packages /repo/packages
WORKDIR /repo/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run prisma:generate && npm run build

# --- Runtime ---
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
# Carry the fully installed dependency tree (incl. the generated Prisma client, the
# prisma CLI used by `migrate deploy`, tsx used by the seed scripts) from the build
# stage rather than reinstalling. Keep the /repo layout so @aibom/shared resolves.
COPY --from=build /repo/packages /repo/packages
WORKDIR /repo/backend
COPY --from=build /repo/backend/node_modules ./node_modules
COPY --from=build /repo/backend/dist ./dist
COPY backend/package*.json ./
COPY backend/prisma ./prisma
COPY --from=frontend /repo/frontend/dist /repo/frontend/dist
ENV NODE_ENV=production
ENV SERVE_STATIC=true
ENV FRONTEND_DIST=/repo/frontend/dist
# Documentation only — the app listens on $PORT (default 4000); compose publishes it.
ARG PORT=4000
EXPOSE ${PORT}
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node dist/server.js"]
