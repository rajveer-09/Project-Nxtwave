/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { SessionUser } from "@/common/auth/roles";
import type { CalendarDay, CalendarMonth, DayType, InternshipListItem, MarkInput, SheetRow, TermRow } from "@nxtone/attendance-ui/types";
import { addDays, todayIst } from "@/common/lib/dates";
import { ROSTER } from "@/common/sample-data/roster";

/**
 * Sample attendance service: the same routes and JSON as the Go API
 * (modules/attendance/backend/internal/http), backed by memory. Used only in
 * development when ATTENDANCE_API_ORIGIN isn't set. Marks survive until the dev
 * server restarts.
 */

const TERM: TermRow = { id: 5, name: "Term 5", start: "2026-08-03", end: "2026-12-19", is_current: true };
const TERMS: TermRow[] = [{ id: 4, name: "Term 4", start: "2026-03-02", end: "2026-07-18", is_current: false }, TERM];

/** Sample calendar entries (fictional labels). */
const CALENDAR: { date: string; applies_to: string; day_type: DayType; counts: boolean; label: string }[] = [
  { date: "2026-11-20", applies_to: "ALL", day_type: "holiday", counts: false, label: "Holiday (sample)" },
  { date: "2026-11-24", applies_to: "BITS", day_type: "exam", counts: false, label: "Mid-term exam (sample)" },
  { date: "2026-11-25", applies_to: "BITS", day_type: "exam", counts: false, label: "Mid-term exam (sample)" },
  { date: "2026-11-23", applies_to: "BITS", day_type: "exam_prep", counts: false, label: "Exam preparation (sample)" },
  { date: "2026-11-28", applies_to: "ALL", day_type: "event", counts: true, label: "Hackathon day (sample)" },
];

const store = globalThis as unknown as { __attendanceMarks?: Map<string, "P" | "A"> };
function marks() {
  if (!store.__attendanceMarks) {
    // Seed: every counted past day this term, marked from each student's 30-day percentage.
    const m = new Map<string, "P" | "A">();
    const today = todayIst();
    for (const s of ROSTER) {
      let seed = [...s.niatId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
      for (let d = addDays(today, -40); d < today; d = addDays(d, 1)) {
        if (!resolve(d, s.college, today).counted) continue;
        seed = (seed * 1103515245 + 12345) >>> 0;
        m.set(`${s.niatId}|${d}`, (seed % 100) < (s.attendance30d ?? 0) ? "P" : "A");
      }
    }
    store.__attendanceMarks = m;
  }
  return store.__attendanceMarks;
}

const weekday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

/** Same order of rules as stats.ResolveDay in the Go service. */
function resolve(date: string, degree: string, today: string): { counted: boolean; reason: string; kind: CalendarDay["kind"]; label: string; applies_to: string } {
  if (date < TERM.start || date > TERM.end) return { counted: false, reason: "Outside the current term.", kind: "working", label: "", applies_to: "" };
  const entry = CALENDAR.find((e) => e.date === date && e.applies_to === degree) ?? CALENDAR.find((e) => e.date === date && e.applies_to === "ALL");
  if (date > today) {
    return { counted: false, reason: "Date is in the future.", kind: entry?.day_type ?? (weekday(date) === 0 ? "sunday" : "working"), label: entry?.label ?? "", applies_to: entry?.applies_to ?? "" };
  }
  if (entry) return { counted: entry.counts, reason: entry.counts ? "" : `${entry.label}.`, kind: entry.day_type, label: entry.label, applies_to: entry.applies_to };
  if (weekday(date) === 0) return { counted: false, reason: "Sunday.", kind: "sunday", label: "Sunday", applies_to: "" };
  return { counted: true, reason: "", kind: "working", label: "", applies_to: "" };
}

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const err = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details } });
const isAdmin = (u: SessionUser) => u.role === "owner" || u.role === "admin";
/** Same as canMarkAttendance (db-service): every staff role marks; the sample used to allow admins only. */
const canMark = (u: SessionUser) => isAdmin(u) || u.role === "senior_instructor" || u.role === "instructor" || u.role === "success_coach";
/** Attendance analytics: Owners and success coaches (19 Nov 2026). */
const canSeeAnalytics = (u: SessionUser) => u.role === "owner" || u.role === "success_coach";

