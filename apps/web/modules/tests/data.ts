/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/common/auth/roles";
import { addDays } from "@/common/lib/dates";
import { buildStudentDetail } from "@/common/sample-data/student-detail";
import { ROSTER } from "@/common/sample-data/roster";
import {
  bandOf,
  resultProblems,
  type Band,
  type FormatField,
  type ResultFormat,
  type ResultValue,
  type Submission,
  type TestResult,
  type WeeklyTest,
} from "@/modules/tests/types";

/**
 * Weekly tests data access (UI-6). In memory for development; with the database
 * this is logs.result_formats / result_format_versions / result_format_fields,
 * logs.tests, logs.test_results / test_result_values (ARCHITECTURE §4.7).
 */

const AREAS = ["Prefix sums", "Hash maps", "Two pointers", "Edge cases", "Time complexity", "Dry run / tracing", "Recursion base cases", "Index boundaries"];
const NEXT_STEPS = ["None", "Extra practice set", "Discuss in next interaction", "Re-test next week", "Escalate to senior instructor"];

const STANDARD_FIELDS: FormatField[] = [
  { id: "f1", label: "MCQ", type: "marks", max: 10, required: true, column: true, help: "" },
  { id: "f2", label: "Coding Q1", type: "marks", max: 20, required: true, column: true, help: "" },
  { id: "f3", label: "Coding Q2", type: "marks", max: 20, required: true, column: true, help: "Partial marks allowed for a correct approach" },
  { id: "f4", label: "Improvement areas", type: "multi", options: AREAS, required: false, column: false, help: "Pick everything that applies" },
  { id: "f5", label: "What went well", type: "long", required: false, column: false, help: "" },
  { id: "f6", label: "Remarks", type: "long", required: true, column: false, help: "Specific mistakes you saw" },
  { id: "f7", label: "Next step", type: "single", options: NEXT_STEPS, required: false, column: false, help: "" },
  { id: "f8", label: "Show feedback to student", type: "yesno", required: false, column: false, help: "Takes effect once student login is on" },
];

const TEST_DATES = [
  ["Weekly Test 8", "2026-10-17"],
  ["Weekly Test 9", "2026-10-24"],
  ["Weekly Test 10", "2026-10-31"],
  ["Weekly Test 11", "2026-11-07"],
  ["Weekly Test 12", "2026-11-14"],
] as const;

type Store = { formats: ResultFormat[]; tests: WeeklyTest[]; results: Map<string, TestResult>; submissions: Submission[] };
const g = globalThis as unknown as { __testStore?: Store };
const key = (testId: string, niatId: string) => `${testId}|${niatId}`;

function seed(): Store {
  const formats: ResultFormat[] = [
    {
      id: "standard",
      name: "Standard weekly test",
      versions: [{ version: 3, passMark: 20, fields: STANDARD_FIELDS, publishedBy: "Priya K.", publishedAt: "2026-11-02T10:00:00+05:30" }],
    },
  ];
  const tests: WeeklyTest[] = [];
  for (const band of ["L0", "L1", "L2", "L3+"] as Band[]) {
    TEST_DATES.forEach(([name, heldOn], i) => {
      tests.push({
        id: `wt${8 + i}-${band.replace("+", "plus").toLowerCase()}`,
        name,
        band,
        heldOn,
        dueAt: `${addDays(heldOn, 3)}T18:00:00+05:30`,
        formatId: "standard",
        version: 3,
        createdBy: "Priya K.",
      });
    });
  }
  const results = new Map<string, TestResult>();
  const submissions: Submission[] = [];
  for (const s of ROSTER) {
    const band = bandOf(s.level);
    const detail = buildStudentDetail(s);
    detail.tests.list.forEach((t, i) => {
      const test = tests.find((x) => x.band === band && x.name === t.name)!;
      const latest = i === detail.tests.list.length - 1;
      // Weekly Test 12 is still being entered: Karthik S. has a few students left.
      const pending = latest && s.instructor === "Karthik S." && Number(s.niatId.slice(-1)) % 3 === 0;
      if (pending) return;
      results.set(key(test.id, s.niatId), {
        testId: test.id,
        niatId: s.niatId,
        present: true,
        values: {
          f1: t.marks[0],
          f2: t.marks[1],
          f3: t.marks[2],
          f4: t.areas.filter((a) => AREAS.includes(a)),
          f5: "",
          f6: t.remarks,
          f7: NEXT_STEPS.includes(t.nextStep) ? t.nextStep : "None",
          f8: false,
        },
        enteredBy: s.instructor,
        updatedAt: `${addDays(test.heldOn, 2)}T12:00:00+05:30`,
      });
    });
  }
  for (const test of tests) {
    if (test.name === "Weekly Test 12") continue;
    for (const instructor of new Set(ROSTER.map((s) => s.instructor))) submissions.push({ testId: test.id, instructor, submittedAt: `${test.dueAt}` });
  }
  return { formats, tests, results, submissions };
}

