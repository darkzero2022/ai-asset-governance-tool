# Build context is the repo root (see docker-compose.yml) so this image can bundle
# the built SPA and serve it from the API process — one container, one port.

# --- Frontend build ---
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Empty base URL: the SPA calls the API on its own origin (the backend serves it).
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# --- Backend build ---
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run prisma:generate && npm run build

# --- Runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
# Carry the fully installed dependency tree (incl. the generated Prisma client, the
# prisma CLI used by `migrate deploy`, and tsx used by the seed scripts) from the
# build stage rather than reinstalling — a NODE_ENV=production `npm ci` here would
# drop the devDependencies that `prisma migrate deploy` and `npm run prisma:seed*`
# both need.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY backend/package*.json ./
COPY backend/prisma ./prisma
COPY --from=frontend /fe/dist ./frontend/dist
ENV NODE_ENV=production
ENV SERVE_STATIC=true
ENV FRONTEND_DIST=/app/frontend/dist
EXPOSE 4000
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node dist/server.js"]
