/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cache } from "react";
import { listInteractions } from "@/modules/interactions/data";
import { getFormatVersion, getResults, studentsFor, studentTestHistory } from "@/modules/tests/data";
import { maxTotal, totalOf } from "@/modules/tests/types";
import { formatDate } from "@/common/lib/dates";
import { STATUS_LABEL } from "@/modules/interactions/lib/types";
import { buildStudentDetail } from "@/common/sample-data/student-detail";
import { ROSTER, type RosterStudent } from "@/common/sample-data/roster";
import type { FlagKey } from "@/common/domain/risk";

/**
 * Students data access (UI-2). Runs on the generated sample roster today; the
 * function signatures are what the core roster API / SQL will implement, so the
 * pages don't change when real data is connected.
 */

export const PAGE_SIZE = 25;
export const SORT_KEYS = ["name", "attendance", "level", "rating", "interaction"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const FLAG_FILTERS = ["any", "attendance", "interaction", "contests", "tests", "level"] as const;
export type FlagFilter = (typeof FLAG_FILTERS)[number];

export type StudentQuery = {
  q?: string;
  college?: string;
  section?: string;
  hall?: string;
  instructor?: string;
  level?: string;
  flag?: FlagFilter;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Parse and validate URL search params into a query. Unknown values are dropped. */
export function parseStudentQuery(params: Record<string, string | string[] | undefined>): StudentQuery {
  const sort = one(params.sort);
  const flag = one(params.flag);
  const dir = one(params.dir);
  const page = Number(one(params.page));
  return {
    q: one(params.q)?.trim() || undefined,
    college: one(params.college) || undefined,
    section: one(params.section) || undefined,
    hall: one(params.hall) || undefined,
    instructor: one(params.instructor) || undefined,
    level: one(params.level) || undefined,
    flag: (FLAG_FILTERS as readonly string[]).includes(flag ?? "") ? (flag as FlagFilter) : undefined,
    sort: (SORT_KEYS as readonly string[]).includes(sort ?? "") ? (sort as SortKey) : undefined,
    dir: dir === "desc" ? "desc" : dir === "asc" ? "asc" : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

function matches(s: RosterStudent, q: StudentQuery, ignoreFlag = false) {
  if (q.q) {
    const needle = q.q.toLowerCase();
    if (!s.name.toLowerCase().includes(needle) && !s.niatId.toLowerCase().includes(needle)) return false;
  }
  if (q.college && s.college !== q.college) return false;
  if (q.section && s.section !== q.section) return false;
  if (q.hall && s.hall !== q.hall) return false;
  if (q.instructor && s.instructor !== q.instructor) return false;
  if (q.level && String(s.level) !== q.level) return false;
  if (!ignoreFlag && q.flag) {
    if (q.flag === "any" ? s.flags.length === 0 : !s.flags.includes(q.flag as FlagKey)) return false;
  }
  return true;
}

const SORTERS: Record<SortKey, (a: RosterStudent, b: RosterStudent) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  attendance: (a, b) => a.attendance30d - b.attendance30d,
  level: (a, b) => a.level - b.level,
  rating: (a, b) => (a.lcRating ?? -1) - (b.lcRating ?? -1),
  interaction: (a, b) => (a.lastInteractionDays ?? 999) - (b.lastInteractionDays ?? 999),
};

export type StudentListResult = {
  rows: RosterStudent[];
  total: number;
  page: number;
  pageCount: number;
  /** Counts per quick filter, with the other filters applied. */
  flagCounts: Record<FlagFilter | "all", number>;
  options: { sections: string[]; halls: string[]; instructors: string[] };
};

export async function listStudents(query: StudentQuery): Promise<StudentListResult> {
  const base = ROSTER.filter((s) => matches(s, query, true));
  const flagCounts = {
    all: base.length,
    any: base.filter((s) => s.flags.length > 0).length,
    attendance: base.filter((s) => s.flags.includes("attendance")).length,
    interaction: base.filter((s) => s.flags.includes("interaction")).length,
    contests: base.filter((s) => s.flags.includes("contests")).length,
    tests: base.filter((s) => s.flags.includes("tests")).length,
    level: base.filter((s) => s.flags.includes("level")).length,
  };
  const filtered = base.filter((s) => matches(s, query));
  const sort = query.sort ?? "name";
  const dir = query.dir ?? (sort === "name" ? "asc" : sort === "attendance" ? "asc" : "desc");
  filtered.sort((a, b) => (dir === "asc" ? 1 : -1) * SORTERS[sort](a, b) || a.name.localeCompare(b.name));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(query.page ?? 1, pageCount);
  const uniq = (values: string[]) => [...new Set(values)].sort();
  return {
    rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: filtered.length,
    page,
    pageCount,
    flagCounts,
    options: {
      sections: uniq(ROSTER.map((s) => s.section)),
      halls: uniq(ROSTER.map((s) => s.hall)).sort((a, b) => Number(a.split(" ")[1]) - Number(b.split(" ")[1])),
      instructors: uniq(ROSTER.map((s) => s.instructor)),
    },
  };
}

/** One student's full record; cached per request so every section can call it. */
export const getStudent = cache(async (niatId: string) => {
  const student = ROSTER.find((s) => s.niatId === niatId.toUpperCase());
  if (!student) return null;
  const detail = buildStudentDetail(student);

  // Rounds logged through the form (not part of the generated sample) go on top.
  const logged = (await listInteractions({ niatId: student.niatId })).filter((it) => !it.id.startsWith(`${student.niatId}-r`));
  if (logged.length) {
    detail.interactions.unshift(
      ...logged.map((it) => ({
        id: it.id,
        date: formatDate(it.date),
        round: it.round,
        by: it.takenBy,
        level: `L${it.level}`,
        topics: [...it.topics, ...it.subtopics].join(" › "),
        status: STATUS_LABEL[it.status],
        rating: it.rating,
        questions: it.questions.map((q) => `${q.title} (${q.offRoadmap ? "off-roadmap" : (q.step ?? "roadmap")})`).join(", ") || it.tweakedQuestions || "—",
        stepsReached: Object.entries(it.stepsReached).map(([k, v]) => `${k}: ${v}`).join(", ") || "—",
        performedWell: it.performedWell || "—",
        improvementAreas: it.improvementAreas || "—",
        actionItems: it.actionItems || "—",
        transcriptWords: it.transcriptText.trim() ? it.transcriptText.trim().split(/\s+/).length : 0,
      })),
    );
    detail.snapshot.interactions = student.interactions + logged.length;
    detail.snapshot.lastInteraction = formatDate(logged[0].date);
  }

  // Weekly tests come from the entered results (lib/data/tests), not the generated sample.
  const history = (await studentTestHistory(student.niatId)).filter((h) => h.result);
  if (history.length) {
    const list: typeof detail.tests.list = [];
    let labels: string[] = [];
    for (const { test, result } of history) {
      const format = await getFormatVersion(test.formatId, test.version);
      if (!format || !result) continue;
      const marksFields = format.fields.filter((f) => f.type === "marks");
      labels = marksFields.map((f) => `${f.label} /${f.max}`);
      const peers = await getResults(test.id, studentsFor(test).map((s) => s.niatId));
      const peerTotals = peers.map((p) => (p?.present ? totalOf(format.fields, p.values) : null)).filter((t): t is number => t !== null);
      const total = result.present ? totalOf(format.fields, result.values) : null;
      const firstOf = (type: string) => format.fields.find((f) => f.type === type);
      const areasField = firstOf("multi");
      const remarksField = format.fields.find((f) => f.type === "long" && f.required) ?? firstOf("long");
      const nextField = firstOf("single");
      list.push({
        key: test.name.replace("Weekly Test ", "WT"),
        name: test.name,
        date: formatDate(test.heldOn).replace(/ \d{4}$/, ""),
        by: result.enteredBy,
        marks: marksFields.map((f) => (typeof result.values[f.id] === "number" ? (result.values[f.id] as number) : 0)),
        total: total ?? 0,
        classAvg: peerTotals.length ? Math.round(peerTotals.reduce((a, b) => a + b, 0) / peerTotals.length) : 0,
        belowPass: total !== null && total < format.passMark,
        areas: areasField && Array.isArray(result.values[areasField.id]) ? (result.values[areasField.id] as string[]) : [],
        remarks: remarksField && typeof result.values[remarksField.id] === "string" ? (result.values[remarksField.id] as string) : result.present ? "" : "Absent",
        nextStep: nextField && typeof result.values[nextField.id] === "string" ? (result.values[nextField.id] as string) : "None",
      });
      detail.tests.passMark = format.passMark;
      detail.tests.max = maxTotal(format.fields);
    }
    if (list.length) {
      detail.tests.list = list;
      detail.tests.markLabels = labels;
      const counts = new Map<string, number>();
      for (const t of list) for (const a of t.areas) counts.set(a, (counts.get(a) ?? 0) + 1);
      detail.tests.recurringAreas = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
      detail.snapshot.latestTest = list.at(-1)!.total;
      detail.snapshot.testAvg = Math.round((list.reduce((n, t) => n + t.total, 0) / list.length) * 10) / 10;
    }
  }
  return detail;
});

export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudent>>>;
