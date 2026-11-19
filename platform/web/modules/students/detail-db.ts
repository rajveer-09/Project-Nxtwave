/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import { getDb } from "@/common/db/pool";
import { flagDetail, RISK_THRESHOLDS } from "@/common/domain/risk";
import { addDays, formatDate, todayIst } from "@/common/lib/dates";
import type { RosterStudent } from "@/common/sample-data/roster";
import type { buildStudentDetail, CalendarDay } from "@/common/sample-data/student-detail";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { studentSteps, subtopicNames } from "@nxtone/interactions-ui/curriculum/lib/structure";
import { coveredLabel, STATUS_LABEL } from "@nxtone/interactions-ui/lib/types";

/**
 * The Student page from the combined database: attendance (attendance schema, same day
 * rules as the attendance service), DSA progress and interactions (logs), contests
 * (contest), assignments and history (core). Same shape as the sample builder, so the
 * page components don't change.
 */

export type StudentDetailShape = ReturnType<typeof buildStudentDetail>;

const PLACEMENT_THRESHOLD = 95; // modules/attendance/backend/internal/stats PlacementThreshold
const STEP_SHORT: Record<string, string> = {
  "1.1": "Concept",
  "1.2": "Complexity",
  "1.3": "Explain",
  "2.1": "Easy",
  "2.2": "Easy tweak",
  "3.1": "Medium",
  "3.2": "Med. tweak",
  "4.1": "Hard",
  "4.2": "Hard tweak",
};

const weekday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const shortDate = (ymd: string) => formatDate(ymd).replace(/ \d{4}$/, "");
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const istYmd = (iso: string | Date) => todayIst(new Date(iso));
const istStamp = (iso: string | Date) => {
  const d = new Date(iso);
  return `${shortDate(istYmd(d))} ${new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(11, 16)}`;
};
export const stepCode = (step: string | null | undefined) => step?.match(/^\d\.\d/)?.[0] ?? step ?? "";

type Term = { name: string; start: string; end: string; is_current: boolean };
type Entry = { date: string; applies_to: string; day_type: string; counts: boolean; label: string };

/** stats.ResolveDay from modules/attendance/backend: degree entry, then ALL, then Sunday, else working. */
function dayResolver(degree: string, joined: string | null, dropped: string | null, terms: Term[], entries: Entry[], today: string) {
  const byDate = new Map<string, Map<string, Entry>>();
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, new Map());
    byDate.get(e.date)!.set(e.applies_to, e);
  }
  return (d: string) => {
    const e = byDate.get(d)?.get(degree) ?? byDate.get(d)?.get("ALL");
    const dayCounts = e ? e.day_type === "working" || (e.day_type === "event" && e.counts) : weekday(d) !== 0;
    const inTerm = terms.some((t) => d >= t.start && d <= t.end);
    const enrolled = (!joined || d >= joined) && (!dropped || d <= dropped);
    return { dayCounts, inTerm, enrolled, future: d > today, counted: dayCounts && inTerm && enrolled && d <= today, label: e?.label ?? "" };
  };
}

