# NxtOne

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
Browser ──► platform/web (Next.js 16)
              ├─ UI for every module, one sign-in, one session
              ├─ core + Tests + Curriculum + Messages data (direct SQL)
              ├─ /api/logs/*        ──► modules/interactions/backend (Node + Hono)
              ├─ /api/attendance/*  ──► modules/attendance/backend (Go)
              └─ /api/contest/*     ──► modules/contest/backend (FastAPI) + scan worker

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

The repository is split by **module**. Each module team owns everything in its folder: the backend service, the module's screens in the web app, and its database schema. `platform/` is what every module shares.

```
modules/
├── attendance/
│   ├── backend/      Go attendance API (from the attendance repo at 1850dce); migrations/ for the attendance schema
│   └── frontend/     @nxtone/attendance-ui: hall sheet, calendar, terms, internships, imports
├── contest/
│   ├── backend/      NxtRank (from rajveer-09/nxtrank at 6d3cb36): FastAPI API + LeetCode scan worker; Alembic
│   └── frontend/     @nxtone/contest-ui: contest list, contest page, results, scan review, by-college data
└── interactions/
    ├── backend/      Interactions API (from Instructor_Evaluation at 1012735): logs, student progress,
    │                 instructors, level conversions; db/schema.sql for the logs schema
    └── frontend/     @nxtone/interactions-ui: log form, recent logs, CSV export, Log interaction;
                      curriculum/ (roadmap editor, question bank, off-roadmap review)
platform/
├── web/              The Next.js 16 app everyone opens: routes, sign-in, sidebar, student portal, and the
│                     pages that combine modules (Home, Students, Analytics, admin panel, Weekly tests, Messages)
└── db/
    ├── core/migrations/   dbmate migrations for the shared core schema (roster, staff, roles, change log, curriculum)
    ├── setup/             service_roles.sql: one Postgres role per service with its grants and search_path
    ├── local/             setup.sh: applies core migrations and roles inside docker compose
    └── migration/         migrate.py (old databases → combined one) and roster_dry_run.py
infra/
├── docker-compose.yml     Whole stack locally: Postgres, every service, the worker (opt-in), the web app
└── scripts/               start.sh / start.cmd (run everything), clone.sh / clone.cmd
.github/workflows/         One CI workflow per module backend and one for the web app; each runs only when its folders change
package.json               npm workspace: platform/web + the three module frontends (one install, one React)
```

### Who owns what

- **A module owns its data.** Only its service role writes its schema: `attendance`, `contest`, `logs`. Other code reads it through the module's API (or, for now, read-only SQL from the web app).
- **Platform owns `core`**: the roster, staff, roles, assignments, sessions and the change log. Modules read it and change it only through its functions (for example `core.assign_staff`).
- **Module frontends** are workspace packages compiled into `platform/web` (`transpilePackages` in `next.config.ts`). They import the platform's shared code as `@/common/*` and never another module's package or the platform's pages (enforced by each package's ESLint config). The platform imports them as `@nxtone/<module>-ui/...`.
- **Each backend deploys on its own**; the web app deploys when `platform/web` or any module frontend changes.

### Services

| Service | Port | Runs | Migrations |
|---|---|---|---|
| `platform/web` | 3000 | `next start` | `platform/db/core/migrations` (dbmate) |
| `modules/interactions/backend` | 8090 | `node dist/server.js` | `db/schema.sql` (idempotent), on start with `MIGRATE_ON_START=true` (`logs` schema) |
| `modules/attendance/backend` | 8080 | `/server` | its own, on start with `MIGRATE_ON_START=true` (`attendance` schema) |
| `modules/contest/backend` API | 8000 | Gunicorn + Uvicorn | Alembic, on start (`contest` schema) |
| `modules/contest/backend` worker | — | `python -m app.cli worker`, exactly one replica | — |

Each service connects as its own Postgres role, whose `search_path` puts its tables in its own schema, so the services' existing queries run unchanged.

The interactions service maps the signed-in email to its own `users` table (instructor link, senior flag, admin), as the old app did. A web Owner or Admin with no row there gets read-only access, plus logging what they took themselves.

### How `platform/web` is organised

```
platform/web/
├── app/            Next.js routes only. Thin: read params, check access, render a module's screen.
├── common/         Shared by every module. Never imports from modules (enforced by ESLint).
│   ├── ui/         shadcn/ui primitives
│   ├── components/ Page header, stat card, chips, charts, confirm pop-up, date range, theme…
│   ├── lib/        Utilities, IST dates, date ranges, safe CSV, URL params, API client, navigation and access rules
│   ├── auth/       Passwords, sessions, lockout, route guard, roles, Google OIDC, student access
│   ├── services/   Same-origin proxy to backend services + identity tokens
│   ├── data/       Shared roster and cache tags
│   ├── db/         Postgres pool and the change-log transaction helper
│   ├── domain/     Cross-module business rules (at-risk flags)
│   └── sample-data/ Sample roster used until the database is connected
└── modules/        Platform screens that aren't one module's
    ├── shell/      Sidebar, profile menu, preloading, message bell, urgent banner
    ├── login/      Sign-in page and server actions
    ├── home/       Home dashboard
    ├── students/   Students list and the full Student page
    ├── analytics/  Cohort analytics
    ├── tests/      Weekly test formats, tests, results entry
    ├── messages/   Compose by role or person, inbox, live counts
    ├── student/    Student portal (/me)
    └── admin/      Assignments, staff and roles, change log, student access
```

Inside a module (here or in `modules/<module>/frontend`): `components/` (screens), `actions.ts` (server actions), `data.ts` (server-only reads and writes), `api.ts` (browser calls to a service), `types.ts`, `service.ts` (proxy config) and `sample-service.ts` (development stand-in with the real service contract).

Rules:

1. `common/` never imports from modules or `app/`; modules never import from `app/`. Enforced by ESLint.
2. Platform pages may import a module's `data.ts` or `types.ts` when one screen shows another module's data (for example the Student page).
3. Route files stay thin: access check and data loading, then render the module's component.
4. Server-only code starts with `import "server-only"`.

## Quick start

**Clone** (every branch, then installs dependencies). The repository is private, so sign in with `gh auth login` first, or let Git ask for your GitHub credentials:

```bash
# macOS / Linux / Git Bash
gh api repos/lakshayysinghh/Project-Nxtwave/contents/infra/scripts/clone.sh -H "Accept: application/vnd.github.raw" > clone.sh
bash clone.sh                       # options: [folder] --branch staging --no-install
```

```powershell
# Windows PowerShell
gh api repos/lakshayysinghh/Project-Nxtwave/contents/infra/scripts/clone.cmd -H "Accept: application/vnd.github.raw" | Set-Content -Encoding ascii clone.cmd
.\clone.cmd                         # options: [folder] [branch] --no-install
```

**Update** an existing copy: run the same script again on the same folder. It fetches every branch, adds new ones, fast-forwards the ones that are behind and reinstalls dependencies. Branches with your own unpushed commits, or uncommitted changes in the way, are left as they are and reported.

**Start everything** from the repository folder:

```bash
infra/scripts/start.sh            # Windows: infra\scripts\start.cmd
infra/scripts/start.sh --worker   # also the LeetCode scan worker
```

- **With Docker running**, it starts the whole stack in Docker: Postgres :5433, web :3000, interactions API :8090, attendance API :8080, contest API :8000. The local Postgres has the same layout as the combined database (`core`, `attendance`, `logs`, `contest` schemas, one role per service); the passwords in `infra/docker-compose.yml` are for that local stack only.
- **Without Docker** (or with `--local`), it starts the web app (sample data unless `platform/web/.env.local` says otherwise), plus each service whose tools and `.env` file are present: `modules/interactions/backend/.env` (Node 24+), `modules/contest/backend/.env` (Python 3.12+, SQLite by default), `modules/attendance/backend/.env` (Go). Copy each `.env.example` to start.
- Output from every process is prefixed with its name; **Ctrl+C stops everything**.
- `--docker` / `--local` force a mode; `--install-only` installs dependencies and exits.

## Running the web app on its own

Requires Node 24.

```bash
npm install          # at the repo root: one workspace for platform/web and the module frontends
npm run dev          # http://localhost:3000
```

Checks (from the root): `npm run lint` (the app and every module frontend), `npm run typecheck`, `npm run build`.

### Sign-in modes

- **No database (`WEB_DATABASE_URL` unset):** `/login` shows a development role picker (Owner, Admin, Senior instructor, Instructor) and every module runs on sample data. Disabled in production builds unless `ALLOW_DEV_SESSION=true`; never set that on a public deployment.
- **Database (`WEB_DATABASE_URL` set):** real sign-in against `core.staff`.
  - Email + password. Existing hashes from the three old apps are accepted and upgraded on first sign-in. Locks after 5 failures in 15 minutes per email and per IP.
  - Google workspace (OIDC + PKCE) when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_BASE_URL` are set. Only verified emails on `GOOGLE_ALLOWED_DOMAIN` that match an active staff row.
  - Sessions last 12 hours (sliding) and are ended everywhere by bumping `session_version`.
  - First Owner: `STAFF_PASSWORD='…' npm run create-staff -- --email you@nxtwave.co.in --name "Your Name" --role owner`

`platform/web/.env.example` lists every setting.

### Service proxies

`/api/attendance/*` and `/api/contest/*` forward to the Go and NxtRank services once `ATTENDANCE_API_ORIGIN`/`ATTENDANCE_JWT_SECRET` and `CONTEST_API_ORIGIN`/`CONTEST_JWT_SECRET` are set. In development, without them, they answer from sample services that follow the real contracts. Every service trusts NxtOne's identity token and has no sign-in of its own; the attendance service maps NxtOne roles: owner (everything), admin (everything but Owner-only routes), and instructors, senior instructors and success coaches (marking halls and reading the calendar, terms and internships; success coaches also read analytics, as do admins).

## Database

1. Copy `.env.example` to `.env` and fill in values. `.env` is git-ignored.
2. Preview the roster merge (read-only; review CSVs go to `platform/db/migration/out/`, which is git-ignored because it holds personal data):
   ```bash
   python -m venv .venv && .venv/Scripts/pip install -r platform/db/migration/requirements.txt
   .venv/Scripts/python -I platform/db/migration/roster_dry_run.py
   ```
3. Copy the three old databases into the combined one and build `core` (needs only psycopg, plus `modules/contest/backend/.venv` for Alembic):
   ```bash
   # SRC_ATTENDANCE_URL, SRC_LOGS_URL, SRC_CONTEST_URL, TARGET_URL (owner, direct host)
   # and WEB_PW, ATTENDANCE_PW, CONTEST_PW, INTERACTIONS_PW come from the environment
   .venv/Scripts/python -I platform/db/migration/migrate.py            # target must be empty
   .venv/Scripts/python -I platform/db/migration/migrate.py --rebuild  # replace everything (cutover)
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
| Student | Their own page at `/me`: attendance, DSA progress, instructor feedback, weekly tests, contests. Signs in with NIAT ID + password (Student tab on `/login`); admins issue the first password in Admin › Student access | Every staff page and API, other students |

The menu (`platform/web/common/lib/nav.ts`) and the rank rules (`platform/web/common/auth/roles.ts`) are checked on the server for every page and action, not only hidden in the menu.

Every change to who teaches or coaches a student, to a student's class (college, section, hall, status) and to staff and roles is written to `core.change_log` by database triggers, so nothing can skip it. Each entry records who made it and where from: NxtOne, an Excel import (with the file name), the Interactions or Attendance service, or a direct database edit (with the database user). Writers say who they are with `set_config('app.*', …, true)` in their transaction (`platform/web/common/db/change.ts`). The log is append-only for every app role. Admins and super admins read it at `/admin/change-log` and on each student's page; admins see a super admin's edits as "Super admin".

## Speed

- Shared data (roster, interactions, each student's page, Home numbers) is read through `"use cache: remote"` with tags; a write expires exactly the tags it touched (`platform/web/common/data/cache.ts`).
- Every app page is partially prerendered: the layout is served at once and the data streams in. The sign-in page is fully static.
- Deploy the web app and the services in Singapore, next to the database (`platform/web/vercel.json` pins `sin1`). Most of a cold database read is the network round trip, not the query.
- Real users' Core Web Vitals are logged as JSON lines by `/api/vitals`. CI runs Lighthouse on the sign-in page and fails if it gets slower than the budget in `platform/web/lighthouserc.json`.

## Deploy

Everything runs in Singapore, next to the database.

| Part | Where | Settings |
|---|---|---|
| Database | Supabase (Postgres) | Apps connect through the transaction pooler (`aws-0-ap-southeast-1.pooler.supabase.com:6543`) as their own service roles |
| Web app | Vercel, Root Directory `platform/web` (`vercel.json`: `sin1`, installs the workspace from the repo root) | `WEB_DATABASE_URL`, `APP_BASE_URL`, `GOOGLE_ALLOWED_DOMAIN`, `INTERACTIONS_API_ORIGIN` + `INTERACTIONS_JWT_SECRET`, `CONTEST_API_ORIGIN` + `CONTEST_JWT_SECRET`, `ATTENDANCE_API_ORIGIN` + `ATTENDANCE_JWT_SECRET` |
| Interactions, contest and attendance APIs | Render, from the Blueprint `render.yaml` (one Docker web service each) | Listed at the top of `render.yaml` |

Each `*_JWT_SECRET` on Vercel equals that service's `IDENTITY_JWT_SECRET` on Render. Node connections to the pooler need `?uselibpqcompat=true&sslmode=require`; the contest API's need `?sslmode=require`; the attendance API (Go, prepared statements) uses the session pooler (`:5432`) with `?sslmode=require`. The root `Dockerfile` still runs the web app, interactions and contest in one container, for a single-host deploy.

Code rooms sync live over a WebSocket to the interactions service (`modules/interactions/backend/src/rooms`, `/rooms/socket`); the web app hands out a short-lived ticket (`/api/rooms/[id]/ticket`) and falls back to polling when sockets are off (`CODE_ROOM_SOCKETS=off` on Vercel) or unreachable.

On Render's free plan a service sleeps after 15 idle minutes, and all free services share 750 hours a month. A free scheduler (cron-job.org, time zone Asia/Kolkata) keeps them awake during working hours: `GET <interactions>/health` every 10 minutes 07:00–19:50 daily (this also counts as database activity for Supabase), and `GET <contest>/api/health` every 10 minutes 09:00–17:50 Monday–Saturday; about 650 hours a month. Outside those hours a service wakes on the first request (about a minute; the pages say so and retry).

## Branches

- `master`: production
- `staging`: pre-production; changes land here first and are merged to `master` after review

## Rules

- No connection strings, passwords or student data in the repo.
- Example student data uses fictional names and `N99…` NIAT IDs.
- Colours, colleges, levels and thresholds come from tokens, the API or settings, never hard-coded in screens.
