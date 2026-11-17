/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { SessionUser } from "@/common/auth/roles";
import { getDb } from "@/common/db/pool";
import { addDays, todayIst } from "@/common/lib/dates";
import type { CalendarDay, CalendarEntry, CalendarMonth, DayType, Hall, InternshipListItem, SheetRow, TermRow } from "@/modules/attendance/types";

/**
 * Attendance routes read straight from the attendance schema (web_svc has SELECT on
 * it), for environments where the Go attendance service isn't running. Same routes,
 * JSON and rules as services/attendance-api (internal/http, internal/stats); each
 * request is one query. Hall marks are saved here too (saveMarksFromHub); other writes still
 * need the Go service, so they answer 503.
 */

const CHANGE_NEEDS_SERVICE = "This change needs the attendance service (services/attendance-api). It isn't running on this environment.";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const err = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details } });

/* ------------------------------------------------------------------ rules (stats.go) */

type Kind = DayType | "sunday";
type Exclusion = "" | "future" | "outside_term" | "before_join" | "after_drop";
type EntryRow = { date: string; applies_to: string; day_type: string; counts: boolean; label: string };
type TermRange = { start: string; end: string };

/** Everything the rules need for one request (rules.go loadRules). */
type Rules = { today: string; terms: TermRange[]; calendar: Map<string, Map<string, EntryRow>> };

/** stats.Student: joinedOn null counts from the term start; droppedOn null while not dropped. */
type RuleStudent = { degree: string; joinedOn: string | null; droppedOn: string | null };

type Day = { date: string; kind: Kind; label: string; appliesTo: string; excluded: Exclusion; counted: boolean };

/** Calendar the end of time for the calendar view, as the Go handler does (calendarEnd). */
const CALENDAR_END = "2100-01-01";

function rulesOf(today: string, terms: TermRange[], entries: EntryRow[]): Rules {
  const calendar = new Map<string, Map<string, EntryRow>>();
  for (const e of entries) {
    const byScope = calendar.get(e.date) ?? new Map<string, EntryRow>();
    byScope.set(e.applies_to, e);
    calendar.set(e.date, byScope);
  }
  return { today, terms, calendar };
}

/** rules.go statsStudent: the drop date only applies to a dropped student. */
const ruleStudent = (degree: string, status: string, joinedOn: string | null, droppedOn: string | null): RuleStudent => ({
  degree,
  joinedOn,
  droppedOn: status === "dropped" ? droppedOn : null,
});

const weekday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

/** entryCounts: working always counts; holiday, exam and exam preparation never; an event follows its flag. */
function entryCounts(e: EntryRow) {
  if (e.day_type === "working") return true;
  if (e.day_type === "event") return e.counts;
  return false;
}

/**
 * stats.ResolveDay: the student's degree entry, else the ALL entry, else Sunday, else a
 * working day; then future, outside every term, before joining or after dropping → not
 * counted. Kind and label are filled in even for excluded days.
 */