function store(): Store {
  if (!g.__testStore) g.__testStore = seed();
  return g.__testStore;
}

// ---------- reads

export async function listFormats() {
  return store().formats;
}

export async function getFormatVersion(formatId: string, version?: number) {
  const format = store().formats.find((f) => f.id === formatId);
  if (!format) return null;
  return (version === undefined ? format.versions.at(-1) : format.versions.find((v) => v.version === version)) ?? null;
}

export async function listTests() {
  return [...store().tests].sort((a, b) => b.heldOn.localeCompare(a.heldOn) || a.band.localeCompare(b.band));
}

export async function getTest(testId: string) {
  return store().tests.find((t) => t.id === testId) ?? null;
}

/** Students who sit a test: its band, limited to one instructor when given. */
export function studentsFor(test: WeeklyTest, instructor?: string) {
  return ROSTER.filter((s) => bandOf(s.level) === test.band && (!instructor || s.instructor === instructor)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getResults(testId: string, niatIds: string[]) {
  const s = store();
  return niatIds.map((id) => s.results.get(key(testId, id)) ?? null);
}

export async function getSubmission(testId: string, instructor: string) {
  return store().submissions.find((x) => x.testId === testId && x.instructor === instructor) ?? null;
}

export async function listSubmissions(testId: string) {
  return store().submissions.filter((x) => x.testId === testId);
}

/** A student's results across tests, newest last (for the Student page). */
export async function studentTestHistory(niatId: string) {
  const s = store();
  const out: { test: WeeklyTest; result: TestResult | null }[] = [];
  for (const test of s.tests) {
    const result = s.results.get(key(test.id, niatId)) ?? null;
    const student = ROSTER.find((x) => x.niatId === niatId);
    if (student && bandOf(student.level) === test.band) out.push({ test, result });
  }
  return out.sort((a, b) => a.test.heldOn.localeCompare(b.test.heldOn));
}

// ---------- writes

type Fail = { ok: false; error: string; problems?: Record<string, string[]> };

function canEnter(user: SessionUser, instructor: string) {
  return (user.role === "instructor" || user.role === "senior_instructor") && user.name === instructor;
}

export async function saveResults(
  user: SessionUser,
  testId: string,
  rows: { niatId: string; present: boolean; values: Record<string, ResultValue> }[],
): Promise<{ ok: true; saved: number } | Fail> {
  const test = await getTest(testId);
  if (!test) return { ok: false, error: "Test not found." };
  const version = await getFormatVersion(test.formatId, test.version);
  if (!version) return { ok: false, error: "This test's format is missing." };
  if (!(user.role === "instructor" || user.role === "senior_instructor")) return { ok: false, error: "Results are entered by instructors." };
  if (await getSubmission(testId, user.name)) return { ok: false, error: "You've already submitted. Ask an admin to unlock." };

  const mine = new Set(studentsFor(test, user.name).map((s) => s.niatId));
  const problems: Record<string, string[]> = {};
  for (const row of rows) {
    if (!mine.has(row.niatId)) return { ok: false, error: "You can only enter results for your own students." };
    // Only check types and ranges on save; required fields are checked on submit.
    const p = resultProblems(version.fields.map((f) => ({ ...f, required: false })), row);
    if (p.length) problems[row.niatId] = p;
  }
  if (Object.keys(problems).length) return { ok: false, error: "Some marks are out of range. Nothing was saved.", problems };

  const s = store();
  const now = new Date().toISOString();
  for (const row of rows) {
    const values = Object.fromEntries(version.fields.map((f) => [f.id, row.present ? (row.values[f.id] ?? null) : null]));
    s.results.set(key(testId, row.niatId), { testId, niatId: row.niatId, present: row.present, values, enteredBy: user.name, updatedAt: now });
  }
  return { ok: true, saved: rows.length };
}

export async function submitResults(user: SessionUser, testId: string): Promise<{ ok: true } | Fail> {
  const test = await getTest(testId);
  if (!test) return { ok: false, error: "Test not found." };
  if (!canEnter(user, user.name) || (await getSubmission(testId, user.name))) return { ok: false, error: "Nothing to submit." };
  const version = (await getFormatVersion(test.formatId, test.version))!;
  const students = studentsFor(test, user.name);
  const results = await getResults(testId, students.map((s) => s.niatId));
  const problems: Record<string, string[]> = {};
  students.forEach((s, i) => {
    const r = results[i];
    if (!r) problems[s.niatId] = ["No result entered (or mark the student absent)"];
    else {
      const p = resultProblems(version.fields, r);
      if (p.length) problems[s.niatId] = p;
    }
  });
  if (Object.keys(problems).length) return { ok: false, error: `${Object.keys(problems).length} students still need results.`, problems };
  store().submissions.push({ testId, instructor: user.name, submittedAt: new Date().toISOString() });
  return { ok: true };
}

export async function unlockResults(user: SessionUser, testId: string, instructor: string): Promise<{ ok: true } | Fail> {
  if (user.role !== "owner" && user.role !== "admin") return { ok: false, error: "Only admins can unlock results." };
  const s = store();
  const before = s.submissions.length;
  s.submissions = s.submissions.filter((x) => !(x.testId === testId && x.instructor === instructor));
  return before === s.submissions.length ? { ok: false, error: "Those results aren't submitted." } : { ok: true };
}

export async function createTest(
  user: SessionUser,
  input: { name: string; band: Band; heldOn: string; dueAt: string; formatId: string },
): Promise<{ ok: true; test: WeeklyTest } | Fail> {
  if (user.role !== "owner" && user.role !== "admin") return { ok: false, error: "Only admins create tests." };
  const version = await getFormatVersion(input.formatId);
  if (!version) return { ok: false, error: "Pick a format." };
  if (!input.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.heldOn)) return { ok: false, error: "Give the test a name and a date." };
  if (store().tests.some((t) => t.name.trim().toLowerCase() === input.name.trim().toLowerCase() && t.band === input.band)) {
    return { ok: false, error: `${input.band} already has a test called "${input.name.trim()}".` };
  }
  const test: WeeklyTest = { id: randomUUID().slice(0, 8), name: input.name.trim(), band: input.band, heldOn: input.heldOn, dueAt: input.dueAt, formatId: input.formatId, version: version.version, createdBy: user.name };
  store().tests.push(test);
  return { ok: true, test };
}

export async function publishFormat(user: SessionUser, formatId: string, input: { passMark: number; fields: FormatField[] }): Promise<{ ok: true; version: number } | Fail> {
  if (user.role !== "owner" && user.role !== "admin") return { ok: false, error: "Only admins change the result format." };
  const format = store().formats.find((f) => f.id === formatId);
  if (!format) return { ok: false, error: "Format not found." };
  if (!input.fields.length) return { ok: false, error: "Add at least one field." };
  if (input.fields.some((f) => !f.label.trim())) return { ok: false, error: "Every field needs a name." };
  if (input.fields.some((f) => f.type === "marks" && (!f.max || f.max < 1))) return { ok: false, error: "Every marks field needs max marks of at least 1." };
  if (input.fields.some((f) => (f.type === "single" || f.type === "multi") && !(f.options ?? []).length)) return { ok: false, error: "Choice fields need at least one option." };
  const total = input.fields.filter((f) => f.type === "marks").reduce((n, f) => n + (f.max ?? 0), 0);
  if (input.passMark < 0 || input.passMark > total) return { ok: false, error: `Pass mark must be between 0 and ${total}.` };
  const version = (format.versions.at(-1)?.version ?? 0) + 1;
  format.versions.push({ version, passMark: input.passMark, fields: input.fields, publishedBy: user.name, publishedAt: new Date().toISOString() });
  return { ok: true, version };
}