export async function attendanceSample(request: Request, path: string[], user: SessionUser): Promise<Response> {
  const url = new URL(request.url);
  const route = `${request.method} ${path.join("/")}`;
  const today = todayIst();

  if (route === "GET admin/halls") {
    const counts = new Map<string, number>();
    for (const s of ROSTER) counts.set(s.hall, (counts.get(s.hall) ?? 0) + 1);
    const halls = [...counts.entries()]
      .map(([hall, students]) => ({ hall, students }))
      .sort((a, b) => Number(a.hall.split(" ")[1]) - Number(b.hall.split(" ")[1]));
    return json(200, { halls });
  }

  if (route === "GET admin/attendance/sheet") {
    const date = url.searchParams.get("date") || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "bad_request", "Use a date like 2026-11-16.");
    const hall = url.searchParams.get("hall");
    const m = marks();
    const students: SheetRow[] = ROSTER.filter((s) => hall === null || s.hall === hall)
      .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name))
      .map((s) => {
        const day = resolve(date, s.college, today);
        return { niat_id: s.niatId, name: s.name, degree: s.college, section: s.section, hall_no: s.hall, counted: day.counted, reason: day.reason, status: m.get(`${s.niatId}|${date}`) ?? null };
      });
    return json(200, { date, today, students });
  }

  if (route === "PUT admin/attendance") {
    if (!canMark(user)) return err(403, "forbidden", "Your role can't mark attendance.");
    let input: MarkInput[];
    try {
      input = (await request.json()) as MarkInput[];
    } catch {
      return err(400, "bad_request", "Send a non-empty JSON array of marks.");
    }
    if (!Array.isArray(input) || input.length === 0 || input.length > 5000) return err(400, "bad_request", "Send a non-empty JSON array of marks.");
    // All rows are checked first; if any fails nothing is saved (as in the Go handler).
    const errors: { index: number; niat_id: string; message: string }[] = [];
    input.forEach((row, index) => {
      const s = ROSTER.find((x) => x.niatId === String(row?.niat_id ?? "").toUpperCase());
      if (!s) return errors.push({ index, niat_id: String(row?.niat_id), message: "Unknown student." });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date))) return errors.push({ index, niat_id: s.niatId, message: "Bad date." });
      if (row.status !== "P" && row.status !== "A" && row.status !== null) return errors.push({ index, niat_id: s.niatId, message: "Status must be P, A or null." });
      const day = resolve(row.date, s.college, today);
      if (!day.counted) errors.push({ index, niat_id: s.niatId, message: day.reason || "This day doesn't count." });
    });
    if (errors.length) return err(422, "invalid_rows", `${errors.length} row(s) can't be saved. Nothing was saved.`, errors);
    const m = marks();
    let saved = 0;
    let cleared = 0;
    for (const row of input) {
      const key = `${row.niat_id.toUpperCase()}|${row.date}`;
      if (row.status === null) {
        if (m.delete(key)) cleared++;
      } else {
        m.set(key, row.status);
        saved++;
      }
    }
    return json(200, { saved, cleared });
  }

  if (route === "GET admin/calendar") {
    const ym = url.searchParams.get("ym") || today.slice(0, 7);
    const view = url.searchParams.get("view") || "ALL";
    if (!/^\d{4}-\d{2}$/.test(ym)) return err(400, "bad_request", "Use a month like 2026-11.");
    const days: CalendarDay[] = [];
    for (let d = `${ym}-01`; d.startsWith(ym); d = addDays(d, 1)) {
      const r = resolve(d, view === "ALL" ? "ALL" : view, "9999-12-31");
      days.push({
        date: d,
        weekday: weekday(d),
        kind: r.kind,
        label: r.label,
        applies_to: r.applies_to,
        in_term: d >= TERM.start && d <= TERM.end,
        counted: r.counted && d <= today,
        entries: CALENDAR.filter((e) => e.date === d).map(({ applies_to, day_type, counts, label }) => ({ applies_to, day_type, counts, label })),
      });
    }
    const month: CalendarMonth = { month: ym, view, today, applies_to: ["ALL", "BITS", "CDU"], days };
    return json(200, month);
  }

  if (route === "GET admin/terms") return json(200, { terms: TERMS, today });

  if (route === "GET admin/internships") {
    const pick = ROSTER.filter((s) => s.niatId.endsWith("8") || s.niatId.endsWith("3")).slice(0, 6);
    const internships: InternshipListItem[] = pick.map((s, i) => {
      const start = addDays(today, -10 + i * 4);
      const end = addDays(start, 14);
      const state = start > today ? "upcoming" : end < today ? "ended" : "active";
      return { id: 100 + i, kind: i === 5 ? "REGISTRATION_PENDING" : "INTERNSHIP", start, end, state, calendar_days: 15, attendance_days: 13, niat_id: s.niatId, name: s.name, degree: s.college, section: s.section, hall_no: s.hall, current: state === "active" };
    });
    return json(200, { from: url.searchParams.get("from"), to: url.searchParams.get("to"), today, current: internships.filter((x) => x.current).length, internships });
  }

  if (route.startsWith("GET admin/analytics")) {
    if (!canSeeAnalytics(user)) return err(403, "forbidden", "Only Owners and success coaches can see attendance analytics.");
    const input = analyticsInput(url, today);
    if ("error" in input) return input.error;
    if (route === "GET admin/analytics") return json(200, analyticsReport(input, today));
    if (route === "GET admin/analytics/students") {
      const show = url.searchParams.get("show") || "all";
      if (!["all", "present", "absent", "unmarked"].includes(show)) return err(400, "bad_request", 'show must be "all", "present", "absent" or "unmarked".');
      return json(200, { from: input.from, to: input.to, show, students: studentTallies(input, today, show) });
    }
    if (route === "GET admin/analytics/export.xlsx") {
      return err(503, "service_unavailable", "Excel export needs the attendance service; the sample data can't build a workbook.");
    }
  }

  if (route.startsWith("POST admin/imports/") || route === "PUT admin/calendar/entries") {
    if (!isAdmin(user)) return err(403, "forbidden", "Only admins can import.");
    return err(503, "service_unavailable", "Imports read .xlsx and .csv files in the attendance service, which isn't connected here (sample data). Nothing was saved.");
  }

  if (route === "GET admin/exports/attendance") {
    if (!isAdmin(user)) return err(403, "forbidden", "Only admins can export attendance.");
    const from = url.searchParams.get("from") || today;
    const to = url.searchParams.get("to") || from;
    if (![from, to].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) || from > to || to > today) return err(400, "bad_range", "Pick dates up to today, with From on or before To.");
    if (daysBetween(from, to) > 62) return err(400, "bad_range", "Export at most 62 days at a time.");
    return json(200, sampleExport(from, to, today));
  }
  if (route === "GET admin/exports/attendance.xlsx") {
    return err(503, "service_unavailable", "Excel export needs the attendance service; the sample data can't build a workbook. Use Copy instead.");
  }

  return err(404, "not_found", `The sample attendance service doesn't implement ${route} yet.`);
}