export async function buildStudentDetailFromDb(s: RosterStudent): Promise<StudentDetailShape> {
  const db = getDb();
  const today = todayIst();
  const id = s.niatId;

  const [att, terms, calendar, marks, remarks, periods, logsStudent, levelChanges, interactions, contest, assignments, colleges] = await Promise.all([
    db.query<{ degree_code: string; joined_on: string | null; dropped_on: string | null; status: string; created_at: string }>(
      "SELECT degree_code, joined_on::text, dropped_on::text, status, created_at FROM attendance.students WHERE niat_id = $1", [id]),
    db.query<Term>("SELECT name, start_date::text AS start, end_date::text AS end, is_current FROM attendance.terms ORDER BY start_date"),
    db.query<Entry>("SELECT date::text, applies_to, day_type, counts, label FROM attendance.calendar_days WHERE applies_to IN ('ALL', $1)", [s.college]),
    db.query<{ date: string; status: "P" | "A" }>("SELECT date::text, status FROM attendance.attendance WHERE niat_id = $1 ORDER BY date", [id]),
    db.query<{ month: string; remark: string }>("SELECT to_char(month, 'YYYY-MM') AS month, remark FROM attendance.student_remarks WHERE niat_id = $1", [id]),
    db.query<{ kind: string; start: string; end: string }>(
      "SELECT kind, start_date::text AS start, end_date::text AS end FROM attendance.student_periods WHERE niat_id = $1 AND cancelled_at IS NULL ORDER BY start_date", [id]),
    db.query<{ created_at: string }>("SELECT created_at FROM logs.students WHERE upper(id) = $1", [id]),
    db.query<{ from_level: number; to_level: number; change_date: string; by: string | null; source: string }>(
      `SELECT lc.from_level, lc.to_level, lc.change_date::text, COALESCE(st.name, u.name, lc.changed_by) AS by, lc.source
       FROM logs.level_changes lc
       LEFT JOIN core.staff st ON st.instructor_code = lc.changed_by
       LEFT JOIN logs.users u ON u.id = lc.changed_by
       WHERE upper(lc.student_id) = $1 ORDER BY lc.change_date DESC, lc.changed_at DESC`, [id]),
    listInteractions({ niatId: id }),
    loadContests(id),
    db.query<{ name: string; kind: string; from_date: string; to_date: string | null }>(
      `SELECT st.name, a.kind, a.from_date::text, a.to_date::text FROM core.student_assignments a JOIN core.staff st ON st.id = a.staff_id
       WHERE a.niat_id = $1 ORDER BY a.to_date IS NULL DESC, a.from_date DESC`, [id]),
    db.query<{ code: string; name: string }>("SELECT code, name FROM core.colleges"),
  ]);

  // ---------------------------------------------------------------- attendance
  const a = att.rows[0];
  const resolve = dayResolver(a?.degree_code ?? s.college, a?.joined_on ?? null, a?.dropped_on ?? null, terms.rows, calendar.rows, today);
  const markOn = new Map(marks.rows.map((m) => [m.date, m.status]));
  const term = terms.rows.find((t) => today >= t.start && today <= t.end) ?? terms.rows.find((t) => t.is_current) ?? terms.rows.at(-1) ?? null;

  const count = (from: string, to: string) => {
    let present = 0;
    let absent = 0;
    for (const m of marks.rows) {
      if (m.date < from || m.date > to || !resolve(m.date).counted) continue;
      if (m.status === "P") present++;
      else absent++;
    }
    return { present, absent, pct: present + absent ? Math.round((present * 100) / (present + absent)) : 0 };
  };

  const monthKey = today.slice(0, 7);
  const firstOfMonth = `${monthKey}-01`;
  const cells: CalendarDay[] = Array.from({ length: (weekday(firstOfMonth) + 6) % 7 }, () => ({ day: null, status: "blank" }));
  for (let d = firstOfMonth; d.startsWith(monthKey); d = addDays(d, 1)) {
    const r = resolve(d);
    const mark = markOn.get(d);
    const status: CalendarDay["status"] = r.future
      ? "upcoming"
      : !r.dayCounts || !r.inTerm || !r.enrolled
        ? "holiday"
        : mark === "P"
          ? "present"
          : mark === "A"
            ? "absent"
            : "blank";
    cells.push({ day: Number(d.slice(8)), status, today: d === today });
  }
  const thisMonth = count(firstOfMonth, today);

  const remarkFor = new Map(remarks.rows.map((r) => [r.month, r.remark]));
  const months: StudentDetailShape["attendance"]["months"] = [];
  if (term) {
    for (let ym = term.start.slice(0, 7); ym <= monthKey && ym <= term.end.slice(0, 7); ym = addDays(`${ym}-28`, 7).slice(0, 7)) {
      const inMonth = count(`${ym}-01`, addDays(`${addDays(`${ym}-28`, 7).slice(0, 7)}-01`, -1));
      months.push({
        month: ym === monthKey ? `${monthName(ym).split(" ")[0]} (to date)` : monthName(ym),
        workingDays: inMonth.present + inMonth.absent,
        pct: inMonth.pct,
        remark: remarkFor.get(ym) ?? null,
        present: inMonth.present,
        absent: inMonth.absent,
      });
    }
  }

  const last30 = count(addDays(today, -30), today);
  const daysTo75 = Math.max(0, Math.ceil(((RISK_THRESHOLDS.attendancePct / 100) * (last30.present + last30.absent) - last30.present) / (1 - RISK_THRESHOLDS.attendancePct / 100)));
  let placementReachable = true;
  if (term) {
    const sofar = count(term.start, today);
    let remaining = 0;
    for (let d = addDays(today, 1); d <= term.end; d = addDays(d, 1)) {
      const r = resolve(d);
      if (r.dayCounts && r.inTerm && r.enrolled) remaining++;
    }
    const marked = sofar.present + sofar.absent + remaining;
    placementReachable = marked === 0 || ((sofar.present + remaining) * 100) / marked >= PLACEMENT_THRESHOLD;
  }

  // ---------------------------------------------------------------- DSA progress
  const structure = await getStructure();
  // Archived topics stay in the list while the student is still on one.
  const topics = (structure.levels.find((l) => l.level === s.level)?.topics ?? []).filter((t) => !t.archived || t.name === s.topic).map((t) => t.name);
  const topicIndex = Math.max(0, topics.indexOf(s.topic));
  const stepOptions = studentSteps(structure, s.level, s.topic);
  const currentStep = stepOptions.findIndex((o) => o === s.step || stepCode(o) === stepCode(s.step));
  const subtopicsOf = (topic: string, state: "cleared" | "current" | "not-started") => {
    const subs = subtopicNames(structure, s.level, topic);
    const now = state === "current" ? subs.indexOf(s.subtopic ?? "") : -1;
    return subs.map((name, j) => ({
      name,
      state: state === "cleared" || (state === "current" && now > j) ? "done" : state === "current" && now === j ? "now" : "todo",
    }));
  };
  const asked = new Map<string, { tag: string; title: string; result: string; offRoadmap: boolean }>();
  for (const it of interactions) {
    for (const q of it.questions) {
      if (asked.size >= 8) break;
      const key = q.title.toLowerCase();
      if (!asked.has(key)) {
        asked.set(key, { tag: q.offRoadmap ? "Off-roadmap" : (q.step ?? `L${it.level}`), title: q.title, result: `${STATUS_LABEL[it.status].toLowerCase()} · ${shortDate(it.date)}`, offRoadmap: q.offRoadmap });
      }
    }
  }
  const startedOn = logsStudent.rows[0]?.created_at ? istYmd(logsStudent.rows[0].created_at) : null;
  const progress: StudentDetailShape["progress"] = {
    level: s.level,
    topic: s.topic,
    subtopic: s.subtopic,
    weeksAtLevel: s.risk.weeksAtLevel,
    levels: structure.levels.map(({ level: i }) => ({ level: i, state: i < s.level ? "cleared" : i === s.level ? "current" : "future" })),
    topics: topics.map((name, i) => {
      const state = i < topicIndex ? "cleared" : i === topicIndex ? "current" : "not-started";
      return { name, state, subtopics: subtopicsOf(name, state) };
    }),
    steps: stepOptions.map((option, i) => {
      const code = stepCode(option);
      return { code, label: STEP_SHORT[code] ?? "", state: i < currentStep ? "done" : i === currentStep ? "now" : "todo" };
    }) as StudentDetailShape["progress"]["steps"],
    levelHistory: [
      ...levelChanges.rows.map((c) => ({
        change: `L${c.from_level} → L${c.to_level}`,
        date: formatDate(c.change_date),
        by: c.by ?? (c.source === "backfill" ? "From interactions" : "—"),
      })),
      ...(startedOn ? [{ change: `Started at L${levelChanges.rows.at(-1)?.from_level ?? s.level}`, date: formatDate(startedOn), by: "Roster import" }] : []),
    ],
    questions: [...asked.values()],
  };

  // ---------------------------------------------------------------- interactions
  const items = interactions.map((it) => ({
    id: it.id,
    date: formatDate(it.date),
    round: it.round,
    by: it.takenBy,
    level: `L${it.level}`,
    topics: coveredLabel(it.topics, it.subtopics),
    status: STATUS_LABEL[it.status],
    rating: it.rating,
    questions: it.questions.map((q) => q.title + (q.offRoadmap ? " (off-roadmap)" : q.step ? ` (${q.step})` : "")).join(", ") || it.tweakedQuestions || "—",
    stepsReached: Object.entries(it.stepsReached).map(([k, v]) => `${k}: ${v}`).join(", ") || "—",
    performedWell: it.performedWell || "—",
    improvementAreas: it.improvementAreas || "—",
    actionItems: it.actionItems || "—",
    transcriptWords: it.transcriptText.trim() ? it.transcriptText.trim().split(/\s+/).length : 0,
  }));
  const avgRating = items.length ? Math.round((items.reduce((n, it) => n + it.rating, 0) / items.length) * 10) / 10 : null;

  // ---------------------------------------------------------------- records & timeline
  const collegeName = colleges.rows.find((c) => c.code === s.college)?.name;
  const current = assignments.rows.find((r) => r.kind === "instructor" && !r.to_date);
  const joined = a?.joined_on ?? null;
  const firstSeen = [a?.created_at, logsStudent.rows[0]?.created_at].filter(Boolean).map((x) => new Date(x!).getTime());
  const records: StudentDetailShape["records"] = {
    roster: [
      ["NIAT ID", s.niatId],
      ["Full name", s.name],
      ["College", collegeName ? `${s.college} · ${collegeName}` : s.college],
      ["Section", s.section],
      ["Hall", s.hall],
      ["Status", a?.status === "dropped" ? "Dropped" : "Active"],
      ["Joined", joined ? formatDate(joined) : "—"],
      ["Term", term ? `${term.name} · ${shortDate(term.start)} – ${formatDate(term.end)}` : "—"],
      ["LeetCode handle", s.lcHandle ? `${s.lcHandle}${contest.checkedOn ? ` · checked ${shortDate(contest.checkedOn)}` : ""}` : "Not provided"],
      ["DSA level", `L${s.level} · ${s.topic}${s.subtopic ? ` › ${s.subtopic}` : ""}${stepCode(s.step) && s.level > 0 ? ` · step ${stepCode(s.step)}` : ""}`],
    ],
    assignments: assignments.rows.map((r) => ({
      who: r.name,
      role: r.kind === "poc" ? "POC" : r.kind === "coach" ? "Coach" : "Instructor",
      when: `${formatDate(r.from_date)} → ${r.to_date ? formatDate(r.to_date) : "now"}`,
    })),
    changeLog: [
      ...levelChanges.rows.map((c) => ({ at: c.change_date, what: `Level L${c.from_level} → L${c.to_level}${c.by ? ` by ${c.by}` : ""}`, when: formatDate(c.change_date) })),
      ...interactions.slice(0, 5).map((it) => ({ at: it.createdAt.slice(0, 10), what: `Round ${it.round} logged by ${it.takenBy}`, when: istStamp(it.createdAt) })),
      ...(firstSeen.length ? [{ at: new Date(Math.min(...firstSeen)).toISOString().slice(0, 10), what: "Added to the roster", when: istStamp(new Date(Math.min(...firstSeen))) }] : []),
    ]
      .sort((x, y) => y.at.localeCompare(x.at))
      .slice(0, 8)
      .map(({ what, when }) => ({ what, when })),
  };

  type Module = "attendance" | "interactions" | "tests" | "contests";
  const events: { at: string; date: string; module: Module; title: string; detail: string }[] = [
    ...interactions.slice(0, 6).map((it) => ({
      at: it.date,
      date: shortDate(it.date),
      module: "interactions" as const,
      title: `Round ${it.round} with ${it.takenBy} · ${STATUS_LABEL[it.status]} · ${it.rating} / 5`,
      detail: coveredLabel(it.topics, it.subtopics),
    })),
    ...marks.rows
      .filter((m) => m.status === "A" && m.date >= addDays(today, -30) && resolve(m.date).counted)
      .map((m) => ({ at: m.date, date: shortDate(m.date), module: "attendance" as const, title: "Absent", detail: s.hall })),
    ...contest.results.slice(0, 4).map((r) => ({
      at: r.ymd,
      date: r.date,
      module: "contests" as const,
      title: r.attended ? `${r.name} · solved ${r.solved ?? 0} / 4` : `Missed ${r.name}`,
      detail: r.collegeRank ? `college rank #${r.collegeRank}` : "",
    })),
    ...levelChanges.rows.slice(0, 3).map((c) => ({ at: c.change_date, date: shortDate(c.change_date), module: "interactions" as const, title: `Level L${c.from_level} → L${c.to_level}`, detail: c.by ?? "" })),
  ];
  const lastMark = [...marks.rows].reverse().find((m) => resolve(m.date).counted);
  const lastActivity = [
    lastMark ? { at: lastMark.date, text: `${lastMark.status === "P" ? "Present" : "Absent"}, ${shortDate(lastMark.date)}` } : null,
    interactions[0] ? { at: interactions[0].date, text: `Interaction, ${shortDate(interactions[0].date)}` } : null,
  ]
    .filter((x): x is { at: string; text: string } => !!x)
    .sort((x, y) => y.at.localeCompare(x.at))[0];

  return {
    student: s,
    profile: {
      instructorSince: current ? shortDate(current.from_date) : null,
      coach: null,
      levelBand: `L${Math.min(s.level, 3)}${s.level >= 3 ? "+" : ""}`,
      lastActivity: lastActivity?.text ?? "No activity recorded",
      termLabel: term?.name ?? "",
      joinedLabel: joined ? formatDate(joined) : null,
    },
    flags: s.flags.map((key) => ({ key, detail: flagDetail(key, s.risk) })),
    snapshot: {
      attendance30d: s.attendance30d,
      attendanceTerm: s.attendanceTerm,
      level: s.level,
      step: s.level > 0 ? stepCode(s.step) : s.step,
      weeksAtLevel: s.risk.weeksAtLevel,
      interactions: items.length,
      lastInteraction: items[0]?.date ?? null,
      avgRating,
      latestTest: null,
      testAvg: null,
      rating: s.lcRating,
      contestsAttended: s.contestsAttended,
    },
    attendance: {
      monthLabel: new Date(`${firstOfMonth}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
      calendar: cells,
      present: thisMonth.present,
      absent: thisMonth.absent,
      pct: thisMonth.pct,
      months,
      daysTo75: s.attendance30d === null ? 0 : daysTo75,
      placementReachable,
      periods: periods.rows.map((p) => ({ kind: p.kind === "INTERNSHIP" ? "Internship" : "Registration pending", from: p.start, to: p.end })),
    },
    progress,
    interactions: items,
    tests: { list: [], recurringAreas: [], passMark: 20, max: 50, markLabels: [] },
    contests: {
      handle: s.lcHandle,
      rating: s.lcRating,
      attended: contest.attended,
      of: contest.scanned,
      absentStreak: contest.absentStreak,
      bestGlobal: contest.bestGlobal,
      bestCollege: contest.bestCollege,
      avgSolved: contest.avgSolved,
      results: contest.results.map((r) => ({ name: r.name, date: r.date, attended: r.attended, solved: r.solved, globalRank: r.globalRank, collegeRank: r.collegeRank })),
      tags: contest.tags,
    },
    records,
    timeline: events
      .sort((x, y) => y.at.localeCompare(x.at))
      .slice(0, 14)
      .map((e) => ({ date: e.date, module: e.module, title: e.title, detail: e.detail })),
  };
}

// ---------------------------------------------------------------- contests

async function loadContests(niatId: string) {
  const db = getDb();
  const empty = { attended: 0, scanned: 0, absentStreak: 0, bestGlobal: null, bestCollege: null, avgSolved: null, checkedOn: null, results: [], tags: [] };
  const { rows } = await db.query<{
    id: number;
    checked: string | null;
    scanned: number | null;
    attended: number | null;
    absent_streak: number | null;
    best_global_rank: number | null;
    best_college_rank: number | null;
    sum_solved: number | null;
  }>(
    `SELECT c.id, c.handle_checked_at AS checked, st.scanned, st.attended, st.absent_streak, st.best_global_rank, st.best_college_rank, st.sum_solved
     FROM contest.students c LEFT JOIN contest.student_stats st ON st.student_id = c.id AND st.win = 0
     WHERE upper(trim(c.roll_no)) = $1 AND c.active ORDER BY c.id LIMIT 1`,
    [niatId],
  );
  const c = rows[0];
  if (!c) return { ...empty } as ContestBlock;

  const [results, tags] = await Promise.all([
    db.query<{ title: string; start_time: string; status: string | null; solved: number | null; global_rank: number | null; college_rank: number | null }>(
      `SELECT ct.title, ct.start_time::text, r.status, r.solved_count AS solved, r.global_rank, r.college_rank
       FROM contest.contests ct
       JOIN (SELECT DISTINCT contest_slug FROM contest.results) done ON done.contest_slug = ct.slug
       LEFT JOIN contest.results r ON r.contest_slug = ct.slug AND r.student_id = $1
       ORDER BY ct.start_time DESC LIMIT 8`,
      [c.id],
    ),
    db.query<{ name: string; attempted: number; solved: number }>(
      `WITH took AS (SELECT contest_slug FROM contest.results WHERE student_id = $1 AND status IN ('solved', 'zero')),
       q AS (
         SELECT ct.slug, (qq->>'question_id')::int AS qid, COALESCE(qq->>'title_slug', qq->>'titleSlug') AS qslug
         FROM contest.contests ct JOIN took ON took.contest_slug = ct.slug, json_array_elements(ct.questions) qq
       ),
       tags AS (SELECT DISTINCT question_slug, tag_name FROM contest.question_tags)
       SELECT t.tag_name AS name, count(*)::int AS attempted, count(p.question_id)::int AS solved
       FROM q JOIN tags t ON t.question_slug = q.qslug
       LEFT JOIN contest.problem_results p ON p.student_id = $1 AND p.contest_slug = q.slug AND p.question_id = q.qid
       GROUP BY 1 ORDER BY attempted DESC, solved DESC, name LIMIT 6`,
      [c.id],
    ),
  ]);
  return {
    attended: c.attended ?? 0,
    scanned: c.scanned ?? 0,
    absentStreak: c.absent_streak ?? 0,
    bestGlobal: c.best_global_rank,
    bestCollege: c.best_college_rank,
    avgSolved: c.attended ? (c.sum_solved ?? 0) / c.attended : null,
    checkedOn: c.checked ? istYmd(c.checked) : null,
    results: results.rows.map((r) => {
      const ymd = istYmd(new Date(Number(r.start_time) * 1000));
      const attended = r.status === "solved" || r.status === "zero";
      return {
        ymd,
        name: r.title,
        date: shortDate(ymd),
        attended,
        solved: attended ? (r.solved ?? 0) : null,
        globalRank: attended ? r.global_rank : null,
        collegeRank: attended ? r.college_rank : null,
      };
    }),
    tags: tags.rows,
  } as ContestBlock;
}

type ContestBlock = {
  attended: number;
  scanned: number;
  absentStreak: number;
  bestGlobal: number | null;
  bestCollege: number | null;
  avgSolved: number | null;
  checkedOn: string | null;
  results: { ymd: string; name: string; date: string; attended: boolean; solved: number | null; globalRank: number | null; collegeRank: number | null }[];
  tags: { name: string; attempted: number; solved: number }[];
};
