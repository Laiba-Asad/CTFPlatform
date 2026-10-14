# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml)

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @cydemic/web --include-workspace-root=false
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# Only VITE_* variables are compiled into the bundle; never pass secrets here.
ARG VITE_POLL_INTERVAL_MS=12000
ENV VITE_POLL_INTERVAL_MS=$VITE_POLL_INTERVAL_MS
RUN npm run build -w @cydemic/web

FROM caddy:2-alpine
COPY deploy/web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 8080
