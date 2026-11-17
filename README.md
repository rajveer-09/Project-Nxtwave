# NxtWave Student Hub

One website for attendance, instructor interactions, weekly tests, curriculum, messages and LeetCode contests, with one login and one student roster keyed by NIAT ID.

It replaces three separate apps:

| Old app | Becomes |
|---|---|
| Attendance tracker (Go API + Next.js) | **Attendance** module; the Go API keeps running as a service |
| Student Interaction Logs / Instructor Evaluation (Next.js) | **Interactions** module; its backend runs as its own service |
| NxtRank LeetCode contest tracker (FastAPI + worker) | **Contests** module; the NxtRank API and scan worker keep running as a service |

Each backend is its own microservice: own folder, own Docker image, own CI, deployed independently. They live in one repository so the web app and a service can change together in one commit.

## Architecture

```
Browser ──► apps/web (Next.js 16)
              ├─ UI for every module, one sign-in, one session
              ├─ core + Tests + Curriculum + Messages data (direct SQL)
              ├─ /api/logs/*        ──► services/interactions-api (Node + Hono)
              ├─ /api/attendance/*  ──► services/attendance-api (Go)
              └─ /api/contest/*     ──► services/contest (FastAPI) + scan worker

One Neon Postgres database, one schema per owner:
  core        students, staff, roles, assignments, sessions, audit  (written by the web app)
  logs        interactions, student progress, instructors           (interactions service)
              tests, curriculum, messages                           (web app)
  attendance  halls, sessions, marks, terms, internships            (Go service)
  contest     contests, results, scans                              (NxtRank)
```

- **One roster.** `core.students` is keyed by NIAT ID; every module joins to it.
- **One sign-in.** Email + password or Google workspace, sessions stored in `core.sessions`. The web app proxies service calls with a 60-second signed identity token (separate audience and secret per service), so the services never see the session cookie.
- **One Postgres role per service** with its own `search_path` and grants, so each service writes only to its own schema and reads `core`.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 app: all UI, unified auth, core/Tests/Curriculum/Messages data, service proxies |
| `services/interactions-api` | Interactions backend, ported from Instructor_Evaluation at `1012735`: interaction logs (create, edit, delete with reason), student progress, instructors (add, assign, change history), level-conversion analytics |
| `services/attendance-api` | Go attendance API (from the attendance repo at `1850dce`) |
| `services/contest` | NxtRank backend (from `rajveer-09/nxtrank` at `6d3cb36`): FastAPI API and LeetCode scan worker, one image, two commands |
| `db/core/migrations` | dbmate migrations for the shared `core` schema |
| `db/setup/service_roles.sql` | Creates one Postgres role per service with its grants and `search_path` |
| `db/local/setup.sh` | Local only: applies the core migrations and service roles inside `docker compose` |
| `db/migration/roster_dry_run.py` | Read-only preview of the roster and staff merge from the three old databases |
| `db/migration/migrate.py` | Copies the three old databases into the combined one, builds `core`, verifies every table |
| `docker-compose.yml` | Whole stack locally: Postgres, every service, the worker (opt-in) and the web app |
| `.github/workflows` | One CI workflow per app or service, each runs only when its folder changes |

### Services

| Service | Port | Runs | Migrations |
|---|---|---|---|
| `apps/web` | 3000 | `next start` | `db/core/migrations` (dbmate) |
| `services/interactions-api` | 8090 | `node dist/server.js` | `db/schema.sql` (idempotent), on start with `MIGRATE_ON_START=true` (`logs` schema) |
| `services/attendance-api` | 8080 | `/server` | its own, on start with `MIGRATE_ON_START=true` (`attendance` schema) |
| `services/contest` API | 8000 | Gunicorn + Uvicorn | Alembic, on start (`contest` schema) |
| `services/contest` worker | — | `python -m app.cli worker`, exactly one replica | — |

Each service connects as its own Postgres role, whose `search_path` puts its tables in its own schema, so the services' existing queries run unchanged.

The interactions service maps the signed-in email to its own `users` table (instructor link, senior flag, admin), as the old app did. A web Owner or Admin with no row there gets read-only access; anyone else without a row is refused.

