# syntax=docker/dockerfile:1
#
# Author : Rajveer Sharma
# Date : 19 Nov 2026
# @ Nxtwave
#
# The NxtOne web app as one container (Next.js standalone server on :3000).
# Build from the REPO ROOT: the module frontends (modules/*/frontend) live outside this folder.
#
#   docker build -f platform/web/Dockerfile -t nxtone-web .
#   docker run --env-file infra/prod/web.env -p 3000:3000 nxtone-web
#
# No secrets at build time: every setting (WEB_DATABASE_URL, Google, service origins and secrets)
# is read when the server starts. See platform/web/.env.example for the list.

# --- 1. Dependencies (one npm workspace: the web app + the module frontends) ---
FROM node:24-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY platform/web/package.json platform/web/
COPY modules/attendance/frontend/package.json modules/attendance/frontend/
COPY modules/contest/frontend/package.json modules/contest/frontend/
COPY modules/interactions/frontend/package.json modules/interactions/frontend/
RUN npm ci

# --- 2. Production build ---
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npm run build

# --- 3. Runtime: only the traced server files, static assets and public/ ---
FROM node:24-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/platform/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/platform/web/.next/static ./platform/web/.next/static
COPY --from=build --chown=node:node /repo/platform/web/public ./platform/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "platform/web/server.js"]