function resolveDay(date: string, s: RuleStudent, rules: Rules): Day {
  const entries = rules.calendar.get(date);
  const entry = entries?.get(s.degree) ?? entries?.get("ALL");
  let kind: Kind = "working";
  let label = "";
  let appliesTo = "";
  let dayCounts = true;
  if (entry) {
    kind = entry.day_type as Kind;
    label = entry.label;
    appliesTo = entry.applies_to;
    dayCounts = entryCounts(entry);
  } else if (weekday(date) === 0) {
    kind = "sunday";
    dayCounts = false;
  }

  let excluded: Exclusion = "";
  if (date > rules.today) excluded = "future";
  else if (!rules.terms.some((t) => date >= t.start && date <= t.end)) excluded = "outside_term";
  else if (s.joinedOn && date < s.joinedOn) excluded = "before_join";
  else if (s.droppedOn && date > s.droppedOn) excluded = "after_drop";

  return { date, kind, label, appliesTo, excluded, counted: dayCounts && excluded === "" };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Go's "Mon 2 Jan 2006". */
const longDate = (ymd: string) => `${WEEKDAYS[weekday(ymd)]} ${Number(ymd.slice(8, 10))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}`;
const labelSuffix = (label: string) => (label ? ` (${label})` : "");

/** rules.go notCountedReason: why an admin can't mark this day. */
function notCountedReason(day: Day) {
  const when = longDate(day.date);
  switch (day.excluded) {
    case "future":
      return `${when} is in the future.`;
    case "outside_term":
      return `${when} is outside the term.`;
    case "before_join":
      return `${when} is before the student joined.`;
    case "after_drop":
      return `${when} is after the student was dropped.`;
  }
  switch (day.kind) {
    case "sunday":
      return `${when} is a Sunday.`;
    case "holiday":
      return `${when} is a holiday${labelSuffix(day.label)}.`;
    case "exam_prep":
      return `${when} is exam preparation leave${labelSuffix(day.label)}.`;
    case "exam":
      return `${when} is an exam day${labelSuffix(day.label)}.`;
    case "event":
      return `${when} is an event that does not count${labelSuffix(day.label)}.`;
  }
  return `${when} does not count.`;
}

/** time.Parse(time.DateOnly): a real calendar date like 2026-10-28. */
function isDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === v;
}
const badDate = (v: string) => `${JSON.stringify(v)} is not a date like 2026-10-28`;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Byte order, as Go's cmp.Compare and slices.Sort on strings. */
const compare = <T extends string | number>(a: T, b: T) => (a < b ? -1 : a > b ? 1 : 0);

/** students_admin.go compareHalls: "Hall 2" before "Hall 10", no hall ("") last. */
function compareHalls(a: string, b: string) {
  if ((a === "") !== (b === "")) return a === "" ? 1 : -1;
  const ma = /^(.*?)(\d+)$/.exec(a);
  const mb = /^(.*?)(\d+)$/.exec(b);
  if (ma && mb && ma[1] === mb[1]) {
    const c = compare(Number(ma[2]), Number(mb[2]));
    if (c !== 0) return c;
  }
  return compare(a, b);
}

/* ------------------------------------------------------------------ SQL */

const TERMS_JSON = `(SELECT coalesce(json_agg(json_build_object('start', start_date::text, 'end', end_date::text)), '[]'::json)
     FROM attendance.terms)`;

const entriesJson = (where: string) => `(SELECT coalesce(json_agg(json_build_object(
       'date', c.date::text, 'applies_to', c.applies_to, 'day_type', c.day_type, 'counts', c.counts, 'label', coalesce(c.label, ''))
       ORDER BY c.date, c.applies_to), '[]'::json)
     FROM attendance.calendar_days c WHERE ${where})`;

/** students.sql ListHalls: active students per hall; '' is students with no hall. */
const HALLS_SQL = `
SELECT coalesce(hall_no, '') AS hall, count(*)::int AS students
FROM attendance.students
WHERE status = 'active'
GROUP BY 1`;

/** The admin sheet: active students (optionally one hall) with their mark on $1, plus the rules for that date. */
const SHEET_SQL = `
SELECT ${TERMS_JSON} AS terms,
  ${entriesJson("c.date = $1::date")} AS entries,
  (SELECT coalesce(json_agg(json_build_object(
       'niat_id', s.niat_id, 'name', s.full_name, 'degree', s.degree_code, 'section', coalesce(s.section, ''),
       'hall_no', coalesce(s.hall_no, ''), 'status', s.status, 'joined_on', s.joined_on::text, 'dropped_on', s.dropped_on::text,
       'mark', a.status)
       ORDER BY s.degree_code, s.section, s.full_name), '[]'::json)
     FROM attendance.students s
     LEFT JOIN attendance.attendance a ON a.niat_id = s.niat_id AND a.date = $1::date
     WHERE s.status = 'active' AND ($2::text IS NULL OR coalesce(s.hall_no, '') = $2::text)) AS students`;

