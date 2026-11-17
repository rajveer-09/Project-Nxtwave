#
# Author : Rajveer Sharma
# Date : 14 Nov 2026
# @ Nxtwave
#

"""
Read-only dry run of the roster and staff merge (ARCHITECTURE.md §11, steps 3–5).

Connects to the three source databases in read-only sessions, builds the merged
core.students / core.staff / core.student_assignments rows in memory, and writes
review files. Nothing is written to any database.

Usage (from the repo root):
    python -I db/migration/roster_dry_run.py

Reads connection strings from environment variables (never pass them on the
command line): SRC_ATTENDANCE_URL, SRC_LOGS_URL, SRC_CONTEST_URL.

Output:
  - stdout: counts only (no names or IDs)
  - db/migration/out/*.csv: row-level review files. These contain student and
    staff personal data; the folder is git-ignored. Delete after review.
"""

from __future__ import annotations

import csv
import os
import re
import sys
from collections import Counter
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

NIAT = re.compile(r"^N\d{2}H\d{2}[AB]\d{4}$")
OUT = Path(__file__).resolve().parent / "out"


def fetch(env: str, sql: str) -> list[dict]:
    url = os.environ.get(env)
    if not url:
        sys.exit(f"Missing environment variable {env}")
    with psycopg.connect(url, connect_timeout=20) as conn:
        conn.read_only = True
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql)
            return cur.fetchall()


def norm(text: str | None) -> str:
    return " ".join((text or "").split()).casefold()


def hall(text: str | None) -> str | None:
    value = " ".join((text or "").split())
    m = re.fullmatch(r"(?i)hall\s*(\d+)", value)
    return f"Hall {int(m.group(1))}" if m else (value or None)


