/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import "server-only";
import { isAdminRole, type SessionUser } from "@/common/auth/roles";
import type { RosterStudent } from "@/common/sample-data/roster";
import { autofillFor } from "@/modules/tests/autofill";
import { getFormatVersion, getResults, listTests, studentsFor } from "@/modules/tests/data";
import { maxTotal, tookTest, totalOf, type AutoFill, type FormatVersion, type ResultValue, type WeeklyTest } from "@/modules/tests/types";

/*
 * A weekly test's report: who took it, how they did, and for each student the filled-in attendance
 * (semester, last week) and roadmap progress. Instructors get their own students; admins everyone
 * in the band, or one instructor's. Used by the report page and its CSV download.
 */

/** incomplete: marked present but not every mark is in yet, so there is no total. */
export type ReportResult = "pass" | "below" | "incomplete" | "absent" | "missing";

export type ReportRow = {
  niatId: string;
  name: string;
  college: string;
  section: string;
  instructor: string;
  result: ReportResult;
  values: Record<string, ResultValue>;
  total: number | null;
  previous: number | null;
  auto: AutoFill | null;
  /** True when `auto` was saved with the result; false when worked out now (no result yet). */
  autoSaved: boolean;
};

export type Report = {
  test: WeeklyTest;
  format: FormatVersion;
  max: number;
  scope: { instructor: string | null; instructors: string[]; admin: boolean };
  rows: ReportRow[];
  summary: {
    students: number;
    present: number;
    incomplete: number;
    absent: number;
    missing: number;
    average: number | null;
    median: number | null;
    highest: number | null;
    lowest: number | null;
    passed: number;
    below: number;
    passRate: number | null;
    semester: number | null;
    week: number | null;
    progress: number | null;
  };
  /** Totals in five equal bands of the maximum. */
  distribution: { label: string; count: number; belowPass: boolean }[];
  fieldAverages: { label: string; average: number; max: number }[];
  attention: { row: ReportRow; reasons: string[] }[];
};

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function loadReport(test: WeeklyTest, viewer: SessionUser, instructor: string | null): Promise<Report | null> {
  const format = await getFormatVersion(test.formatId, test.version);
  if (!format) return null;
  const admin = isAdminRole(viewer.role);
  const all = await studentsFor(test, admin ? undefined : viewer.name);
  const instructors = admin ? [...new Set(all.map((s) => s.instructor).filter(Boolean))].sort() : [];
  const chosen = admin && instructor && instructors.includes(instructor) ? instructor : null;
  const students = chosen ? all.filter((s) => s.instructor === chosen) : all;
  const ids = students.map((s) => s.niatId);

  const results = await getResults(test.id, ids);
  // As saved with each result when final; otherwise (no result yet, or saved before the test day) worked out now.
  const auto = await autofillFor(test, students, results);

  // The previous test in the same band, for the change in score.
  const previous = (await listTests()).filter((t) => t.band === test.band && t.heldOn < test.heldOn).sort((a, b) => b.heldOn.localeCompare(a.heldOn))[0];
  const prevResults = previous ? await getResults(previous.id, ids) : [];
  const prevFormat = previous ? await getFormatVersion(previous.formatId, previous.version) : null;

  const rows = students.map((s: RosterStudent, i): ReportRow => {
    const r = results[i];
    const total = r?.present ? totalOf(format.fields, r.values) : null;
    const pr = prevResults[i];
    const result: ReportResult = !r ? "missing" : !r.present ? "absent" : total === null ? "incomplete" : total >= format.passMark ? "pass" : "below";
    return {
      niatId: s.niatId,
      name: s.name,
      college: s.college,
      section: s.section,
      instructor: s.instructor,
      result,
      values: r?.values ?? {},
      total,
      previous: pr?.present && prevFormat ? totalOf(prevFormat.fields, pr.values) : null,
      auto: auto[i],
      autoSaved: !!r?.auto && auto[i] === r.auto,
    };
  });
  return buildReport(test, format, rows, { instructor: chosen, instructors, admin });
}

function buildReport(test: WeeklyTest, format: FormatVersion, rows: ReportRow[], scope: Report["scope"]): Report {
  const max = maxTotal(format.fields);
  const totals = rows.map((r) => r.total).filter((t): t is number => t !== null);
  const passed = rows.filter((r) => r.result === "pass").length;
  const below = rows.filter((r) => r.result === "below").length;
  const pcts = (pick: (a: AutoFill) => number | null) => rows.map((r) => (r.auto ? pick(r.auto) : null)).filter((x): x is number => x !== null);

  const bands = 5;
  const distribution = Array.from({ length: bands }, (_, b) => {
    const lo = (max * b) / bands;
    const hi = (max * (b + 1)) / bands;
    const count = totals.filter((t) => (b === bands - 1 ? t >= lo && t <= hi : t >= lo && t < hi)).length;
    return { label: `${Math.round(lo)}–${Math.round(hi)}`, count, belowPass: hi <= format.passMark };
  });

  const fieldAverages = format.fields
    .filter((f) => f.type === "marks")
    .map((f) => ({
      label: f.label,
      max: f.max ?? 0,
      average: avg(rows.filter(tookTest).map((r) => r.values[f.id]).filter((v): v is number => typeof v === "number")) ?? 0,
    }));

  const attention = rows
    .map((row) => {
      const reasons: string[] = [];
      if (row.result === "below") reasons.push(`below pass (${row.total} / ${max})`);
      if (row.result === "absent") reasons.push("missed the test");
      if (row.auto?.week.pct !== null && row.auto?.week.pct !== undefined && row.auto.week.pct < 75) reasons.push(`attendance last week ${row.auto.week.pct}%`);
      if (row.auto?.semester.pct !== null && row.auto?.semester.pct !== undefined && row.auto.semester.pct < 75) reasons.push(`semester attendance ${row.auto.semester.pct}%`);
      if (row.total !== null && row.previous !== null && max > 0 && row.previous - row.total >= max * 0.2) reasons.push(`down ${row.previous - row.total} from last test`);
      return { row, reasons };
    })
    .filter((a) => a.reasons.length)
    .sort((a, b) => b.reasons.length - a.reasons.length || a.row.name.localeCompare(b.row.name));

  return {
    test,
    format,
    max,
    scope,
    rows,
    summary: {
      students: rows.length,
      present: rows.filter(tookTest).length,
      incomplete: rows.filter((r) => r.result === "incomplete").length,
      absent: rows.filter((r) => r.result === "absent").length,
      missing: rows.filter((r) => r.result === "missing").length,
      average: avg(totals),
      median: median(totals),
      highest: totals.length ? Math.max(...totals) : null,
      lowest: totals.length ? Math.min(...totals) : null,
      passed,
      below,
      passRate: passed + below ? Math.round((passed * 100) / (passed + below)) : null,
      semester: avg(pcts((a) => a.semester.pct)),
      week: avg(pcts((a) => a.week.pct)),
      progress: avg(pcts((a) => a.progress.percent)),
    },
    distribution,
    fieldAverages,
    attention,
  };
}