/** The calendar month: degrees, every term, and the stored entries from $1 to $2. */
const CALENDAR_SQL = `
SELECT (SELECT coalesce(json_agg(code), '[]'::json) FROM attendance.degrees) AS degrees,
  ${TERMS_JSON} AS terms,
  ${entriesJson("c.date BETWEEN $1::date AND $2::date")} AS entries`;

const TERMS_SQL = `
SELECT id::text, name, start_date::text AS start, end_date::text AS "end", is_current
FROM attendance.terms
ORDER BY start_date`;

/** periods.sql ListPeriodsOverlapping (INTERNSHIP, not cancelled, touching $1..$2), plus the rules for those dates. */
const istTimestamp = (col: string) => `coalesce(to_char(${col} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"'), '')`;
const INTERNSHIPS_SQL = `
WITH p AS (
  SELECT p.id, p.kind, p.start_date, p.end_date, p.completed_on, p.source, p.cancelled_at, p.created_at, p.updated_at,
         s.niat_id, s.full_name, s.degree_code, s.section, s.hall_no
  FROM attendance.student_periods p
  JOIN attendance.students s ON s.niat_id = p.niat_id
  WHERE p.kind = 'INTERNSHIP' AND p.cancelled_at IS NULL
    AND p.start_date <= $2::date AND p.end_date >= $1::date
)
SELECT
  (SELECT coalesce(json_agg(json_build_object(
       'id', p.id, 'kind', p.kind, 'start', p.start_date::text, 'end', p.end_date::text,
       'completed_on', coalesce(p.completed_on::text, ''), 'source', p.source, 'cancelled', p.cancelled_at IS NOT NULL,
       'created_at', ${istTimestamp("p.created_at")}, 'updated_at', ${istTimestamp("p.updated_at")},
       'cancelled_at', ${istTimestamp("p.cancelled_at")},
       'niat_id', p.niat_id, 'name', p.full_name, 'degree', p.degree_code, 'section', coalesce(p.section, ''),
       'hall_no', coalesce(p.hall_no, ''))
       ORDER BY p.start_date, p.full_name), '[]'::json)
     FROM p) AS periods,
  ${entriesJson("c.date BETWEEN (SELECT min(start_date) FROM p) AND (SELECT max(end_date) FROM p)")} AS entries,
  ${TERMS_JSON} AS terms`;

/* ------------------------------------------------------------------ routes */

async function listHalls() {
  const { rows } = await getDb().query<Hall>(HALLS_SQL);
  return json(200, { halls: [...rows].sort((a, b) => compareHalls(a.hall, b.hall)) });
}

type SheetStudent = {
  niat_id: string;
  name: string;
  degree: string;
  section: string;
  hall_no: string;
  status: string;
  joined_on: string | null;
  dropped_on: string | null;
  mark: string | null;
};

/** demo.go handleAdminSheet: ?date= (default today) &hall= ("hall=" alone: students with no hall). */
async function sheet(url: URL, today: string) {
  const date = url.searchParams.get("date") || today;
  if (!isDate(date)) return err(400, "bad_request", badDate(date));
  const hall = url.searchParams.has("hall") ? (url.searchParams.get("hall") ?? "").trim() : null;
  const { rows } = await getDb().query<{ terms: TermRange[]; entries: EntryRow[]; students: SheetStudent[] }>(SHEET_SQL, [date, hall]);
  const rules = rulesOf(today, rows[0].terms, rows[0].entries);
  const students: SheetRow[] = rows[0].students.map((st) => {
    const day = resolveDay(date, ruleStudent(st.degree, st.status, st.joined_on, st.dropped_on), rules);
    return {
      niat_id: st.niat_id,
      name: st.name,
      degree: st.degree,
      section: st.section,
      hall_no: st.hall_no,
      counted: day.counted,
      reason: day.counted ? "" : notCountedReason(day),
      status: st.mark === "P" || st.mark === "A" ? st.mark : null,
    };
  });
  return json(200, { date, today, students });
}