def write_csv(name: str, rows: list[dict]) -> None:
    OUT.mkdir(exist_ok=True)
    path = OUT / name
    with path.open("w", newline="", encoding="utf-8") as f:
        if not rows:
            f.write("")
            return
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    att = {r["niat_id"].strip().upper(): r for r in fetch(
        "SRC_ATTENDANCE_URL",
        "select niat_id, full_name, degree_code, section, hall_no, status, joined_on, dropped_on from students")}
    logs = {r["id"].strip().upper(): r for r in fetch(
        "SRC_LOGS_URL",
        "select id, name, degree, section, hall, instructor_id, status from students")}
    contest_rows = fetch("SRC_CONTEST_URL", "select roll_no, name, extra::text as extra, active from students")
    contest = {r["roll_no"].strip().upper(): r for r in contest_rows}

    all_ids = set(att) | set(logs) | set(contest)
    valid = {i for i in all_ids if NIAT.match(i)}
    invalid = sorted(all_ids - valid)

    merged, conflicts = [], []
    for nid in sorted(valid):
        a, l, c = att.get(nid), logs.get(nid), contest.get(nid)
        # Source of truth for roster fields: Interactions (logs), then Attendance, then Contests.
        name = (l or {}).get("name") or (a or {}).get("full_name") or (c or {}).get("name")
        college = ((l or {}).get("degree") or (a or {}).get("degree_code") or "").upper() or ("CDU" if nid[6] == "B" else "BITS")
        section = (l or {}).get("section") or (a or {}).get("section") or ""
        hall_v = hall((l or {}).get("hall") or (a or {}).get("hall_no"))
        status = (a or {}).get("status") or "active"
        merged.append({"niat_id": nid, "full_name": " ".join((name or "").split()), "college": college,
                       "section": section, "hall": hall_v, "status": status,
                       "joined_on": (a or {}).get("joined_on"), "dropped_on": (a or {}).get("dropped_on"),
                       "in_attendance": a is not None, "in_logs": l is not None, "in_contest": c is not None})
        if a and l:
            for field, av, lv in [("name", a["full_name"], l["name"]), ("section", a["section"], l["section"]),
                                  ("hall", hall(a["hall_no"]), hall(l["hall"]))]:
                if norm(av) != norm(lv):
                    conflicts.append({"niat_id": nid, "field": field, "attendance": av, "logs (kept)": lv})
        # college letter rule: 7th character A = BITS, B = CDU
        expected = "CDU" if nid[6] == "B" else "BITS"
        if college != expected:
            conflicts.append({"niat_id": nid, "field": "college vs NIAT letter", "attendance": college, "logs (kept)": expected})

    # Staff: Interactions users are the base; map Attendance admins and real NxtRank users by email
    l_users = fetch("SRC_LOGS_URL", "select u.email, u.name, u.role, u.is_senior, i.id as instructor_code, i.left_on "
                                    "from users u left join instructors i on i.id = u.instructor_id")
    a_admins = fetch("SRC_ATTENDANCE_URL", "select email, name, role, active from admins")
    c_users = fetch("SRC_CONTEST_URL", "select username as email, display_name as name, role, is_super, active from users")

    staff: dict[str, dict] = {}
    for u in l_users:
        staff[u["email"].strip().lower()] = {"email": u["email"].strip().lower(), "name": u["name"],
                                             "instructor_code": u["instructor_code"], "left_on": u["left_on"],
                                             "logs_role": "senior_instructor" if u["is_senior"] else u["role"],
                                             "attendance_role": "", "contest_role": "", "source": "logs"}
    skipped_placeholder = 0
    for u in a_admins:
        email = u["email"].strip().lower()
        if email.endswith("demo.local"):
            skipped_placeholder += 1
            continue
        row = staff.setdefault(email, {"email": email, "name": u["name"], "instructor_code": None, "left_on": None,
                                       "logs_role": "", "attendance_role": "", "contest_role": "", "source": "attendance"})
        row["attendance_role"] = u["role"]
    for u in c_users:
        email = u["email"].strip().lower()
        if "@" not in email or email.endswith(("@example.com", "@admin.com")):
            skipped_placeholder += 1
            continue
        row = staff.setdefault(email, {"email": email, "name": u["name"] or email, "instructor_code": None, "left_on": None,
                                       "logs_role": "", "attendance_role": "", "contest_role": "", "source": "contest"})
        row["contest_role"] = ("owner" if u["is_super"] else u["role"])

    staff_rows = sorted(staff.values(), key=lambda r: r["email"])
    unmatched_assign = [{"niat_id": nid, "name": r["name"]} for nid, r in logs.items() if not r["instructor_id"]]
    logs_only = [{"niat_id": m["niat_id"], "name": m["full_name"], "college": m["college"], "section": m["section"]}
                 for m in merged if m["in_logs"] and not m["in_attendance"]]

    write_csv("core_students_preview.csv", merged)
    write_csv("roster_conflicts.csv", conflicts)
    write_csv("students_in_logs_not_attendance.csv", logs_only)
    write_csv("invalid_ids.csv", [{"id": i} for i in invalid])
    write_csv("core_staff_preview.csv", staff_rows)
    write_csv("students_without_instructor.csv", unmatched_assign)

    print("ROSTER")
    print(f"  source rows: attendance={len(att)} logs={len(logs)} contest={len(contest)}")
    print(f"  merged core.students={len(merged)}  invalid IDs skipped={len(invalid)}")
    print(f"  in all three={sum(1 for m in merged if m['in_attendance'] and m['in_logs'] and m['in_contest'])}")
    print(f"  in logs but not attendance={len(logs_only)}  by college={dict(Counter(r['college'] for r in logs_only))}")
    print(f"  field conflicts={dict(Counter(c['field'] for c in conflicts))}")
    print(f"  colleges={dict(Counter(m['college'] for m in merged))}")
    print("STAFF")
    print(f"  core.staff={len(staff_rows)}  by first source={dict(Counter(r['source'] for r in staff_rows))}")
    print(f"  placeholder accounts skipped={skipped_placeholder}")
    print(f"  with roles in 2+ modules={sum(1 for r in staff_rows if sum(bool(r[k]) for k in ('logs_role', 'attendance_role', 'contest_role')) >= 2)}")
    print("ASSIGNMENTS")
    print(f"  students with a matched instructor={len(logs) - len(unmatched_assign)}  without={len(unmatched_assign)}")
    print(f"Review files written to {OUT} (contain personal data; git-ignored).")


if __name__ == "__main__":
    main()
