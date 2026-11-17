/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { SessionUser } from "@/common/auth/roles";
import type { CalendarDay, CalendarMonth, DayType, InternshipListItem, MarkInput, SheetRow, TermRow } from "@/modules/attendance/types";
import { addDays, todayIst } from "@/common/lib/dates";
import { ROSTER } from "@/common/sample-data/roster";

/**
 * Sample attendance service: the same routes and JSON as the Go API
 * (services/attendance-api/internal/http), backed by memory. Used only in
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
        m.set(`${s.niatId}|${d}`, (seed % 100) < s.attendance30d ? "P" : "A");
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
    if (!isAdmin(user)) return err(403, "forbidden", "Only admins can mark attendance.");
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

  return err(404, "not_found", `The sample attendance service doesn't implement ${route} yet.`);
}