type DegreeDay = { degree: string; kind: Kind; label: string; counted: boolean; applies_to: string };

/** terms_calendar.go handleCalendarMonth: ?ym=YYYY-MM (default this month) &view=ALL|<degree>. */
async function calendarMonth(url: URL, today: string) {
  const ym = url.searchParams.get("ym") || today.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return err(400, "bad_request", "ym must look like 2026-09.");
  const first = `${ym}-01`;
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const { rows } = await getDb().query<{ degrees: string[]; terms: TermRange[]; entries: EntryRow[] }>(CALENDAR_SQL, [first, last]);
  const degrees = [...rows[0].degrees].sort(compare);
  const view = (url.searchParams.get("view") ?? "").toUpperCase() || "ALL";
  if (view !== "ALL" && !degrees.includes(view)) return err(400, "bad_request", "view must be ALL or a degree code.");

  // The calendar shows what the rules say for any date, so future dates are resolved
  // as if they had passed; only the term limits apply.
  const rules = rulesOf(CALENDAR_END, rows[0].terms, rows[0].entries);
  const stored = new Map<string, CalendarEntry[]>();
  for (const e of rows[0].entries) {
    const list = stored.get(e.date) ?? [];
    list.push({ applies_to: e.applies_to, day_type: e.day_type as DayType, counts: e.counts, label: e.label });
    stored.set(e.date, list);
  }

  const days: (CalendarDay & { by_degree: DegreeDay[] })[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const day = resolveDay(d, { degree: view, joinedOn: null, droppedOn: null }, rules);
    const byDegree = degrees.map((code): DegreeDay => {
      const dd = resolveDay(d, { degree: code, joinedOn: null, droppedOn: null }, rules);
      return { degree: code, kind: dd.kind, label: dd.label, counted: dd.counted, applies_to: dd.appliesTo };
    });
    days.push({
      date: d,
      weekday: weekday(d),
      kind: day.kind,
      label: day.label,
      applies_to: day.appliesTo,
      in_term: day.excluded !== "outside_term",
      counted: day.counted,
      entries: stored.get(d) ?? [],
      by_degree: byDegree,
    });
  }
  const month: CalendarMonth = { month: ym, view, today, applies_to: ["ALL", ...degrees], days };
  return json(200, month);
}

async function listTerms(today: string) {
  const { rows } = await getDb().query<Omit<TermRow, "id"> & { id: string }>(TERMS_SQL);
  const terms: TermRow[] = rows.map((t) => ({ id: Number(t.id), name: t.name, start: t.start, end: t.end, is_current: t.is_current }));
  return json(200, { terms, today });
}

type PeriodRow = {
  id: number;
  kind: InternshipListItem["kind"];
  start: string;
  end: string;
  completed_on: string;
  source: string;
  cancelled: boolean;
  created_at: string;
  updated_at: string;
  cancelled_at: string;
  niat_id: string;
  name: string;
  degree: string;
  section: string;
  hall_no: string;
};

/** stats.StateOf. */
function stateOf(p: PeriodRow, today: string): InternshipListItem["state"] {
  if (p.cancelled) return "cancelled";
  if (p.kind === "REGISTRATION_PENDING") return p.completed_on ? "completed" : "pending";
  if (today < p.start) return "upcoming";
  if (today > p.end) return "ended";
  return "active";
}