### How `apps/web` is organised

Code is grouped **by module** plus **`common/`** for shared code.

```
apps/web/
├── app/            Next.js routes only. Thin: read params, check access, render a module's screen.
├── common/         Shared by every module. Never imports from modules/ (enforced by ESLint).
│   ├── ui/         shadcn/ui primitives
│   ├── components/ Page header, stat card, chips, data table, section card, empty state, calendar…
│   ├── lib/        Utilities, IST dates, safe CSV, URL params, API client, navigation and access rules
│   ├── auth/       Passwords, sessions, lockout, route guard, roles, Google OIDC, student access
│   ├── services/   Same-origin proxy to backend services + identity tokens
│   ├── db/         Postgres pool
│   ├── domain/     Cross-module business rules (at-risk flags)
│   └── sample-data/ Sample roster used until the database is connected
└── modules/
    ├── shell/        Sidebar, global filters, sign-out, message bell, urgent banner
    ├── login/        Sign-in forms and server actions
    ├── home/         Home dashboard
    ├── students/     Students list and the full Student page
    ├── attendance/   Hall sheet, calendar, terms, internships, imports, analytics
    ├── interactions/ Log form (incl. Wispr Flow transcript), recent logs, CSV export; service.ts → interactions-api
    ├── contests/     Contest list, contest page, results, scan review
    ├── tests/        Weekly test result-format builder, test creation, results entry
    ├── curriculum/   Level question bank and off-roadmap question review
    ├── messages/     Compose by role or person, inbox, live counts
    └── admin/        Staff and roles
```

Inside a module: `components/` (screens), `actions.ts` (server actions), `data.ts` (server-only reads and writes), `api.ts` (browser calls to a service), `types.ts`, `service.ts` (proxy config) and `sample-service.ts` (development stand-in with the real service contract).

Rules:

1. `common/` never imports from `modules/` or `app/`; modules never import from `app/`. Both are enforced by ESLint.
2. Modules may import another module's `data.ts` or `types.ts` when one screen shows another's data (for example the Student page).
3. Route files stay thin: access check and data loading, then render the module's component.
4. Server-only code starts with `import "server-only"`.

## Quick start

**Clone** (every branch, then installs dependencies). The repository is private, so sign in with `gh auth login` first, or let Git ask for your GitHub credentials:

```bash
# macOS / Linux / Git Bash
gh api repos/lakshayysinghh/Project-Nxtwave/contents/scripts/clone.sh -H "Accept: application/vnd.github.raw" > clone.sh
bash clone.sh                       # options: [folder] --branch staging --no-install
```

```powershell
# Windows PowerShell
gh api repos/lakshayysinghh/Project-Nxtwave/contents/scripts/clone.cmd -H "Accept: application/vnd.github.raw" | Set-Content -Encoding ascii clone.cmd
.\clone.cmd                         # options: [folder] [branch]
```

**Start everything** from the repository folder:

```bash
scripts/start.sh            # Windows: scripts\start.cmd
scripts/start.sh --worker   # also the LeetCode scan worker
```

- **With Docker running**, it starts the whole stack in Docker: Postgres :5433, web :3000, interactions API :8090, attendance API :8080, contest API :8000. The local Postgres has the same layout as the combined database (`core`, `attendance`, `logs`, `contest` schemas, one role per service); the passwords in `docker-compose.yml` are for that local stack only.
- **Without Docker** (or with `--local`), it starts the web app (sample data unless `apps/web/.env.local` says otherwise), plus each service whose tools and `.env` file are present: `services/interactions-api/.env` (Node 24+), `services/contest/.env` (Python 3.12+, SQLite by default), `services/attendance-api/.env` (Go). Copy each `.env.example` to start.
- Output from every process is prefixed with its name; **Ctrl+C stops everything**.
- `--docker` / `--local` force a mode; `--install-only` installs dependencies and exits.

## Running the web app on its own

Requires Node 24.

```bash
cd apps/web
npm install
npm run dev          # http://localhost:3000
```

Checks: `npm run lint`, `npm run typecheck`, `npm run build`.

### Sign-in modes