/* ---------- Export for the master sheet (internal/http/exports.go), over the sample ---------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sheetHeader = (ymd: string) => `${Number(ymd.slice(8))}-${MONTHS[Number(ymd.slice(5, 7)) - 1]}-${ymd.slice(0, 4)}`;

function sampleExport(from: string, to: string, today: string) {
  const m = marks();
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  const degrees = ["BITS", "CDU"].map((degree) => {
    let unmarked = 0;
    // The sample has no import file, so the order is section then name and every student is "unordered".
    const students = ROSTER.filter((s) => s.college === degree).sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
    const rows = students.map((s) => ({
      niat_id: s.niatId,
      name: s.name,
      section: s.section,
      dropped: false,
      values: dates.map((d) => {
        const mark = m.get(`${s.niatId}|${d}`);
        if (mark) return mark === "P" ? "Present" : "Absent";
        const day = resolve(d, s.college, today);
        if (day.counted) unmarked++;
        if (d > today) return "";
        if (day.kind === "holiday") return day.label || "Holiday";
        if (day.kind === "exam") return day.label || "Exam";
        if (day.kind === "exam_prep") return day.label || "Exam Preparation";
        if (day.kind === "sunday") return "Sunday";
        return "";
      }),
    }));
    return { degree, rows, unmarked, unordered: rows.length };
  });
  return { from, to, today, dates, headers: dates.map(sheetHeader), degrees };
}

/* ---------- Analytics: the Go handler (internal/http/analytics.go) and stats.Analyze, over the sample ---------- */

type Tally = { students: number; present: number; absent: number; unmarked: number; unmarked_students: number; working_days: number; pct: number | null; avg_present: number | null; avg_absent: number | null };
type Input = { period: string; from: string; to: string; filter: { degree: string; hall: string | null; section: string }; selected: (s: (typeof ROSTER)[number]) => boolean };

const round1 = (v: number) => Math.round(v * 10) / 10;
const pct2 = (part: number, whole: number) => (whole === 0 ? null : Math.round((part * 10000) / whole) / 100);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
const hallNumber = (h: string) => Number(/\d+/.exec(h)?.[0] ?? Number.MAX_SAFE_INTEGER);
const hallLess = (a: string, b: string) => (a === "" || b === "" ? (b === "" ? (a === "" ? 0 : -1) : 1) : hallNumber(a) - hallNumber(b) || a.localeCompare(b));