/** periods.go handleListInternships: internships touching ?from..to (default: this month). */
async function listInternships(url: URL, today: string) {
  let from = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split("-").map(Number);
  let to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  for (const name of ["from", "to"] as const) {
    const v = url.searchParams.get(name);
    if (!v) continue;
    if (!isDate(v)) return err(400, "bad_request", `${name}: ${badDate(v)}`);
    if (name === "from") from = v;
    else to = v;
  }
  if (to < from || daysBetween(from, to) > 400) return err(400, "bad_request", "Choose a range of at most 400 days, from before to.");

  const { rows } = await getDb().query<{ periods: PeriodRow[]; entries: EntryRow[]; terms: TermRange[] }>(INTERNSHIPS_SQL, [from, to]);
  const rules = rulesOf(today, rows[0].terms, rows[0].entries);
  let current = 0;
  const internships = rows[0].periods.map((p) => {
    // As in the Go handler, only the degree applies here (not the join or drop dates).
    const student: RuleStudent = { degree: p.degree, joinedOn: null, droppedOn: null };
    let calendarDays = 0;
    let attendanceDays = 0;
    for (let d = p.start; d <= p.end; d = addDays(d, 1)) {
      calendarDays++;
      if (resolveDay(d, student, rules).counted) attendanceDays++;
    }
    const state = stateOf(p, today);
    if (state === "active") current++;
    const item: InternshipListItem & { completed_on: string; source: string; created_at: string; updated_at: string; cancelled_at: string } = {
      id: p.id,
      kind: p.kind,
      start: p.start,
      end: p.end,
      completed_on: p.completed_on,
      source: p.source,
      state,
      calendar_days: calendarDays,
      attendance_days: attendanceDays,
      created_at: p.created_at,
      updated_at: p.updated_at,
      cancelled_at: p.cancelled_at,
      niat_id: p.niat_id,
      name: p.name,
      degree: p.degree,
      section: p.section,
      hall_no: p.hall_no,
      current: state === "active",
    };
    return item;
  });
  return json(200, { from, to, today, current, internships });
}

/* ------------------------------------------------------------------ saving marks from NxtOne */

/** Who can mark attendance in NxtOne: admins, and instructors and senior instructors for any hall. */
export const canMarkAttendance = (u: Pick<SessionUser, "role">) => u.role === "owner" || u.role === "admin" || u.role === "senior_instructor" || u.role === "instructor";

export type MarkRowError = { index: number; niat_id: string; message: string };
export type SaveMarksResult = { ok: true; saved: number; cleared: number } | { ok: false; error: string; details?: MarkRowError[] };

const MARK_RULES_SQL = `
SELECT ${TERMS_JSON} AS terms,
  ${entriesJson("c.date = ANY($1::date[])")} AS entries,
  (SELECT coalesce(json_agg(json_build_object('niat_id', s.niat_id, 'degree', s.degree_code, 'status', s.status,
       'joined_on', s.joined_on::text, 'dropped_on', s.dropped_on::text)), '[]'::json)
     FROM attendance.students s WHERE s.niat_id = ANY($2::text[])) AS students`;

/**
 * demo.go handleSaveAttendance, run by NxtOne itself (migration 000015 lets web_svc write marks):
 * every mark is checked first (known, active student; a date that counts for them; P, A or null to
 * clear) and either all are saved or none. Who marked is kept in attendance.marked_by.
 */
