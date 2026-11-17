#!/usr/bin/env bash
#
# Author : Rajveer Sharma
# Date : 17 Nov 2026
# @ Nxtwave
#
# Starts the whole of NxtOne.
#
#   infra/scripts/start.sh                  Docker if it's running, otherwise local mode
#   infra/scripts/start.sh --docker         everything in Docker (Postgres + all services + web)
#   infra/scripts/start.sh --local          without Docker: the web app, plus every service whose
#                                     tools and .env file are present (see below)
#   infra/scripts/start.sh --worker         also start the LeetCode scan worker
#   infra/scripts/start.sh --prod           local mode with the web app built for production: fast
#                                     page loads and pre-loading (dev mode compiles each page on
#                                     first visit and doesn't pre-load links); no live reload
#   infra/scripts/start.sh --install-only   install dependencies and exit (used by infra/scripts/clone.sh)
#
# Local mode needs a database for the services, so each one starts only when its .env exists:
#   modules/interactions/backend/.env   (Node 24+)
#   modules/contest/backend/.env            (Python 3.12+)
#   modules/attendance/backend/.env     (Go)
# Copy the .env.example next to each one. The web app always starts; it reads platform/web/.env.local
# and runs on sample data until that file points it at a database and the services.
#
# Windows: run infra\scripts\start.cmd from PowerShell or cmd (it uses the Git Bash that comes with Git).
# Ctrl+C stops everything.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE=auto
WORKER=0
INSTALL_ONLY=0
PROD=0

usage() { sed -n '7,27p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

for arg in "$@"; do
  case "$arg" in
    --docker) MODE=docker ;;
    --local) MODE=local ;;
    --worker) WORKER=1 ;;
    --install-only) INSTALL_ONLY=1 ;;
    --prod) PROD=1; MODE=local ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
skip() { printf '\033[33m  skip\033[0m %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

# First Python that is really 3.12+ (Windows' "python3" can be a Microsoft Store stub).
find_python() {
  local candidate
  for candidate in python3 python; do
    if have "$candidate" && "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 12))' >/dev/null 2>&1; then
      echo "$candidate"; return 0
    fi
  done
  return 1
}

venv_python() {
  local dir="$1"
  if [ -x "$dir/.venv/bin/python" ]; then echo "$dir/.venv/bin/python"; else echo "$dir/.venv/Scripts/python.exe"; fi
}

docker_ready() { have docker && docker compose version >/dev/null 2>&1 && docker info >/dev/null 2>&1; }

# ---------------------------------------------------------------- dependencies

install_node_app() {
  local dir="$1" name="$2"
  if [ ! -d "$dir/node_modules" ]; then
    bold "Installing $name dependencies"
    (cd "$dir" && npm ci --no-audit --no-fund)
  fi
}

install_contest() {
  local dir="$ROOT/modules/contest/backend" python
  python="$(find_python)" || return 1
  if [ ! -d "$dir/.venv" ]; then
    bold "Creating the contest service's Python environment"
    "$python" -m venv "$dir/.venv"
    "$(venv_python "$dir")" -m pip install --quiet --disable-pip-version-check -e "$dir"
  fi
}

install_all() {
  if ! have node || [ "$(node_major)" -lt 20 ]; then
    echo "Node.js 20+ is required for the web app (24+ for the interactions service). https://nodejs.org" >&2
    exit 1
  fi
  # One npm workspace at the root: the web app (platform/web) and the module frontends.
  install_node_app "$ROOT" "web app"
  if [ "$(node_major)" -ge 24 ]; then install_node_app "$ROOT/modules/interactions/backend" "interactions service"
  else skip "interactions-api: needs Node 24+ (found $(node -v))"; fi
  install_contest || skip "contest: needs Python 3.12+"
  if have go; then (cd "$ROOT/modules/attendance/backend" && go mod download)
  else skip "attendance-api: needs Go (https://go.dev/dl)"; fi
}

if [ "$INSTALL_ONLY" = 1 ]; then
  install_all
  bold "Dependencies installed."
  exit 0
fi

# ---------------------------------------------------------------- docker mode

if [ "$MODE" = auto ]; then
  if docker_ready; then MODE=docker; else MODE=local; fi
fi

if [ "$MODE" = docker ]; then
  docker_ready || { echo "Docker isn't running. Start Docker Desktop, or use --local." >&2; exit 1; }
  bold "Starting everything in Docker"
  note "web http://localhost:3000 | interactions :8090 | attendance :8080 | contest :8000 | Postgres :5433"
  cd "$ROOT"
  if [ "$WORKER" = 1 ]; then exec docker compose -f infra/docker-compose.yml --profile worker up --build; fi
  exec docker compose -f infra/docker-compose.yml up --build
fi

# ---------------------------------------------------------------- local mode

install_all

PIDS=()
COLORS=(36 35 32 34 33)

# run NAME DIR COMMAND... : runs in the background with every output line prefixed by [NAME]
run() {
  local name="$1" dir="$2"; shift 2
  local color="${COLORS[${#PIDS[@]} % ${#COLORS[@]}]}"
  ( cd "$dir" && exec "$@" ) > >(while IFS= read -r line; do printf '\033[%sm[%s]\033[0m %s\n' "$color" "$name" "$line"; done) 2>&1 &
  PIDS+=("$!")
}

stop_all() {
  trap - EXIT INT TERM
  echo
  bold "Stopping"
  local pid
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do
    # Git Bash on Windows: kill the whole native process tree (node, next, python…)
    if [ -r "/proc/$pid/winpid" ] && have taskkill; then
      taskkill //F //T //PID "$(cat "/proc/$pid/winpid")" >/dev/null 2>&1 || true
    fi
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap stop_all EXIT INT TERM

bold "Starting NxtOne locally"

if [ "$PROD" = 1 ]; then
  bold "Building the web app for production (about a minute)"
  (cd "$ROOT/platform/web" && NEXT_TELEMETRY_DISABLED=1 npm run build) || { echo "Build failed." >&2; exit 1; }
  run web "$ROOT/platform/web" npx next start -p 3000
  note "web               http://localhost:3000  (production build)"
else
  run web "$ROOT/platform/web" npm run dev
  note "web               http://localhost:3000  (dev mode: slower first loads; use --prod for full speed)"
fi

if [ -f "$ROOT/modules/interactions/backend/.env" ] && [ "$(node_major)" -ge 24 ]; then
  run interactions "$ROOT/modules/interactions/backend" npm run dev
  note "interactions-api  http://localhost:8090"
else
  skip "interactions-api: add modules/interactions/backend/.env (copy .env.example)"
fi

if [ -f "$ROOT/modules/contest/backend/.env" ] && [ -d "$ROOT/modules/contest/backend/.venv" ]; then
  CONTEST_PY="$(venv_python "$ROOT/modules/contest/backend")"
  run contest "$ROOT/modules/contest/backend" "$CONTEST_PY" -m app.cli serve --port 8000
  note "contest API       http://localhost:8000"
  if [ "$WORKER" = 1 ]; then
    run worker "$ROOT/modules/contest/backend" "$CONTEST_PY" -m app.cli worker
    note "contest worker    running"
  fi
else
  skip "contest: add modules/contest/backend/.env (copy .env.example; SQLite by default) and install Python 3.12+"
fi

if [ -f "$ROOT/modules/attendance/backend/.env" ] && have go; then
  run attendance "$ROOT/modules/attendance/backend" go run ./cmd/server
  note "attendance-api    http://localhost:8080"
else
  skip "attendance-api: add modules/attendance/backend/.env (copy .env.example) and install Go"
fi

note "Ctrl+C stops everything."
wait
