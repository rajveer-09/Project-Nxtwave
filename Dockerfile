# syntax=docker/dockerfile:1
#
# Author : Rajveer Sharma
# Date : 19 Nov 2026
# @ Nxtwave
#
# All of NxtOne in ONE container, for hosts that run a single service (e.g. one Render web
# service): the web app on $PORT plus the interactions and contest APIs on loopback, started by
# infra/container/start-all.sh (its header lists the settings).
#
#   docker build -t nxtone .
#   docker run --env-file infra/prod/all-in-one.env -p 3000:3000 nxtone
#
# To run each part as its own service instead: platform/web/Dockerfile, each module backend's
# Dockerfile, and infra/docker-compose.prod.yml.

# --- Web app: Next.js standalone build (one npm workspace with the module frontends) ---
FROM node:24-bookworm-slim AS web
WORKDIR /repo
COPY package.json package-lock.json ./
COPY platform/web/package.json platform/web/
COPY modules/attendance/frontend/package.json modules/attendance/frontend/
COPY modules/contest/frontend/package.json modules/contest/frontend/
COPY modules/interactions/frontend/package.json modules/interactions/frontend/
RUN npm ci
COPY platform/web platform/web
COPY modules/attendance/frontend modules/attendance/frontend
COPY modules/contest/frontend modules/contest/frontend
COPY modules/interactions/frontend modules/interactions/frontend
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npm run build

# --- Interactions API: compiled TypeScript ---
FROM node:24-bookworm-slim AS interactions
WORKDIR /srv/interactions
COPY modules/interactions/backend/package.json modules/interactions/backend/package-lock.json ./
RUN npm ci
COPY modules/interactions/backend/tsconfig.json ./
COPY modules/interactions/backend/src ./src
RUN npm run build && npm prune --omit=dev

# --- Runtime: Python 3.12 (contest API) with Node 24 copied in (web app, interactions API) ---
FROM node:24-bookworm-slim AS node
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN node --version

# Contest API (editable install: migrations and alembic.ini are found next to the package)
WORKDIR /srv/contest
COPY modules/contest/backend/pyproject.toml modules/contest/backend/alembic.ini modules/contest/backend/gunicorn.conf.py ./
COPY modules/contest/backend/app ./app
COPY modules/contest/backend/migrations ./migrations
RUN pip install --no-cache-dir -e ".[prod]"

# Interactions API
WORKDIR /srv/interactions
COPY --from=interactions /srv/interactions/node_modules ./node_modules
COPY --from=interactions /srv/interactions/dist ./dist
COPY modules/interactions/backend/package.json ./
COPY modules/interactions/backend/db ./db

# Web app
WORKDIR /app
COPY --from=web /repo/platform/web/.next/standalone ./
COPY --from=web /repo/platform/web/.next/static ./platform/web/.next/static
COPY --from=web /repo/platform/web/public ./platform/web/public

COPY infra/container/start-all.sh /usr/local/bin/start-all
RUN sed -i 's/\r$//' /usr/local/bin/start-all && chmod +x /usr/local/bin/start-all \
 && useradd --system --uid 10001 --home-dir /app nxtone && chown -R nxtone /srv/contest
USER nxtone
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/login').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["start-all"]
