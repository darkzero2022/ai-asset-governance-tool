FROM node:22-alpine AS build

WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npm run prisma:generate && npm run build

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
COPY package*.json ./
COPY prisma ./prisma
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node dist/server.js"]