export async function saveMarksFromHub(user: SessionUser, marks: { niat_id: string; date: string; status: string | null }[]): Promise<SaveMarksResult> {
  if (!canMarkAttendance(user)) return { ok: false, error: "You can't mark attendance." };
  if (!Array.isArray(marks) || !marks.length) return { ok: false, error: "Send at least one mark." };
  if (marks.length > 5000) return { ok: false, error: "Too many marks at once." };
  const rows = marks.map((m) => ({ niat_id: String(m.niat_id ?? "").trim().toUpperCase(), date: String(m.date ?? ""), status: m.status ?? null }));
  const dates = [...new Set(rows.map((r) => r.date).filter(isDate))];
  const today = todayIst();
  const db = getDb();
  const { rows: loaded } = await db.query<{ terms: TermRange[]; entries: EntryRow[]; students: { niat_id: string; degree: string; status: string; joined_on: string | null; dropped_on: string | null }[] }>(
    MARK_RULES_SQL,
    [dates, [...new Set(rows.map((r) => r.niat_id))]],
  );
  const rules = rulesOf(today, loaded[0].terms, loaded[0].entries);
  const byId = new Map(loaded[0].students.map((s) => [s.niat_id, s]));
  const errors: MarkRowError[] = [];
  const set: typeof rows = [];
  const clear: typeof rows = [];
  rows.forEach((m, index) => {
    const fail = (message: string) => errors.push({ index, niat_id: m.niat_id, message });
    const st = byId.get(m.niat_id);
    if (!st) return fail("Unknown NIAT ID.");
    if (st.status !== "active") return fail("Student is not active.");
    if (!isDate(m.date)) return fail(badDate(m.date));
    if (m.status !== null && m.status !== "P" && m.status !== "A") return fail('status must be "P", "A" or null.');
    const day = resolveDay(m.date, ruleStudent(st.degree, st.status, st.joined_on, st.dropped_on), rules);
    if (!day.counted) return fail(notCountedReason(day));
    (m.status === null ? clear : set).push(m);
  });
  if (errors.length) return { ok: false, error: `${errors.length} of ${rows.length} marks were refused; nothing was saved.`, details: errors };

  const who = `${user.name} <${user.email}>`;
  const client = await (db as unknown as import("pg").Pool).connect();
  try {
    await client.query("BEGIN");
    let saved = 0;
    let cleared = 0;
    if (set.length) {
      // queries/attendance.sql UpsertMarks: a hand mark keeps the stored category when the status is unchanged.
      const r = await client.query(
        `INSERT INTO attendance.attendance (niat_id, date, status, category, updated_at, updated_by, marked_by)
         SELECT u.niat_id, u.date, u.status, NULL, now(), NULL, $4
         FROM unnest($1::text[], $2::date[], $3::text[]) AS u(niat_id, date, status)
         ON CONFLICT (niat_id, date) DO UPDATE
         SET category = CASE WHEN attendance.status = EXCLUDED.status THEN attendance.category ELSE NULL END,
             status = EXCLUDED.status, updated_at = EXCLUDED.updated_at, updated_by = NULL, marked_by = EXCLUDED.marked_by`,
        [set.map((m) => m.niat_id), set.map((m) => m.date), set.map((m) => m.status), who],
      );
      saved = r.rowCount ?? 0;
    }
    if (clear.length) {
      const r = await client.query(
        "DELETE FROM attendance.attendance a USING unnest($1::text[], $2::date[]) AS u(niat_id, date) WHERE a.niat_id = u.niat_id AND a.date = u.date",
        [clear.map((m) => m.niat_id), clear.map((m) => m.date)],
      );
      cleared = r.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return { ok: true, saved, cleared };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function attendanceDb(request: Request, path: string[], user: SessionUser): Promise<Response> {
  const url = new URL(request.url);
  const route = `${request.method} ${path.join("/")}`;
  const today = todayIst();

  if (route === "PUT admin/attendance") {
    const body = await request.json().catch(() => null);
    const result = await saveMarksFromHub(user, Array.isArray(body) ? body : []);
    if (result.ok) return json(200, { saved: result.saved, cleared: result.cleared });
    if (result.details) return err(422, "validation_failed", result.error, result.details);
    return result.error.startsWith("You can't") ? err(403, "forbidden", result.error) : err(400, "bad_request", result.error);
  }

  try {
    switch (route) {
      case "GET admin/halls":
        return await listHalls();
      case "GET admin/attendance/sheet":
        return await sheet(url, today);
      case "GET admin/calendar":
        return await calendarMonth(url, today);
      case "GET admin/terms":
        return await listTerms(today);
      case "GET admin/internships":
        return await listInternships(url, today);
    }
  } catch (error) {
    console.error(`attendance (database): ${route} failed`, error);
    return err(500, "internal", "Something went wrong. Please try again.");
  }

  if (request.method !== "GET" && request.method !== "HEAD") return err(503, "service_unavailable", CHANGE_NEEDS_SERVICE);
  return err(404, "not_found", `Reading ${path.join("/")} from the database isn't supported yet; it needs the attendance service.`);
}
