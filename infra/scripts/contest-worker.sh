#!/usr/bin/env bash
#
# Author : Rajveer Sharma
# Date : 26 Nov 2026
# @ Nxtwave
#
# Runs the LeetCode scan worker against the production database, on the laptop that does the
# scanning (LeetCode blocks most cloud servers without a proxy, so the worker doesn't run on Render).
#
#   infra/scripts/contest-worker.sh           Windows: infra\scripts\contest-worker.cmd
#
# It scans each contest after it ends, makes the final scan later, and picks up rescans the super
# admin requests in NxtOne (Contests › a contest › Rescan). Run exactly one copy; Ctrl+C stops it.
# Settings: infra/prod/contest-worker.env (git-ignored; DATABASE_URL as contest_svc). Its
# settings replace any in modules/contest/backend/.env.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${CONTEST_WORKER_ENV:-$ROOT/infra/prod/contest-worker.env}"
BACKEND="$ROOT/modules/contest/backend"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE: it needs DATABASE_URL (the contest_svc connection to the production database)." >&2
  exit 1
fi
if [ -x "$BACKEND/.venv/Scripts/python.exe" ]; then
  PY="$BACKEND/.venv/Scripts/python.exe"
elif [ -x "$BACKEND/.venv/bin/python" ]; then
  PY="$BACKEND/.venv/bin/python"
else
  echo "The contest service's Python environment isn't installed. Run infra/scripts/start.sh --install-only first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
case "${DATABASE_URL:-}" in
  postgresql://*) ;;
  *) echo "DATABASE_URL in $ENV_FILE must be the production Postgres connection." >&2; exit 1 ;;
esac

cd "$BACKEND"
echo "Contest worker: $(sed -E 's#://([^:]*):[^@]*@#://\1:***@#' <<<"$DATABASE_URL")"
exec "$PY" -m app.cli worker "$@"
