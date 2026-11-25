/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import "server-only";
import { isAdminRole, type SessionUser } from "@/common/auth/roles";
import { todayIst } from "@/common/lib/dates";
import type { RosterStudent } from "@/common/sample-data/roster";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { autofillFor, weekDays, weekRange, asOfDay, type WeekDay } from "@/modules/tests/autofill";
import { getFormatVersion, getResults, listTests, studentsFor } from "@/modules/tests/data";
import type { ReportResult } from "@/modules/tests/report";
import { hasTeluguText, maxTotal, totalOf, type AutoFill, type FieldType, type FormatVersion, type ResultValue, type TestResult, type WeeklyTest } from "@/modules/tests/types";

/*
 * One student's weekly test report: score and how it compares, attendance (semester, and the week
 * up to the test day, day by day), roadmap progress, the score history, and the instructor's
 * feedback (with their own Telugu wording where they wrote one). Instructors get their own students;
 * admins anyone in the band. Rendered by components/student-report-sheet.tsx in English or Telugu.
 */

export type StudentReport = {
  test: { id: string; name: string; band: string; heldOn: string };
  student: { niatId: string; name: string; section: string; level: number; instructor: string };
  result: ReportResult;
  total: number | null;
  max: number;
  passMark: number;
  /** The student's last weekly test before this one with a total. */
  previous: { name: string; total: number; max: number } | null;
  /** Average total of everyone in the band who took the test with all marks in. */
  average: number | null;
  marks: { id: string; label: string; labelTe: string | null; value: number | null; max: number; average: number | null }[];
  feedback: { id: string; label: string; labelTe: string | null; type: FieldType; value: ResultValue; valueTe: string | null }[];
  auto: AutoFill | null;
  week: WeekDay[];
  weekRange: { from: string; to: string };
  roadmap: { topics: string[]; levelTitle: string };
  /** Oldest first, this test last when it has a total; up to 6. */
  history: { name: string; heldOn: string; pct: number; total: number; max: number; passPct: number; current: boolean }[];
  /** Who wrote the result, and when. */
  enteredBy: string | null;
  enteredOn: string | null;
  generatedOn: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const pct = (n: number, of: number) => (of ? Math.round((n * 100) / of) : 0);

/**
 * Reports for `niatId` alone, or for every student in scope (optionally one instructor's, for admins).
 * Null when the test's format is missing.
 */
export async function loadStudentReports(
  test: WeeklyTest,
  viewer: SessionUser,
  opts: { niatId?: string; instructor?: string | null },
): Promise<{ reports: StudentReport[]; instructors: string[]; instructor: string | null; format: FormatVersion } | null> {
  const format = await getFormatVersion(test.formatId, test.version);
  if (!format) return null;
  const admin = isAdminRole(viewer.role);
  const band = await studentsFor(test);
  const visible = admin ? band : band.filter((s) => s.instructor === viewer.name);
  const instructors = admin ? [...new Set(visible.map((s) => s.instructor).filter(Boolean))].sort() : [];
  const chosen = admin && opts.instructor && instructors.includes(opts.instructor) ? opts.instructor : null;
  const students: RosterStudent[] = opts.niatId
    ? visible.filter((s) => s.niatId === opts.niatId)
    : chosen
      ? visible.filter((s) => s.instructor === chosen)
      : visible;
  if (!students.length) return { reports: [], instructors, instructor: chosen, format };

  // Averages over the whole band, whoever is looking.
  const bandResults = await getResults(test.id, band.map((s) => s.niatId));
  const byId = new Map<string, TestResult>();
  band.forEach((s, i) => bandResults[i] && byId.set(s.niatId, bandResults[i]!));
  const took = [...byId.values()].filter((r) => r.present);
  const average = avg(took.map((r) => totalOf(format.fields, r.values)).filter((t): t is number => t !== null));
  const fieldAverage = new Map(
    format.fields
      .filter((f) => f.type === "marks")
      .map((f) => [f.id, avg(took.map((r) => r.values[f.id]).filter((v): v is number => typeof v === "number"))] as const),
  );

  const ids = students.map((s) => s.niatId);
  const results = ids.map((id) => byId.get(id) ?? null);
  const [auto, week, structure, history] = await Promise.all([autofillFor(test, students, results), weekDays(test, ids), getStructure(), historyOf(test, ids)]);
  const max = maxTotal(format.fields);
  const asOf = asOfDay(test);
  const generatedOn = todayIst();

  const reports = students.map((s, i): StudentReport => {
    const r = results[i];
    const total = r?.present ? totalOf(format.fields, r.values) : null;
    const result: ReportResult = !r ? "missing" : !r.present ? "absent" : total === null ? "incomplete" : total >= format.passMark ? "pass" : "below";
    const level = structure.levels.find((l) => l.level === (auto[i]?.progress.level ?? s.level));
    const current = auto[i]?.progress.topic;
    const hist = history.get(s.niatId) ?? [];
    const before = hist.filter((h) => h.heldOn < test.heldOn || (h.heldOn === test.heldOn && h.testId !== test.id));
    const prev = before.at(-1) ?? null;
    const series = [...before, ...(total !== null ? [{ testId: test.id, name: test.name, heldOn: test.heldOn, total, max, passMark: format.passMark }] : [])].slice(-6);
    return {
      test: { id: test.id, name: test.name, band: test.band, heldOn: test.heldOn },
      student: { niatId: s.niatId, name: s.name, section: s.section, level: s.level, instructor: s.instructor },
      result,
      total,
      max,
      passMark: format.passMark,
      previous: prev ? { name: prev.name, total: prev.total, max: prev.max } : null,
      average,
      marks: format.fields
        .filter((f) => f.type === "marks")
        .map((f) => {
          const v = r?.present ? r.values[f.id] : null;
          return { id: f.id, label: f.label, labelTe: f.labelTe?.trim() || null, value: typeof v === "number" ? v : null, max: f.max ?? 0, average: fieldAverage.get(f.id) ?? null };
        }),
      feedback: format.fields
        .filter((f) => f.type !== "marks")
        .map((f) => ({
          id: f.id,
          label: f.label,
          labelTe: f.labelTe?.trim() || null,
          type: f.type,
          value: r?.present ? (r.values[f.id] ?? null) : null,
          valueTe: r?.present && hasTeluguText(f) ? r.valuesTe?.[f.id]?.trim() || null : null,
        })),
      auto: auto[i],
      week: week.get(s.niatId) ?? [],
      weekRange: weekRange(asOf),
      roadmap: {
        // Live topics of the level; an archived one stays while the student is still on it.
        topics: (level?.topics ?? []).filter((t) => !t.archived || t.name === current).map((t) => t.name),
        levelTitle: level?.title ?? "",
      },
      history: series.map((h) => ({ name: h.name, heldOn: h.heldOn, total: h.total, max: h.max, pct: pct(h.total, h.max), passPct: pct(h.passMark, h.max), current: h.testId === test.id })),
      enteredBy: r?.enteredBy ?? null,
      enteredOn: r?.updatedAt?.slice(0, 10) ?? null,
      generatedOn,
    };
  });
  return { reports, instructors, instructor: chosen, format };
}

type Past = { testId: string; name: string; heldOn: string; total: number; max: number; passMark: number };

/** Each student's totals in weekly tests up to this one (any band), oldest first. */
async function historyOf(test: WeeklyTest, ids: string[]): Promise<Map<string, Past[]>> {
  const tests = (await listTests())
    .filter((t) => t.id !== test.id && t.heldOn <= test.heldOn)
    .sort((a, b) => a.heldOn.localeCompare(b.heldOn))
    .slice(-12);
  const out = new Map<string, Past[]>(ids.map((id) => [id, []]));
  const rows = await Promise.all(
    tests.map(async (t) => {
      const [format, results] = await Promise.all([getFormatVersion(t.formatId, t.version), getResults(t.id, ids)]);
      return { t, format, results };
    }),
  );
  for (const { t, format, results } of rows) {
    if (!format) continue;
    ids.forEach((id, i) => {
      const r = results[i];
      const total = r?.present ? totalOf(format.fields, r.values) : null;
      if (total !== null) out.get(id)!.push({ testId: t.id, name: t.name, heldOn: t.heldOn, total, max: maxTotal(format.fields), passMark: format.passMark });
    });
  }
  return out;
}

/** "Weekly Test 4 L1 - Aarav Mehta (N24H01A0000) - Telugu": the PDF's file name. */
export const reportFileName = (r: Pick<StudentReport, "test" | "student">, lang: "en" | "te") =>
  `${r.test.name} ${r.test.band} - ${r.student.name} (${r.student.niatId})${lang === "te" ? " - Telugu" : ""}`.replace(/[\\/:*?"<>|]+/g, " ");
