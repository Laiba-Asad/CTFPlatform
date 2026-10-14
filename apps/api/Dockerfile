# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml)
#
# DB_PROVIDER selects which Prisma client is generated: sqlite (default) or
# postgresql. It must match the runtime DATABASE_URL. No credentials are baked
# into the image; a placeholder URL is used only to pick the schema.

FROM node:24-alpine AS build
ARG DB_PROVIDER=sqlite
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @cydemic/api --include-workspace-root=false --ignore-scripts \
  && npm rebuild better-sqlite3
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN cd apps/api \
  && if [ "$DB_PROVIDER" = "postgresql" ]; then export DATABASE_URL=postgresql://build:build@localhost:5432/build; else export DATABASE_URL=file:/tmp/build.db; fi \
  && npx prisma generate && npx tsup

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @cydemic/api --include-workspace-root=false --omit=dev --ignore-scripts \
  && npm rebuild better-sqlite3 \
  && npm cache clean --force
# Built server + scripts, Prisma schema/migrations/config (for `migrate deploy`), seed data
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/src/db-url.ts apps/api/src/
COPY seed seed

# Persistent data (SQLite file when not using PostgreSQL)
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:4000/healthz || exit 1
# Apply pending migrations, then start. Seeding is manual:
#   docker compose exec api node dist/seed.js
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
