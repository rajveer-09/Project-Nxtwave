#
# Author : Rajveer Sharma
# Date : 17 Nov 2026
# @ Nxtwave
#

"""
Copies the three app databases into the combined database and builds `core`
(ARCHITECTURE.md §11). Only psycopg is needed: no pg_dump or psql.

    python -I db/migration/migrate.py             first run (the target must be empty)
    python -I db/migration/migrate.py --rebuild   drop core/attendance/logs/contest in the
                                                  target and copy everything again (cutover)

Environment (never on the command line):
    SRC_ATTENDANCE_URL, SRC_LOGS_URL, SRC_CONTEST_URL   the old databases (only read)
    TARGET_URL                                          combined database: owner role, direct host
    WEB_PW, ATTENDANCE_PW, CONTEST_PW, INTERACTIONS_PW  passwords for the service roles

Steps:
  1. core migrations (schemas, extensions, core tables), service roles and grants
  2. each module's schema built by that service's own migrations while connected as its
     service role, so the service owns its tables and can keep migrating them:
       attendance  services/attendance-api/migrations (golang-migrate files)
       logs        services/interactions-api/db/schema.sql
       contest     Alembic, at the revision the source database is on
  3. that schema compared with the source: columns, constraints, indexes, triggers,
     functions, views, sequences. Any difference stops the run before data is copied.
  4. data copied with COPY from one read-only snapshot per source; sequences carried over;
     every table's row count and content checksum must equal the snapshot
  5. core.students / staff / staff_roles / student_assignments built from the copied data
  6. checks as each service role: own schema first on the search path, no access to other
     modules' schemas, the level-change trigger fires

Prints counts only. Row-level review files (personal data, git-ignored) go to db/migration/out/.
The old databases keep running: anything written to them after the snapshot is not copied,
so re-run with --rebuild during the cutover write freeze.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import quote

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.rows import dict_row, tuple_row

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "out"

NIAT = re.compile(r"^N\d{2}H\d{2}[AB]\d{4}$")
MODULE_SCHEMAS = ("attendance", "logs", "contest")
MODULES = {
    "attendance": {"src": "SRC_ATTENDANCE_URL", "role": "attendance_svc", "pw": "ATTENDANCE_PW"},
    "logs": {"src": "SRC_LOGS_URL", "role": "interactions_svc", "pw": "INTERACTIONS_PW"},
    "contest": {"src": "SRC_CONTEST_URL", "role": "contest_svc", "pw": "CONTEST_PW"},
}
ROLE_PASSWORDS = {"web_svc": "WEB_PW", "attendance_svc": "ATTENDANCE_PW",
                  "contest_svc": "CONTEST_PW", "interactions_svc": "INTERACTIONS_PW"}
# Source tables deliberately left behind: the old Interactions login sessions (the hub has its own).
SKIP_TABLES = {"logs": {"sessions"}}
# Object kinds the target may have on top of the source (added by newer service migrations).
NEWER_IN_SERVICES = {"triggers", "functions"}
SCHEMA_PREFIX = re.compile(r"\b(public|core|attendance|logs|contest|extensions)\.")


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Missing environment variable {name}")
    return value


def connect(url: str, autocommit: bool = True, read_only: bool = False) -> psycopg.Connection:
    conn = psycopg.connect(url, connect_timeout=30, autocommit=autocommit)
    conn.execute("SET TimeZone = 'UTC'")
    if read_only:
        conn.execute("SET default_transaction_read_only = on")
    if not autocommit:
        conn.commit()
    return conn


def as_role(url: str, role: str) -> str:
    params = conninfo_to_dict(url)
    params.update(user=role, password=env(ROLE_PASSWORDS[role]))
    return make_conninfo(**params)


def step(text: str) -> None:
    print(f"\n== {text}", flush=True)


def write_csv(name: str, rows: list[dict]) -> None:
    OUT.mkdir(exist_ok=True)
    with (OUT / name).open("w", newline="", encoding="utf-8") as f:
        if rows:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)


# ------------------------------------------------------------------ 1. core + roles

def prepare_target(owner: psycopg.Connection, rebuild: bool) -> None:
    used = owner.execute(
        """SELECT n.nspname FROM pg_namespace n JOIN pg_class c ON c.relnamespace = n.oid
           WHERE n.nspname IN ('core', 'attendance', 'logs', 'contest') AND c.relkind IN ('r', 'p')
           GROUP BY 1 ORDER BY 1""").fetchall()
    if used and not rebuild:
        sys.exit(f"The target already has tables in: {', '.join(s for (s,) in used)}. "
                 "Re-run with --rebuild to replace them.")
    if rebuild:
        for schema in ("attendance", "logs", "contest", "core"):
            owner.execute(sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(schema)))
        owner.execute("DROP TABLE IF EXISTS public.schema_migrations")
        print("  dropped core, attendance, logs, contest")


def apply_core_migrations(owner: psycopg.Connection) -> None:
    """Same bookkeeping as dbmate (public.schema_migrations) and db/local/setup.sh."""
    owner.execute("CREATE TABLE IF NOT EXISTS public.schema_migrations (version varchar(128) PRIMARY KEY)")
    for path in sorted((ROOT / "db/core/migrations").glob("*.sql")):
        version = path.name.split("_")[0]
        if owner.execute("SELECT 1 FROM public.schema_migrations WHERE version = %s", (version,)).fetchone():
            continue
        up = path.read_text(encoding="utf-8").split("-- migrate:down")[0]
        with owner.transaction():
            owner.execute(up)
            owner.execute("INSERT INTO public.schema_migrations (version) VALUES (%s)", (version,))
        print(f"  applied core migration {version}")


def run_psql_file(conn: psycopg.Connection, path: Path, variables: dict[str, str]) -> None:
    """Runs the subset of psql that db/setup/service_roles.sql uses: \\set, :'var', \\gexec."""
    def substitute(text: str) -> str:
        return re.sub(r":'(\w+)'", lambda m: sql.Literal(variables[m.group(1)]).as_string(conn), text)

    text = re.sub(r"/\*.*?\*/", "", path.read_text(encoding="utf-8"), flags=re.S)
    buffer: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not buffer and (not stripped or stripped.startswith(("--", "\\set"))):
            continue
        if stripped.endswith("\\gexec"):
            buffer.append(line[: line.rfind("\\gexec")])
            for row in conn.execute(substitute("\n".join(buffer))).fetchall():
                for statement in row:
                    if statement:
                        conn.execute(statement)
            buffer = []
        else:
            buffer.append(line)
            if stripped.endswith(";"):
                conn.execute(substitute("\n".join(buffer)))
                buffer = []
    if any(part.strip() for part in buffer):
        raise RuntimeError(f"Unterminated statement at the end of {path}")


def setup_roles(owner: psycopg.Connection) -> None:
    passwords = {role: env(var) for role, var in ROLE_PASSWORDS.items()}
    variables = {"web_pw": passwords["web_svc"], "attendance_pw": passwords["attendance_svc"],
                 "contest_pw": passwords["contest_svc"], "interactions_pw": passwords["interactions_svc"]}
    with owner.transaction():
        run_psql_file(owner, ROOT / "db/setup/service_roles.sql", variables)
        # service_roles.sql only sets a password when it creates the role; keep them in step with the env.
        for role, password in passwords.items():
            owner.execute(sql.SQL("ALTER ROLE {} PASSWORD {}").format(sql.Identifier(role), sql.Literal(password)))


# ------------------------------------------------------------------ 2. module schemas

def contest_python() -> Path:
    base = ROOT / "services/contest/.venv"
    for candidate in (base / "Scripts/python.exe", base / "bin/python"):
        if candidate.exists():
            return candidate
    sys.exit("services/contest/.venv is missing. Run scripts/start.sh --install-only first (needs Python 3.12+).")


def build_module_schema(module: str, target_url: str, sources: dict[str, psycopg.Connection]) -> None:
    role = MODULES[module]["role"]
    role_url = as_role(target_url, role)
    with connect(role_url) as conn:
        schema = conn.execute("SELECT current_schema()").fetchone()[0]
        if schema != module:
            sys.exit(f"{role} resolves to schema {schema!r}, expected {module!r} (check its search_path)")
        if module == "attendance":
            # golang-migrate's own table (pgx/v5 driver), then every up migration in order
            conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version bigint NOT NULL PRIMARY KEY, dirty boolean NOT NULL)")
            for path in sorted((ROOT / "services/attendance-api/migrations").glob("*.up.sql")):
                conn.execute(path.read_text(encoding="utf-8"))
        elif module == "logs":
            conn.execute((ROOT / "services/interactions-api/db/schema.sql").read_text(encoding="utf-8"))
    if module == "contest":
        revision = sources["contest"].execute("SELECT version_num FROM public.alembic_version").fetchone()[0]
        child_env = {**os.environ, "DATABASE_URL": role_url_as_url(role_url)}
        result = subprocess.run([str(contest_python()), "-m", "alembic", "upgrade", revision],
                                cwd=ROOT / "services/contest", env=child_env, capture_output=True, text=True)
        if result.returncode != 0:
            sys.exit(f"Alembic failed:\n{result.stderr[-3000:]}")
        print(f"  contest: Alembic at {revision}")
    print(f"  {module}: schema built as {role}")


def role_url_as_url(conninfo: str) -> str:
    """Alembic wants a URL, not a libpq key=value string."""
    p = conninfo_to_dict(conninfo)
    query = "&".join(f"{k}={quote(str(v))}" for k, v in p.items() if k not in ("user", "password", "host", "port", "dbname"))
    port = f":{p['port']}" if p.get("port") else ""
    return (f"postgresql://{quote(p['user'], safe='')}:{quote(p['password'], safe='')}@{p['host']}{port}/"
            f"{p.get('dbname', 'postgres')}{'?' + query if query else ''}")


# ------------------------------------------------------------------ 3. schema comparison

def norm(text: str | None) -> str:
    return " ".join(SCHEMA_PREFIX.sub("", text or "").split())


def snapshot(conn: psycopg.Connection, schema: str, skip: set[str]) -> dict[str, set]:
    def rows(query: str):
        return conn.execute(query, (schema,)).fetchall()

    shape: dict[str, set] = defaultdict(set)
    for t, col, typ, notnull, default, ident, gen in rows(
            """SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull,
                      pg_get_expr(d.adbin, d.adrelid), a.attidentity, a.attgenerated
               FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
               LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
               WHERE n.nspname = %s AND c.relkind IN ('r', 'p')"""):
        if t not in skip:
            shape["tables"].add(t)
            shape["columns"].add(f"{t}.{col} {norm(typ)}{' not null' if notnull else ''}"
                                 f"{' default ' + norm(default) if default else ''}{' identity ' + ident if ident else ''}"
                                 f"{' generated ' + gen if gen else ''}")
    for t, name, definition in rows(
            """SELECT c.conrelid::regclass::text, c.conname, pg_get_constraintdef(c.oid)
               FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
               WHERE n.nspname = %s AND c.contype <> 'n' AND c.conrelid <> 0"""):
        t = norm(t).strip('"')
        if t not in skip and not any(f"REFERENCES {s}(" in norm(definition) for s in skip):
            shape["constraints"].add(f"{t}: {name} {norm(definition)}")
    for t, definition in rows(
            """SELECT c.relname, pg_get_indexdef(i.indexrelid)
               FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = %s"""):
        if t not in skip:
            shape["indexes"].add(norm(definition))
    for t, definition in rows(
            """SELECT c.relname, pg_get_triggerdef(t.oid)
               FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = %s AND NOT t.tgisinternal"""):
        if t not in skip:
            shape["triggers"].add(norm(definition))
    for name, args, body in rows(
            """SELECT p.proname, pg_get_function_identity_arguments(p.oid), p.prosrc
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
               WHERE n.nspname = %s AND d.objid IS NULL"""):
        shape["functions"].add(f"{name}({args}) {norm(body)}")
    for name, definition in rows(
            """SELECT c.relname, pg_get_viewdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = %s AND c.relkind IN ('v', 'm')"""):
        shape["views"].add(f"{name}: {norm(definition)}")
    for (name,) in rows(
            """SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = %s AND c.relkind = 'S'"""):
        if not any(name.startswith(f"{s}_") for s in skip):
            shape["sequences"].add(name)
    return shape


def compare_schema(module: str, source: psycopg.Connection, target: psycopg.Connection) -> list[str]:
    skip = SKIP_TABLES.get(module, set())
    src, tgt = snapshot(source, "public", skip), snapshot(target, module, skip)
    problems = []
    for kind in sorted(set(src) | set(tgt)):
        for item in sorted(src[kind] - tgt[kind]):
            problems.append(f"{module} {kind}: only in source: {item}")
        for item in sorted(tgt[kind] - src[kind]):
            # Triggers and functions the services have added since the old app (e.g. change logging)
            # are expected; tables, columns, constraints and indexes must still match.
            if kind in NEWER_IN_SERVICES:
                continue
            problems.append(f"{module} {kind}: only in target: {item}")
    return problems


# ------------------------------------------------------------------ 4. data

def table_columns(conn: psycopg.Connection, schema: str) -> dict[str, list[str]]:
    cols: dict[str, list[str]] = defaultdict(list)
    for t, c in conn.execute(
            """SELECT c.relname, a.attname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
               WHERE n.nspname = %s AND c.relkind IN ('r', 'p') AND a.attgenerated = ''
               ORDER BY c.relname, a.attnum""", (schema,)).fetchall():
        cols[t].append(c)
    return dict(cols)


def load_order(conn: psycopg.Connection, schema: str, tables: list[str]) -> list[str]:
    deps = defaultdict(set)
    for child, parent in conn.execute(
            """SELECT c.conrelid::regclass::text, c.confrelid::regclass::text FROM pg_constraint c
               JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = %s AND c.contype = 'f'""",
            (schema,)).fetchall():
        child, parent = norm(child).strip('"'), norm(parent).strip('"')
        if child != parent:
            deps[child].add(parent)
    order, done = [], set()

    def visit(t: str, path: tuple = ()) -> None:
        if t in done:
            return
        if t in path:
            raise RuntimeError(f"Foreign-key cycle in {schema}: {' -> '.join(path + (t,))}")
        for parent in sorted(deps[t]):
            if parent in tables:
                visit(parent, path + (t,))
        done.add(t)
        order.append(t)

    for t in sorted(tables):
        visit(t)
    return order


def checksum(conn: psycopg.Connection, schema: str, table: str, cols: list[str]) -> tuple[int, str]:
    row = sql.SQL("ROW({})::text").format(sql.SQL(", ").join(map(sql.Identifier, cols)))
    query = sql.SQL("""SELECT count(*), md5(coalesce(string_agg(r, E'\\n' ORDER BY r COLLATE "C"), ''))
                       FROM (SELECT {} AS r FROM {}) x""").format(row, sql.Identifier(schema, table))
    count, digest = conn.execute(query).fetchone()
    return count, digest


def copy_module(module: str, source_url: str, target_url: str) -> dict[str, int]:
    skip = SKIP_TABLES.get(module, set())
    role_url = as_role(target_url, MODULES[module]["role"])
    with connect(source_url, autocommit=False, read_only=True) as src, connect(role_url, autocommit=False) as tgt:
        src.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
        src.read_only = True
        src_cols = {t: c for t, c in table_columns(src, "public").items() if t not in skip}
        tgt_cols = table_columns(tgt, module)
        missing = sorted(set(src_cols) - set(tgt_cols))
        if missing:
            raise RuntimeError(f"{module}: tables missing in the target: {missing}")
        for t, cols in src_cols.items():
            if set(cols) != set(tgt_cols[t]):
                raise RuntimeError(f"{module}.{t}: columns differ between source and target")

        tgt.execute(sql.SQL("TRUNCATE {} RESTART IDENTITY CASCADE").format(
            sql.SQL(", ").join(sql.Identifier(module, t) for t in sorted(tgt_cols))))
        counts = {}
        for t in load_order(tgt, module, list(src_cols)):
            collist = sql.SQL(", ").join(map(sql.Identifier, src_cols[t]))
            with src.cursor().copy(sql.SQL("COPY {} ({}) TO STDOUT").format(sql.Identifier("public", t), collist)) as out, \
                    tgt.cursor().copy(sql.SQL("COPY {} ({}) FROM STDIN").format(sql.Identifier(module, t), collist)) as into:
                for chunk in out:
                    into.write(chunk)
            expected = checksum(src, "public", t, src_cols[t])
            actual = checksum(tgt, module, t, src_cols[t])
            if expected != actual:
                raise RuntimeError(f"{module}.{t}: copy does not match the source "
                                   f"(rows {expected[0]} vs {actual[0]}, checksum {'same' if expected[1] == actual[1] else 'differs'})")
            counts[t] = expected[0]

        sequences = 0
        for (name,) in src.execute("SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'").fetchall():
            if any(name.startswith(f"{s}_") for s in skip):
                continue
            last, called = src.execute(sql.SQL("SELECT last_value, is_called FROM {}").format(sql.Identifier("public", name))).fetchone()
            tgt.execute("SELECT setval(%s::regclass, %s, %s)", (f'"{module}"."{name}"', last, called))
            sequences += 1
        if module == "attendance":
            # The schema was built with every migration in the repo; the copied version row is the old app's.
            latest = max(int(p.name.split("_")[0]) for p in (ROOT / "services/attendance-api/migrations").glob("*.up.sql"))
            tgt.execute("UPDATE schema_migrations SET version = %s, dirty = false", (latest,))
        tgt.commit()
        src.rollback()
    print(f"  {module}: {len(counts)} tables, {sum(counts.values())} rows, {sequences} sequences; "
          "every table's rows and checksum match the source snapshot")
    return counts


# ------------------------------------------------------------------ 5. core

def hall(text: str | None) -> str | None:
    value = " ".join((text or "").split())
    m = re.fullmatch(r"(?i)hall\s*(\d+)", value)
    return f"Hall {int(m.group(1))}" if m else (value or None)


def squash(text: str | None) -> str:
    return " ".join((text or "").split())


def build_core(owner: psycopg.Connection) -> dict:
    q = lambda query: owner.execute(query).fetchall()  # noqa: E731
    with owner.transaction():
        owner.row_factory = dict_row
        att = {r["niat_id"].strip().upper(): r for r in q(
            "SELECT niat_id, full_name, degree_code, section, hall_no, status, joined_on, dropped_on FROM attendance.students")}
        lg = {r["id"].strip().upper(): r for r in q(
            "SELECT id, name, degree, section, hall, instructor_id FROM logs.students")}
        ct = {r["roll_no"].strip().upper(): r for r in q("SELECT roll_no, name FROM contest.students")}

        # ---- students: Interactions wins for name, section, hall; then Attendance; then Contests
        students, conflicts, invalid = [], [], []
        for nid in sorted(set(att) | set(lg) | set(ct)):
            if not NIAT.match(nid):
                invalid.append({"id": nid, "in_attendance": nid in att, "in_logs": nid in lg, "in_contest": nid in ct})
                continue
            a, l, c = att.get(nid) or {}, lg.get(nid) or {}, ct.get(nid) or {}
            name = squash(l.get("name")) or squash(a.get("full_name")) or squash(c.get("name"))
            college = (l.get("degree") or a.get("degree_code") or "").strip().upper()
            letter_college = "CDU" if nid[6] == "B" else "BITS"
            if college not in ("BITS", "CDU"):
                college = letter_college
            if college != letter_college:
                conflicts.append({"niat_id": nid, "field": "college vs NIAT letter", "attendance": a.get("degree_code"),
                                  "interactions": l.get("degree"), "used": college})
            section = squash(l.get("section")) or squash(a.get("section"))
            hall_v = hall(l.get("hall")) or hall(a.get("hall_no"))
            status = a.get("status") if a.get("status") in ("active", "dropped") else "active"
            if a and l:
                for field, av, lv, used in (("name", a.get("full_name"), l.get("name"), name),
                                            ("section", a.get("section"), l.get("section"), section),
                                            ("hall", hall(a.get("hall_no")), hall(l.get("hall")), hall_v)):
                    if squash(av).casefold() != squash(lv).casefold():
                        conflicts.append({"niat_id": nid, "field": field, "attendance": av, "interactions": lv, "used": used})
            if not name:
                invalid.append({"id": nid, "in_attendance": bool(a), "in_logs": bool(l), "in_contest": bool(c)})
                continue
            students.append((nid, name, college, section, hall_v, status, a.get("joined_on"),
                             a.get("dropped_on") if status == "dropped" else None))
        with owner.cursor() as cur:
            cur.executemany("""INSERT INTO core.students (niat_id, full_name, college, section, hall, status, joined_on, dropped_on)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""", students)

        # ---- staff: Interactions users first, then Attendance admins and real NxtRank users, by email
        staff: dict[str, dict] = {}

        def person(email: str, name: str) -> dict:
            return staff.setdefault(email, {"email": email, "name": squash(name) or email, "instructor_code": None,
                                            "aliases": [], "left_on": None, "password_hash": None,
                                            "active": [], "roles": {}, "sources": []})

        instructors = {r["id"]: r for r in q("SELECT id, full_name, email, aliases, left_on FROM logs.instructors")}
        duplicate_codes: list[str] = []
        for u in q("SELECT email, name, role, is_senior, instructor_id, password_hash FROM logs.users"):
            p = person(u["email"].strip().lower(), u["name"])
            ins = instructors.get(u["instructor_id"]) if u["instructor_id"] else None
            if ins and ins["id"] in {s["instructor_code"] for s in staff.values()}:
                duplicate_codes.append(ins["id"])
            elif ins:
                p.update(instructor_code=ins["id"], aliases=list(ins["aliases"] or []), left_on=ins["left_on"])
            p["password_hash"] = p["password_hash"] or u["password_hash"]
            p["roles"]["logs"] = "admin" if u["role"] == "admin" else ("senior_instructor" if u["is_senior"] else "instructor")
            p["active"].append(True)
            p["sources"].append("interactions")
        # Instructors who never had an Interactions login still need a staff row for their students
        linked = {p["instructor_code"] for p in staff.values()}
        no_email_instructors = []
        for ins in instructors.values():
            if ins["id"] in linked:
                continue
            email = (ins["email"] or "").strip().lower()
            if "@" not in email:
                no_email_instructors.append(ins["id"])
                continue
            p = person(email, ins["full_name"])
            if p["instructor_code"] is None:
                p.update(instructor_code=ins["id"], aliases=list(ins["aliases"] or []), left_on=ins["left_on"])
                p["sources"].append("interactions (instructor only)")
        skipped = Counter()
        for u in q("SELECT email, name, role, active, password_hash FROM attendance.admins"):
            email = u["email"].strip().lower()
            if email.endswith("demo.local") or "@" not in email:
                skipped["attendance placeholder"] += 1
                continue
            p = person(email, u["name"])
            p["password_hash"] = p["password_hash"] or u["password_hash"]
            if u["active"]:
                p["roles"]["attendance"] = u["role"]
            p["active"].append(bool(u["active"]))
            p["sources"].append("attendance")
        for u in q("SELECT username, display_name, role, is_super, active, password_hash FROM contest.users"):
            email = u["username"].strip().lower()
            if "@" not in email or email.endswith(("@example.com", "@admin.com")):
                skipped["contest placeholder"] += 1
                continue
            p = person(email, u["display_name"] or email)
            p["password_hash"] = p["password_hash"] or u["password_hash"]
            if u["active"]:
                p["roles"]["contest"] = "owner" if u["is_super"] else u["role"]
            p["active"].append(bool(u["active"]))
            p["sources"].append("contest")

        role_rows, staff_ids = [], {}
        for p in sorted(staff.values(), key=lambda r: r["email"]):
            active = (any(p["active"]) or not p["active"]) and p["left_on"] is None
            staff_id = owner.execute(
                """INSERT INTO core.staff (email, name, instructor_code, aliases, password_hash, active, left_on)
                   VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (p["email"], p["name"], p["instructor_code"], p["aliases"], p["password_hash"], active, p["left_on"])).fetchone()["id"]
            staff_ids[p["email"]] = staff_id
            for module, role in p["roles"].items():
                if role in ("owner", "admin", "senior_instructor", "instructor", "viewer"):
                    role_rows.append((staff_id, module, role))
        with owner.cursor() as cur:
            cur.executemany("INSERT INTO core.staff_roles (staff_id, module, role) VALUES (%s, %s, %s)", role_rows)

        # ---- instructor assignments from Interactions
        by_code = {p["instructor_code"]: staff_ids[p["email"]] for p in staff.values() if p["instructor_code"]}
        core_ids = {s[0] for s in students}
        assignments, unassigned = [], []
        for nid, l in lg.items():
            if nid not in core_ids:
                continue
            staff_id = by_code.get(l["instructor_id"]) if l["instructor_id"] else None
            if staff_id:
                assignments.append((nid, staff_id, "instructor", date.today()))
            else:
                unassigned.append({"niat_id": nid, "name": l["name"], "instructor_id": l["instructor_id"] or ""})
        with owner.cursor() as cur:
            cur.executemany("INSERT INTO core.student_assignments (niat_id, staff_id, kind, from_date) VALUES (%s, %s, %s, %s)",
                            assignments)

        summary = {
            "students": len(students), "invalid_ids_skipped": len(invalid),
            "students_by_college": dict(Counter(s[2] for s in students)),
            "in_all_three": sum(1 for s in students if s[0] in att and s[0] in lg and s[0] in ct),
            "in_interactions_not_attendance": sum(1 for s in students if s[0] in lg and s[0] not in att),
            "in_attendance_not_interactions": sum(1 for s in students if s[0] in att and s[0] not in lg),
            "roster_conflicts": dict(Counter(c["field"] for c in conflicts)),
            "staff": len(staff), "staff_active": sum(1 for p in staff.values() if (any(p["active"]) or not p["active"]) and p["left_on"] is None),
            "staff_with_password": sum(1 for p in staff.values() if p["password_hash"]),
            "staff_roles": dict(Counter(f"{m}:{r}" for _, m, r in role_rows)),
            "placeholders_skipped": dict(skipped), "instructors_without_email": len(no_email_instructors),
            "instructor_codes_on_two_logins": len(duplicate_codes),
            "instructor_assignments": len(assignments), "students_without_instructor": len(unassigned),
        }
        owner.execute("INSERT INTO core.audit_log (module, action, target, detail) VALUES ('platform', 'data_migration', 'core', %s)",
                      (json.dumps(summary),))
        owner.row_factory = tuple_row

    write_csv("roster_conflicts.csv", conflicts)
    write_csv("invalid_ids.csv", invalid)
    write_csv("students_in_logs_not_attendance.csv",
              [{"niat_id": s[0], "name": s[1], "college": s[2], "section": s[3]} for s in students if s[0] in lg and s[0] not in att])
    write_csv("students_without_instructor.csv", unassigned)
    write_csv("core_staff.csv", [{"email": p["email"], "name": p["name"], "instructor_code": p["instructor_code"] or "",
                                  "left_on": p["left_on"] or "", "has_password": bool(p["password_hash"]),
                                  "roles": " ".join(f"{m}:{r}" for m, r in sorted(p["roles"].items())),
                                  "sources": " ".join(p["sources"])} for p in sorted(staff.values(), key=lambda r: r["email"])])
    return summary