function presetRange(period: string, today: string): [string, string] | null {
  if (period === "today") return [today, today];
  if (period === "last7") return [addDays(today, -6), today];
  if (period === "lastmonth") {
    const first = `${today.slice(0, 7)}-01`;
    const prevLast = addDays(first, -1);
    return [`${prevLast.slice(0, 7)}-01`, prevLast];
  }
  return null;
}

function comparePeriod(period: string, from: string, to: string): [string, string] {
  if (period === "lastmonth") return presetRange("lastmonth", from)!;
  const n = daysBetween(from, to);
  return [addDays(from, -n), addDays(from, -1)];
}

function analyticsInput(url: URL, today: string): Input | { error: Response } {
  const q = url.searchParams;
  let period = q.get("period") || "";
  let from: string;
  let to: string;
  if (period === "" || period === "custom") {
    const f = q.get("from");
    const t = q.get("to");
    if (f && t) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t) || f > t) return { error: err(400, "bad_range", "Use from and to like 2026-11-01, with from on or before to.") };
      [from, to, period] = [f, t, "custom"];
    } else [from, to, period] = [today, today, "today"];
  } else {
    const range = presetRange(period, today);
    if (!range) return { error: err(400, "bad_range", 'period must be "today", "last7", "lastmonth" or "custom".') };
    [from, to] = range;
  }
  const degree = (q.get("degree") ?? "").trim().toUpperCase();
  const section = (q.get("section") ?? "").trim().toUpperCase();
  const hall = q.has("hall") ? (q.get("hall") ?? "").trim() : null;
  const selected = (s: (typeof ROSTER)[number]) => (!degree || s.college === degree) && (hall === null || s.hall === hall) && (!section || s.section.toUpperCase() === section);
  return { period, from, to, filter: { degree, hall, section }, selected };
}

/** stats.eachStudentDay: every counted working day of every selected student in from..to. */
function eachStudentDay(input: Pick<Input, "selected">, from: string, to: string, today: string, fn: (i: number, day: string, mark: "P" | "A" | null) => void) {
  const m = marks();
  // A date is a working day for a degree when any student of that degree has a mark on a counted day.
  const working = new Map<string, Set<string>>();
  for (const s of ROSTER) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!m.has(`${s.niatId}|${d}`) || !resolve(d, s.college, today).counted) continue;
      if (!working.has(s.college)) working.set(s.college, new Set());
      working.get(s.college)!.add(d);
    }
  }
  ROSTER.forEach((s, i) => {
    if (!input.selected(s)) return;
    const w = working.get(s.college);
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (w?.has(d) && resolve(d, s.college, today).counted) fn(i, d, m.get(`${s.niatId}|${d}`) ?? null);
    }
  });
}

function newAcc() {
  return { present: 0, absent: 0, unmarked: 0, students: new Set<number>(), unmarkedStudents: new Set<number>(), days: new Set<string>() };
}
type Acc = ReturnType<typeof newAcc>;
function add(a: Acc, i: number, day: string, mark: "P" | "A" | null) {
  a.students.add(i);
  a.days.add(day);
  if (mark === "P") a.present++;
  else if (mark === "A") a.absent++;
  else {
    a.unmarked++;
    a.unmarkedStudents.add(i);
  }
}
function done(a: Acc): Tally {
  const wd = a.days.size;
  return {
    students: a.students.size,
    present: a.present,
    absent: a.absent,
    unmarked: a.unmarked,
    unmarked_students: a.unmarkedStudents.size,
    working_days: wd,
    pct: pct2(a.present, a.present + a.absent),
    avg_present: wd ? round1(a.present / wd) : null,
    avg_absent: wd ? round1(a.absent / wd) : null,
  };
}

