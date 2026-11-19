#!/usr/bin/env bash
#
# Author : Rajveer Sharma
# Date : 19 Nov 2026
# @ Nxtwave
#
# Starts the whole of NxtOne in one container (the root Dockerfile): the interactions API and the
# contest API on loopback, and the web app on $PORT, the only public port. The web app reaches the
# APIs at 127.0.0.1 with its signed identity tokens. An API that stops is started again after a
# pause (the site stays up; its pages say the service isn't connected meanwhile). If the web app
# stops, everything stops and the container exits, so the host restarts it.
#
# Settings (one environment, so each API's database URL has its own name):
#   WEB_DATABASE_URL           web_svc role
#   INTERACTIONS_DATABASE_URL  interactions_svc role
#   INTERACTIONS_JWT_SECRET    shared by the web app and the interactions API
#   CONTEST_DATABASE_URL       contest_svc role       (contest is skipped when unset)
#   CONTEST_JWT_SECRET         shared by the web app and the contest API
#   CONTEST_SECRET_KEY         the contest API's own key
#   CONTEST_WORKER=true        also run the LeetCode scan worker (exactly one copy, ever)
#   APP_BASE_URL, GOOGLE_*     as in platform/web/.env.example

set -uo pipefail

APP_DIR="${APP_DIR:-/app}"
INTERACTIONS_DIR="${INTERACTIONS_DIR:-/srv/interactions}"
CONTEST_DIR="${CONTEST_DIR:-/srv/contest}"
PY="${PYTHON:-python}"

pids=()
stop_all() {
  trap - TERM INT
  for pid in "${pids[@]}"; do kill -TERM "$pid" 2>/dev/null; done
}
trap 'stop_all; exit 0' TERM INT

# Runs a function in a subshell, and again whenever it stops, 10 s apart.
keep_running() {
  local name="$1" fn="$2" code
  while true; do
    ( "$fn" )
    code=$?
    echo "[start] $name stopped (exit $code); starting it again in 10 s"
    sleep 10
  done
}

# --- Interactions API (127.0.0.1:8090) ---
interactions_api() {
  cd "$INTERACTIONS_DIR" || exit 1
  DATABASE_URL="$INTERACTIONS_DATABASE_URL" IDENTITY_JWT_SECRET="$INTERACTIONS_JWT_SECRET" \
    MIGRATE_ON_START=true PORT=8090 HOST=127.0.0.1 exec node dist/server.js
}
if [ -n "${INTERACTIONS_DATABASE_URL:-}" ] && [ -n "${INTERACTIONS_JWT_SECRET:-}" ]; then
  keep_running "interactions API" interactions_api &
  pids+=($!)
  export INTERACTIONS_API_ORIGIN=http://127.0.0.1:8090
  echo "[start] interactions API on 127.0.0.1:8090"
else
  unset INTERACTIONS_API_ORIGIN
  echo "[start] interactions API skipped (INTERACTIONS_DATABASE_URL / INTERACTIONS_JWT_SECRET not set)"
fi

# --- Contest API (127.0.0.1:8000) and, optionally, its worker ---
export_contest() {
  export DATABASE_URL="$CONTEST_DATABASE_URL" IDENTITY_JWT_SECRET="$CONTEST_JWT_SECRET" \
    SECRET_KEY="${CONTEST_SECRET_KEY:?CONTEST_SECRET_KEY is required with the contest API}" \
    APP_ENV=production COOKIE_SECURE=true BIND=127.0.0.1:8000 FORWARDED_ALLOW_IPS=127.0.0.1 \
    WEB_CONCURRENCY="${CONTEST_WORKERS:-1}"
}
contest_api() {
  cd "$CONTEST_DIR" || exit 1
  export_contest
  "$PY" -m app.cli init-db && exec gunicorn -c gunicorn.conf.py 'app.api.app:create_app()'
}
contest_worker() {
  cd "$CONTEST_DIR" || exit 1
  export_contest
  exec "$PY" -m app.cli worker
}
if [ -n "${CONTEST_DATABASE_URL:-}" ] && [ -n "${CONTEST_JWT_SECRET:-}" ]; then
  keep_running "contest API" contest_api &
  pids+=($!)
  export CONTEST_API_ORIGIN=http://127.0.0.1:8000
  echo "[start] contest API on 127.0.0.1:8000"
  if [ "${CONTEST_WORKER:-false}" = "true" ]; then
    keep_running "contest worker" contest_worker &
    pids+=($!)
    echo "[start] contest worker running"
  fi
else
  unset CONTEST_API_ORIGIN
  echo "[start] contest API skipped (CONTEST_DATABASE_URL / CONTEST_JWT_SECRET not set)"
fi

# --- Web app (0.0.0.0:$PORT) ---
(
  cd "$APP_DIR" || exit 1
  NODE_ENV=production HOSTNAME=0.0.0.0 PORT="${PORT:-3000}" exec node platform/web/server.js
) &
web=$!
pids+=("$web")
echo "[start] web app on 0.0.0.0:${PORT:-3000}"

# The container lives as long as the web app does.
wait "$web"
code=$?
echo "[start] web app stopped (exit $code); stopping the rest"
stop_all
exit $(( code == 0 ? 1 : code ))