# ------------------------------------------------------------------ 6. checks

def service_grants(target_url: str) -> None:
    """Each service owns its tables, so it grants the web app's access itself (the database owner
    isn't a member of the service roles on Neon). Default privileges cover tables made later."""
    statements = {
        "attendance_svc": ["GRANT SELECT ON ALL TABLES IN SCHEMA attendance TO web_svc",
                           "ALTER DEFAULT PRIVILEGES IN SCHEMA attendance GRANT SELECT ON TABLES TO web_svc"],
        "contest_svc": ["GRANT SELECT ON ALL TABLES IN SCHEMA contest TO web_svc",
                        "ALTER DEFAULT PRIVILEGES IN SCHEMA contest GRANT SELECT ON TABLES TO web_svc"],
        "interactions_svc": ["GRANT ALL ON ALL TABLES IN SCHEMA logs TO web_svc",
                             "GRANT ALL ON ALL SEQUENCES IN SCHEMA logs TO web_svc",
                             "ALTER DEFAULT PRIVILEGES IN SCHEMA logs GRANT ALL ON TABLES TO web_svc",
                             "ALTER DEFAULT PRIVILEGES IN SCHEMA logs GRANT ALL ON SEQUENCES TO web_svc"],
        "web_svc": ["ALTER DEFAULT PRIVILEGES IN SCHEMA logs GRANT ALL ON TABLES TO interactions_svc",
                    "ALTER DEFAULT PRIVILEGES IN SCHEMA logs GRANT ALL ON SEQUENCES TO interactions_svc"],
    }
    for role, stmts in statements.items():
        with connect(as_role(target_url, role)) as conn:
            for s in stmts:
                conn.execute(s)


