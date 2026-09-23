# Standalone SPA container (docker compose --profile standalone-frontend).
# Build context is the repo root so the @aibom/shared file: dependency resolves.

FROM node:25-alpine AS shared
WORKDIR /repo/packages/shared
COPY packages/shared/package*.json ./
RUN npm ci
COPY packages/shared/ ./
RUN npm run build

FROM node:25-alpine AS build
COPY --from=shared /repo/packages /repo/packages
WORKDIR /repo/frontend
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:25-alpine AS runtime
COPY --from=shared /repo/packages /repo/packages
WORKDIR /repo/frontend
ENV NODE_ENV=production
COPY frontend/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /repo/frontend/dist ./dist
# vite.config.ts is read by `vite preview` at runtime for preview.allowedHosts etc.
COPY --from=build /repo/frontend/vite.config.ts ./
EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
