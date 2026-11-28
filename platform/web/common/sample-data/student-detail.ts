/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

/**
 * Builds the full Student page record from a roster row (sample data, UI-2).
 * Section shapes match what the module APIs will return:
 *   attendance → attendance service, progress/interactions/tests → logs schema,
 *   contests → contest service, records/timeline → core.
 */
import type { ProgressExplore } from "@/common/domain/progress-explore";
import { flagDetail, RISK_THRESHOLDS } from "@/common/domain/risk";
import { ARRAY_SUBTOPICS, LEVEL_TOPICS, type RosterStudent } from "@/common/sample-data/roster";

/** Fixed "today" for sample data so screens and tests are stable. */
export const SAMPLE_TODAY = new Date("2026-11-16T09:00:00+05:30");

function seeded(text: string) {
  let s = [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DayStatus = "present" | "absent" | "holiday" | "upcoming" | "blank";
export type CalendarDay = {
  day: number | null;
  status: DayStatus;
  today?: boolean;
  tag?: string;
  note?: string;
  /** The day's mark is an internship or registration-pending mark (DSA attendance student periods). */
  category?: "INTERNSHIP" | "REGISTRATION_PENDING";
};

/**
 * One internship or registration-pending period as the student sees it (cancelled ones are never
 * shown). state is as of today (IST); attendanceDays are the days in it that count, up to today.
 */
export type StudentPeriodView = {
  kind: "Internship" | "Registration pending";
  from: string;
  to: string;
  state: "upcoming" | "active" | "ended" | "pending" | "completed";
  completedOn: string | null;
  calendarDays: number;
  attendanceDays: number;
};

const STEP_CODES = [
  ["1.1", "Concept"],
  ["1.2", "Complexity"],
  ["1.3", "Explain"],
  ["2.1", "Easy"],
  ["2.2", "Easy tweak"],
  ["3.1", "Medium"],
  ["3.2", "Med. tweak"],
] as const;

const AREAS = ["Prefix sums", "Edge cases", "Time complexity", "Dry run / tracing", "Index boundaries", "Hash maps", "Recursion base cases"];
const INSTRUCTOR_NOTES = [
  ["Explains the idea well; good brute force.", "Index boundaries and empty input.", "Re-solve 5 problems on this subtopic before next round."],
  ["Clean loops and in-place updates.", "Talk through complexity before coding.", "Move to the next subtopic."],
  ["Knows when to use a set vs a map.", "Average vs worst-case complexity.", "Start the next topic."],
  ["Quick on standard patterns.", "Tweaked variants take long.", "Two tweaked questions as practice."],
] as const;

function novemberCalendar(absentDays: number[]): CalendarDay[] {
  const days: CalendarDay[] = Array.from({ length: 6 }, () => ({ day: null, status: "blank" }));
  for (let d = 1; d <= 30; d++) {
    const sunday = (d - 1) % 7 === 0; // 1 Nov 2026 is a Sunday
    const status: DayStatus = sunday ? "holiday" : d > 16 ? "upcoming" : absentDays.includes(d) ? "absent" : "present";
    days.push({ day: d, status, today: d === 16 });
  }
  return days;
}

export function buildStudentDetail(s: RosterStudent) {
  const rand = seeded(s.niatId);
  const isAarav = s.niatId === "N99H01A0142";
  const r = s.risk;
  const att30 = s.attendance30d ?? 0;
  const attTerm = s.attendanceTerm ?? 0;

  // ---- Attendance
  const workingDaysToDate = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 16];
  const absentCount = Math.round(workingDaysToDate.length * (1 - att30 / 100));
  const absentDays = isAarav
    ? [3, 4, 9, 10, 13]
    : workingDaysToDate.filter((d) => d !== 16).sort(() => rand() - 0.5).slice(0, absentCount).sort((a, b) => a - b);
  const novPresent = workingDaysToDate.length - absentDays.length;
  const novPct = Math.round((novPresent / workingDaysToDate.length) * 100);
  const months = [
    { month: "Aug 2026", workingDays: 17, pct: Math.min(100, attTerm + 12), remark: null as string | null },
    { month: "Sep 2026", workingDays: 26, pct: Math.min(100, attTerm + 6), remark: null as string | null },
    { month: "Oct 2026", workingDays: 26, pct: Math.max(40, att30 + 4), remark: isAarav ? "Away 12–16 Oct, family function (informed POC)" : null },
    { month: "Nov (to date)", workingDays: workingDaysToDate.length, pct: novPct, remark: isAarav ? "Follow-up call scheduled" : null },
  ].map((m) => {
    const present = Math.round((m.workingDays * m.pct) / 100);
    return { ...m, present, absent: m.workingDays - present };
  });
  const daysTo75 = att30 >= RISK_THRESHOLDS.attendancePct ? 0 : Math.ceil((0.75 * 30 - (att30 / 100) * 30) / 0.25);

  // ---- DSA progress
  const topics = LEVEL_TOPICS[s.level] ?? LEVEL_TOPICS[1];
  const currentTopicIndex = Math.max(0, topics.indexOf(s.topic));
  const stepIndex = STEP_CODES.findIndex(([code]) => code === s.step);
  const progress = {
    /** Every level, topic and round for exploring (database only; null = the current level as below). */
    explore: null as ProgressExplore | null,
    level: s.level,
    topic: s.topic,
    subtopic: s.subtopic,
    weeksAtLevel: r.weeksAtLevel,
    levels: Array.from({ length: 8 }, (_, i) => ({ level: i, state: i < s.level ? "cleared" : i === s.level ? "current" : "future" })),
    topics: topics.map((name, i) => ({
      name,
      state: i < currentTopicIndex ? "cleared" : i === currentTopicIndex ? "current" : "not-started",
      subtopics:
        name === "Arrays"
          ? ARRAY_SUBTOPICS.map((sub, j) => ({
              name: sub,
              state: s.subtopic && ARRAY_SUBTOPICS.indexOf(s.subtopic) > j ? "done" : sub === s.subtopic ? "now" : "todo",
            }))
          : [],
    })),
    steps: STEP_CODES.map(([code, label], i) => ({ code, label, state: i < stepIndex ? "done" : i === stepIndex ? "now" : "todo" })),
    levelHistory: [
      ...(s.level > 0 ? [{ change: `Level ${s.level - 1} → Level ${s.level}`, date: "22 Sep 2026", by: s.instructor }] : []),
      { change: "Started at L0", date: "12 Aug 2026", by: "Roster import" },
    ],
    questions: isAarav
      ? [
          { tag: "2.1", title: "Running Sum of 1d Array", result: "solved · 14 Oct", offRoadmap: false },
          { tag: "2.1", title: "Find Pivot Index", result: "solved after hints · 28 Oct", offRoadmap: false },
          { tag: "3.1", title: "Subarray Sum Equals K", result: "not solved · 28 Oct", offRoadmap: false },
          { tag: "Off-roadmap", title: "Trapping Rain Water", result: "attempted · 28 Oct · sent for review", offRoadmap: true },
        ]
      : [
          { tag: "2.1", title: "Two Sum", result: "solved · 21 Oct", offRoadmap: false },
          { tag: "2.1", title: "Contains Duplicate", result: "solved · 30 Sep", offRoadmap: false },
          { tag: "3.1", title: "Product of Array Except Self", result: rand() > 0.5 ? "solved · 4 Nov" : "not solved · 4 Nov", offRoadmap: false },
        ],
  };

  // ---- Interactions
  const interactionCount = Math.min(4, Math.max(1, s.interactions));
  const lastDays = s.lastInteractionDays ?? 30;
  const interactions = Array.from({ length: interactionCount }, (_, i) => {
    const daysAgo = lastDays + i * 14;
    const date = new Date(SAMPLE_TODAY.getTime() - daysAgo * 86_400_000);
    const notes: readonly string[] = INSTRUCTOR_NOTES[(i + Math.floor(rand() * 4)) % INSTRUCTOR_NOTES.length];
    const cleared = i > 0 || rand() > 0.5;
    return {
      id: `${s.niatId}-r${s.interactions - i}`,
      date: date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      round: s.interactions - i,
      by: i === interactionCount - 1 && interactionCount > 2 ? "Neha P." : s.instructor,
      level: `Level ${Math.max(0, s.level - (i > 1 ? 1 : 0))}`,
      topics: i === 0 ? `${s.topic}${s.subtopic ? ` › ${s.subtopic}` : ""}` : topics[Math.max(0, currentTopicIndex - 1)],
      status: isAarav && i === 0 ? "Needs revisit" : cleared ? "Cleared" : "Needs revisit",
      rating: isAarav && i === 0 ? 2.5 : Math.round((2.5 + rand() * 2) * 2) / 2,
      questions: isAarav && i === 0 ? "Find Pivot Index (2.1), Subarray Sum Equals K (3.1), Trapping Rain Water (off-roadmap)" : "Two Sum (2.1), Contains Duplicate (2.1)",
      stepsReached: i === 0 ? STEP_CODES.slice(0, stepIndex + 1).map(([c]) => c).join(", ") : "1.1 → 2.2",
      performedWell: notes[0],
      improvementAreas: notes[1],
      actionItems: notes[2],
      transcriptWords: 1200 + Math.round(rand() * 1800),
    };
  });

  // ---- Weekly tests (format: MCQ /10, Q1 /20, Q2 /20, pass 20)
  const testNames = ["Weekly Test 8", "Weekly Test 9", "Weekly Test 10", "Weekly Test 11", "Weekly Test 12"];
  const testDates = ["17 Oct", "24 Oct", "31 Oct", "7 Nov", "14 Nov"];
  const classAvg = [32, 30, 31, 29, 32];
  const aaravMarks = [[6, 13, 10], [7, 14, 10], [5, 10, 4], [5, 11, 2], [4, 6, 2]];
  const tests = testNames.map((name, i) => {
    const marks = isAarav
      ? aaravMarks[i]
      : (() => {
          const target = s.lastTestScore !== null ? s.lastTestScore + Math.round((rand() - 0.5) * 10) : 25;
          const a = Math.min(10, Math.max(2, Math.round(target / 5 + rand() * 2)));
          const b = Math.min(20, Math.max(2, Math.round((target - a) * 0.55)));
          return [a, b, Math.min(20, Math.max(0, target - a - b))];
        })();
    const total = marks[0] + marks[1] + marks[2];
    const areas = total < 20 ? [AREAS[i % 3], AREAS[(i + 1) % 5]] : total < 30 ? [AREAS[(i + 2) % AREAS.length]] : [];
    return {
      key: `WT${8 + i}`,
      name,
      date: testDates[i],
      by: s.instructor,
      marks,
      total,
      classAvg: classAvg[i],
      belowPass: total < 20,
      areas,
      remarks: total < 20 ? "Brute force only; ran out of time on Q2." : total < 30 ? "Steady; slow on the coding questions." : "Strong attempt.",
      nextStep: total < 20 ? "Discuss in next interaction" : "None",
    };
  });
  const areaCounts = new Map<string, number>();
  for (const t of tests) for (const a of t.areas) areaCounts.set(a, (areaCounts.get(a) ?? 0) + 1);
  const recurringAreas = [...areaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  // ---- Contests
  const contestList = [
    ["Weekly Contest 476", "15 Nov"],
    ["Biweekly Contest 170", "14 Nov"],
    ["Weekly Contest 475", "8 Nov"],
    ["Weekly Contest 474", "1 Nov"],
    ["Biweekly Contest 169", "31 Oct"],
    ["Weekly Contest 473", "25 Oct"],
    ["Weekly Contest 472", "18 Oct"],
  ].map(([name, date], i) => {
    const absent = !s.lcHandle || i < r.contestAbsentStreak;
    const solved = absent ? null : Math.max(0, Math.min(4, Math.round(s.level * 0.6 + rand() * 2)));
    return {
      name,
      date,
      attended: !absent,
      solved,
      // Higher levels rank better; never below 150 (ranks are positive).
      globalRank: absent ? null : Math.max(150, Math.round(4000 + rand() * 18000 - s.level * 700)),
      collegeRank: absent ? null : Math.round(20 + rand() * 260),
    };
  });
  const attendedResults = contestList.filter((c) => c.attended);
  const contests = {
    /** The contest service's id for the student (database only: its topics come from the service). */
    contestId: null as number | null,
    handle: s.lcHandle,
    rating: s.lcRating,
    attended: s.contestsAttended,
    of: 12,
    absentStreak: r.contestAbsentStreak,
    bestGlobal: attendedResults.length ? Math.min(...attendedResults.map((c) => c.globalRank ?? Infinity)) : null,
    bestCollege: attendedResults.length ? Math.min(...attendedResults.map((c) => c.collegeRank ?? Infinity)) : null,
    avgSolved: attendedResults.length ? attendedResults.reduce((n, c) => n + (c.solved ?? 0), 0) / attendedResults.length : null,
    results: contestList,
    tags: [
      ["Array", 6, 7],
      ["Hash Table", 3, 4],
      ["Math", 2, 2],
      ["String", 2, 3],
      ["Prefix Sum", isAarav ? 0 : 1, 3],
      ["Sliding Window", isAarav ? 0 : 1, 2],
    ].map(([name, solved, attempted]) => ({ name: name as string, solved: solved as number, attempted: attempted as number })),
  };

  // ---- Records & timeline
  const flags = s.flags.map((key) => ({ key, detail: flagDetail(key, r) }));
  const records = {
    roster: [
      ["NIAT ID", s.niatId],
      ["Full name", s.name],
      ["College", s.college === "BITS" ? "BITS · BITS Pilani (Hyderabad Campus)" : "CDU · Chaitanya (Deemed to be University)"],
      ["Section", s.section],
      ["Hall", s.hall],
      ["Status", "Active"],
      ["Joined", "12 Aug 2026"],
      ["Term", "Term 5 · 3 Aug – 19 Dec 2026"],
      ["LeetCode handle", s.lcHandle ? `${s.lcHandle} · checked 15 Nov` : "Not provided"],
      ["DSA level", `Level ${s.level} · ${s.topic}${s.subtopic ? ` › ${s.subtopic}` : ""} · step ${s.step}`],
    ] as [string, string][],
    assignments: [
      { who: s.instructor, role: "Instructor", when: "22 Sep 2026 → now" },
      ...(s.instructor !== "Neha P." ? [{ who: "Neha P.", role: "Instructor", when: "12 Aug → 21 Sep 2026" }] : []),
      { who: s.poc, role: "POC", when: "12 Aug 2026 → now" },
    ],
    changeLog: [
      { what: `Weekly Test 12 marks entered by ${s.instructor}`, when: "17 Nov 11:20" },
      ...(isAarav ? [{ what: 'Off-roadmap question "Trapping Rain Water" sent for review', when: "28 Oct 16:05" }] : []),
      { what: `Level ${Math.max(0, s.level - 1)} → Level ${s.level} by ${s.instructor}`, when: "22 Sep 09:38" },
      { what: "Added by roster import", when: "12 Aug 10:02" },
    ],
  };

  type Module = "attendance" | "interactions" | "tests" | "contests";
  const timeline: { date: string; module: Module; title: string; detail: string }[] = [
    { date: "17 Nov", module: "tests", title: `Weekly Test 12 · ${tests[4].total} / 50`, detail: tests[4].belowPass ? "below pass" : "passed" },
    { date: "16 Nov", module: "attendance", title: "Present", detail: s.hall },
    contestList[0].attended
      ? { date: "15 Nov", module: "contests", title: `Weekly Contest 476 · solved ${contestList[0].solved} / 4`, detail: `college rank #${contestList[0].collegeRank}` }
      : { date: "15 Nov", module: "contests", title: "Missed Weekly Contest 476", detail: r.contestAbsentStreak > 1 ? `${r.contestAbsentStreak} in a row` : "" },
    ...(absentDays.length ? [{ date: `${absentDays[absentDays.length - 1]} Nov`, module: "attendance" as const, title: "Absent", detail: `${absentDays.length} absences this month` }] : []),
    { date: "10 Nov", module: "tests", title: `Weekly Test 11 · ${tests[3].total} / 50`, detail: tests[3].belowPass ? "below pass" : "passed" },
    { date: "31 Oct", module: "attendance", title: `October closed at ${months[2].pct}%`, detail: months[2].remark ?? "" },
    ...interactions.map((it) => ({ date: it.date.replace(/ 2026$/, ""), module: "interactions" as const, title: `Round ${it.round} with ${it.by} · ${it.status} · ${it.rating} / 5`, detail: it.topics })),
  ];

  return {
    student: s,
    profile: {
      instructorSince: "22 Sep" as string | null,
      coach: null as string | null,
      levelBand: `Level ${Math.min(s.level, 3)}${s.level >= 3 ? "+" : ""}`,
      lastActivity: "Present today, 16 Nov",
      termLabel: "Term 5",
      joinedLabel: "12 Aug 2026" as string | null,
    },
    flags,
    snapshot: {
      attendance30d: s.attendance30d,
      attendanceTerm: s.attendanceTerm,
      level: s.level,
      step: s.step,
      weeksAtLevel: r.weeksAtLevel,
      interactions: s.interactions,
      lastInteraction: interactions[0]?.date ?? null,
      avgRating: (Math.round((interactions.reduce((n, it) => n + it.rating, 0) / interactions.length) * 10) / 10) as number | null,
      latestTest: tests[4].total as number | null,
      testAvg: (Math.round((tests.reduce((n, t) => n + t.total, 0) / tests.length) * 10) / 10) as number | null,
      rating: s.lcRating,
      contestsAttended: s.contestsAttended,
    },
    attendance: {
      monthLabel: "November 2026",
      calendar: novemberCalendar(absentDays),
      present: novPresent,
      absent: absentDays.length,
      pct: novPct,
      months,
      daysTo75,
      placementReachable: attTerm >= 90,
      periods: [] as StudentPeriodView[],
    },
    progress,
    interactions,
    tests: { list: tests, recurringAreas, passMark: 20, max: 50, markLabels: ["MCQ /10", "Q1 /20", "Q2 /20"] },
    contests,
    records,
    timeline,
  };
}