function analyze(input: Pick<Input, "selected">, from: string, to: string, today: string) {
  const total = newAcc();
  const degrees = new Map<string, Acc>();
  const halls = new Map<string, { degree: string; hall: string; acc: Acc }>();
  const daily = new Map<string, Acc>();
  eachStudentDay(input, from, to, today, (i, day, mark) => {
    const s = ROSTER[i];
    if (!degrees.has(s.college)) degrees.set(s.college, newAcc());
    const hk = `${s.college}\u0000${s.hall}`;
    if (!halls.has(hk)) halls.set(hk, { degree: s.college, hall: s.hall, acc: newAcc() });
    if (!daily.has(day)) daily.set(day, newAcc());
    for (const a of [total, degrees.get(s.college)!, halls.get(hk)!.acc, daily.get(day)!]) add(a, i, day, mark);
  });
  return {
    total: done(total),
    degrees: [...degrees.entries()].map(([degree, a]) => ({ degree, ...done(a) })).sort((a, b) => a.degree.localeCompare(b.degree)),
    halls: [...halls.values()]
      .map((h) => ({ degree: h.degree, ...(h.hall ? { hall: h.hall } : {}), ...done(h.acc) }))
      .sort((a, b) => a.degree.localeCompare(b.degree) || hallLess(a.hall ?? "", b.hall ?? "")),
    daily: [...daily.entries()]
      .map(([date, a]) => {
        const t = done(a);
        return { date, students: t.students, present: t.present, absent: t.absent, unmarked: t.unmarked, pct: t.pct };
      })
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** stats.extremes: best / worst only when at least two groups have a % and they differ. */
function extremes(groups: { pct: number | null }[], name: (i: number) => string) {
  const withPct = groups.map((g, i) => ({ pct: g.pct, i })).filter((g): g is { pct: number; i: number } => g.pct !== null);
  const none = { top: [] as string[], topPct: null as number | null, bottom: [] as string[], bottomPct: null as number | null };
  if (withPct.length < 2) return none;
  const hi = Math.max(...withPct.map((g) => g.pct));
  const lo = Math.min(...withPct.map((g) => g.pct));
  if (hi === lo) return none;
  return { top: withPct.filter((g) => g.pct === hi).map((g) => name(g.i)), topPct: hi, bottom: withPct.filter((g) => g.pct === lo).map((g) => name(g.i)), bottomPct: lo };
}

function analyticsReport(input: Input, today: string) {
  const a = analyze(input, input.from, input.to, today);
  let [pFrom, pTo] = comparePeriod(input.period, input.from, input.to);
  if (input.from === input.to) {
    // One day is compared with the previous working day, up to 14 days back.
    for (let k = 1; k <= 14; k++) {
      const d = addDays(input.from, -k);
      if (analyze(input, d, d, today).total.working_days > 0) {
        [pFrom, pTo] = [d, d];
        break;
      }
    }
  }
  const prev = analyze(input, pFrom, pTo, today).total;
  const deg = extremes(a.degrees, (i) => a.degrees[i].degree);
  const hall = extremes(a.halls, (i) => `${a.halls[i].degree} · ${a.halls[i].hall || "No hall"}`);
  const options = { degrees: [] as string[], halls: [] as { degree: string; value: string }[], sections: [] as { degree: string; value: string }[] };
  const seen = new Set<string>();
  for (const s of ROSTER) {
    for (const [kind, key, value] of [["d", s.college, s.college], ["h", `${s.college}\u0000${s.hall}`, s.hall], ["s", `${s.college}\u0000${s.section}`, s.section]] as const) {
      if (seen.has(kind + key)) continue;
      seen.add(kind + key);
      if (kind === "d") options.degrees.push(value);
      else (kind === "h" ? options.halls : options.sections).push({ degree: s.college, value });
    }
  }
  options.degrees.sort();
  options.halls.sort((x, y) => hallLess(x.value, y.value));
  options.sections.sort((x, y) => x.value.localeCompare(y.value));
  return {
    period: input.period,
    from: input.from,
    to: input.to,
    today,
    days: daysBetween(input.from, input.to),
    generated_at: new Date().toISOString(),
    filter: input.filter,
    options,
    ...a,
    insights: {
      top_degrees: deg.top,
      top_degree_pct: deg.topPct,
      top_halls: hall.top,
      top_hall_pct: hall.topPct,
      bottom_halls: hall.bottom,
      bottom_hall_pct: hall.bottomPct,
      change: a.total.pct !== null && prev.pct !== null ? Math.round((a.total.pct - prev.pct) * 100) / 100 : null,
      prev_pct: prev.pct,
    },
    previous: { from: pFrom, to: pTo, total: prev },
  };
}

/** stats.StudentTallies with the handler's student fields. */
function studentTallies(input: Input, today: string, show: string) {
  const by = new Map<number, { present: number; absent: number; unmarked: number }>();
  eachStudentDay(input, input.from, input.to, today, (i, _day, mark) => {
    const t = by.get(i) ?? { present: 0, absent: 0, unmarked: 0 };
    if (mark === "P") t.present++;
    else if (mark === "A") t.absent++;
    else t.unmarked++;
    by.set(i, t);
  });
  return [...by.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, t]) => show === "all" || (show === "present" && t.present > 0) || (show === "absent" && t.absent > 0) || (show === "unmarked" && t.unmarked > 0))
    .map(([i, t]) => {
      const s = ROSTER[i];
      return { niat_id: s.niatId, name: s.name, degree: s.college, section: s.section, hall_no: s.hall, ...t, pct: pct2(t.present, t.present + t.absent) };
    });
}