- **No database (`WEB_DATABASE_URL` unset):** `/login` shows a development role picker (Owner, Admin, Senior instructor, Instructor) and every module runs on sample data. Disabled in production builds unless `ALLOW_DEV_SESSION=true`; never set that on a public deployment.
- **Database (`WEB_DATABASE_URL` set):** real sign-in against `core.staff`.
  - Email + password. Existing hashes from the three old apps are accepted and upgraded on first sign-in. Locks after 5 failures in 15 minutes per email and per IP.
  - Google workspace (OIDC + PKCE) when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_BASE_URL` are set. Only verified emails on `GOOGLE_ALLOWED_DOMAIN` that match an active staff row.
  - Sessions last 12 hours (sliding) and are ended everywhere by bumping `session_version`.
  - First Owner: `STAFF_PASSWORD='…' npm run create-staff -- --email you@nxtwave.co.in --name "Your Name" --role owner`

`apps/web/.env.example` lists every setting.

### Service proxies

`/api/attendance/*` and `/api/contest/*` forward to the Go and NxtRank services once `ATTENDANCE_API_ORIGIN`/`ATTENDANCE_JWT_SECRET` and `CONTEST_API_ORIGIN`/`CONTEST_JWT_SECRET` are set. In development, without them, they answer from sample services that follow the real contracts.

## Database

1. Copy `.env.example` to `.env` and fill in values. `.env` is git-ignored.
2. Preview the roster merge (read-only; review CSVs go to `db/migration/out/`, which is git-ignored because it holds personal data):
   ```bash
   python -m venv .venv && .venv/Scripts/pip install -r db/migration/requirements.txt
   .venv/Scripts/python -I db/migration/roster_dry_run.py
   ```
3. Copy the three old databases into the combined one and build `core` (needs only psycopg, plus `services/contest/.venv` for Alembic):
   ```bash
   # SRC_ATTENDANCE_URL, SRC_LOGS_URL, SRC_CONTEST_URL, TARGET_URL (owner, direct host)
   # and WEB_PW, ATTENDANCE_PW, CONTEST_PW, INTERACTIONS_PW come from the environment
   .venv/Scripts/python -I db/migration/migrate.py            # target must be empty
   .venv/Scripts/python -I db/migration/migrate.py --rebuild  # replace everything (cutover)
   ```
   Each module's schema is created by that service's own migrations under its own role, compared with the source, then filled with `COPY` from one read-only snapshot per source; every table's row count and checksum must match. The old apps keep running, so run `--rebuild` again during the cutover write freeze.

## Roles and the change log

| Role | Sees | Never sees |
|---|---|---|
| Super admin (`owner`) | Superadmin panel (`/superadmin`) and everything else; the only role that adds or edits super admins | — |
| Admin | Admin panel: assignments, staff & roles (can add and edit admins), change log, curriculum, messages | Super admins, the Superadmin panel |
| Senior instructor | Senior SDI panel: assignments and their team (read-only) | Admins, super admins, the change log |
| Instructor | My students (assigned to them), no panel | Any panel |
| Success coach | My students (the students they coach), no panel | Any panel |

The menu (`apps/web/common/lib/nav.ts`) and the rank rules (`apps/web/common/auth/roles.ts`) are checked on the server for every page and action, not only hidden in the menu.

Every change to who teaches or coaches a student, to a student's class (college, section, hall, status) and to staff and roles is written to `core.change_log` by database triggers, so nothing can skip it. Each entry records who made it and where from: NxtOne, an Excel import (with the file name), the Interactions or Attendance service, or a direct database edit (with the database user). Writers say who they are with `set_config('app.*', …, true)` in their transaction (`apps/web/common/db/change.ts`). The log is append-only for every app role. Admins and super admins read it at `/admin/change-log` and on each student's page; admins see a super admin's edits as "Super admin".

## Branches

- `master`: production
- `staging`: pre-production; changes land here first and are merged to `master` after review

## Rules

- No connection strings, passwords or student data in the repo.
- Example student data uses fictional names and `N99…` NIAT IDs.
- Colours, colleges, levels and thresholds come from tokens, the API or settings, never hard-coded in screens.