def check_roles(target_url: str) -> list[str]:
    failures = []

    def expect_denied(conn: psycopg.Connection, query: str, label: str) -> None:
        try:
            with conn.transaction():
                conn.execute(query)
            failures.append(f"{label}: expected permission denied")
        except psycopg.errors.InsufficientPrivilege:
            pass

    with connect(as_role(target_url, "attendance_svc")) as c:
        latest = max(int(p.name.split("_")[0]) for p in (ROOT / "services/attendance-api/migrations").glob("*.up.sql"))
        if c.execute("SELECT version, dirty FROM schema_migrations").fetchall() != [(latest, False)]:
            failures.append(f"attendance schema_migrations is not at version {latest}")
        c.execute("SELECT count(*) FROM students JOIN core.students USING (niat_id)")
        expect_denied(c, "SELECT 1 FROM contest.students LIMIT 1", "attendance_svc reading contest")
        expect_denied(c, "UPDATE core.students SET hall = hall WHERE false", "attendance_svc writing core")
    with connect(as_role(target_url, "contest_svc")) as c:
        c.execute("SELECT version_num FROM alembic_version").fetchone()
        expect_denied(c, "SELECT 1 FROM logs.students LIMIT 1", "contest_svc reading logs")
    with connect(as_role(target_url, "interactions_svc"), autocommit=False) as c:
        before = c.execute("SELECT count(*) FROM level_changes").fetchone()[0]
        row = c.execute("SELECT id, level FROM students WHERE level IS NOT NULL ORDER BY id LIMIT 1").fetchone()
        if row:
            c.execute("UPDATE students SET level = %s WHERE id = %s", ((row[1] + 1) % 8, row[0]))
            if c.execute("SELECT count(*) FROM level_changes").fetchone()[0] != before + 1:
                failures.append("logs level-change trigger did not record the change")
        c.rollback()  # test only
        expect_denied(c, "SELECT 1 FROM attendance.students LIMIT 1", "interactions_svc reading attendance")
        c.rollback()
    with connect(as_role(target_url, "web_svc")) as c:
        for table in ("core.students", "core.staff", "attendance.attendance", "contest.results", "logs.interactions"):
            c.execute(sql.SQL("SELECT 1 FROM {} LIMIT 1").format(sql.SQL(table)))
        expect_denied(c, "UPDATE attendance.students SET hall_no = hall_no WHERE false", "web_svc writing attendance")
    return failures


# ------------------------------------------------------------------ main

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rebuild", action="store_true", help="drop core, attendance, logs, contest in the target first")
    args = parser.parse_args()

    target_url = env("TARGET_URL")
    for var in [*(m["src"] for m in MODULES.values()), *ROLE_PASSWORDS.values()]:
        env(var)
    for module, m in MODULES.items():
        if conninfo_to_dict(env(m["src"])).get("host") == conninfo_to_dict(target_url).get("host"):
            sys.exit(f"{m['src']} and TARGET_URL point at the same server")

    sources = {module: connect(env(m["src"]), read_only=True) for module, m in MODULES.items()}
    with connect(target_url) as owner:
        step("1. Target: core migrations, service roles")
        prepare_target(owner, args.rebuild)
        apply_core_migrations(owner)
        setup_roles(owner)

        step("2. Module schemas, built by each service's own migrations")
        for module in MODULE_SCHEMAS:
            build_module_schema(module, target_url, sources)

        step("3. Schema comparison with the sources")
        problems = [p for module in MODULE_SCHEMAS for p in compare_schema(module, sources[module], owner)]
        if problems:
            print("\n".join(f"  {p}" for p in problems))
            sys.exit("Schemas differ from the sources; nothing was copied. Fix the differences and re-run with --rebuild.")
        print("  attendance, logs, contest: identical to their sources"
              f" (left out on purpose: {', '.join(f'{m}.{t}' for m, ts in SKIP_TABLES.items() for t in ts)})")

        step("4. Data")
        copied = {module: copy_module(module, env(MODULES[module]["src"]), target_url) for module in MODULE_SCHEMAS}

        step("5. core: students, staff, roles, instructor assignments")
        summary = build_core(owner)
        for key, value in summary.items():
            print(f"  {key}: {value}")

        step("6. Grants and checks")
        service_grants(target_url)
        failures = check_roles(target_url)
        if failures:
            print("\n".join(f"  FAILED {f}" for f in failures))
            sys.exit(1)
        print("  each service role: own schema first, cannot read other modules, cannot write core; "
              "level-change trigger works; web_svc reads every module")
    for conn in sources.values():
        conn.close()

    total = sum(sum(c.values()) for c in copied.values())
    print(f"\nDone. {total} rows copied and verified. Review files (personal data) in {OUT}")


if __name__ == "__main__":
    main()
