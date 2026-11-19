/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

/**
 * Generated sample roster for UI-2 until the core roster API is connected.
 * Deterministic (seeded), fictional names, N99 demo NIAT IDs. Never real students.
 */
import { riskFlags, type FlagKey, type RiskInput } from "@/common/domain/risk";
import { STANDINGS, type Standing } from "@/common/domain/standing";

export type College = "BITS" | "CDU";

export type RosterStudent = {
  niatId: string;
  name: string;
  college: College;
  section: string;
  hall: string;
  instructor: string;
  /** Current success coach's name, "" when none. */
  coach: string;
  poc: string;
  level: number;
  topic: string;
  subtopic: string | null;
  step: string;
  /** Null when nothing is marked (e.g. not on the attendance roster). */
  attendance30d: number | null;
  attendanceTerm: number | null;
  lcHandle: string | null;
  lcRating: number | null;
  contestsAttended: number;
  lastInteractionDays: number | null;
  interactions: number;
  /** Standing at the current level (common/domain/standing.ts). */
  standing: Standing;
  lastTestScore: number | null;
  risk: RiskInput;
  flags: FlagKey[];
  joinedOn: string;
};

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Aarav", "Ananya", "Arjun", "Diya", "Isha", "Kabir", "Meera", "Priya", "Rahul", "Rohan", "Sneha", "Vikram", "Tanvi", "Yash", "Riya", "Aditya", "Kavya", "Siddharth", "Lakshmi", "Om", "Nikhil", "Pooja", "Harsh", "Neha", "Varun", "Divya", "Karan", "Sana", "Manish", "Aisha", "Rahim", "Gauri"];
const LAST = ["Mehta", "Iyer", "Das", "Reddy", "Verma", "Nair", "Pillai", "Shetty", "Joshi", "Gupta", "Kulkarni", "Rao", "Menon", "Kapoor", "Sen", "Kumar", "Jain", "Bose", "Patel", "Singh", "Khan", "Desai", "Bhat", "Chopra"];
const BITS_SECTIONS = ["S001", "S004", "S005", "S006", "S009"];
const CDU_SECTIONS = ["IB-2", "IB-4"];
const BITS_HALLS = ["Hall 1", "Hall 2", "Hall 3", "Hall 7", "Hall 9"];
const CDU_HALLS = ["Hall 11", "Hall 12"];
const INSTRUCTORS = ["Karthik S.", "Neha P.", "Suresh M.", "Divya R.", "Anil T.", "Meena J."];
const POCS = ["Ravi V.", "Farhan A."];

export const LEVEL_TOPICS: Record<number, string[]> = {
  0: ["Loops", "Traversal", "Pattern Questions"],
  1: ["Maths", "STL", "Arrays", "String"],
  2: ["Recursion - Basics", "Sorting", "Binary Search"],
  3: ["Two pointers / Sliding window", "Greedy Algorithms"],
  4: ["Bit Manipulation", "Stack & Queues"],
};
export const ARRAY_SUBTOPICS = ["Array Traversal", "Prefix & Suffix sum", "Kadane's Algo", "Array Adhoc", "Array + Map / Set"];
const STEPS = ["1.1", "1.2", "1.3", "2.1", "2.2", "3.1", "3.2"];

/** Students already shown elsewhere in the prototype keep the same numbers here. */
const FIXED: Partial<RosterStudent & { risk: RiskInput }>[] = [
  { niatId: "N99H01A0142", name: "Aarav Mehta", college: "BITS", section: "S004", hall: "Hall 3", instructor: "Karthik S.", level: 1, topic: "Arrays", subtopic: "Prefix & Suffix sum", step: "2.1", attendance30d: 61, attendanceTerm: 78, lcHandle: "aarav_m", lcRating: 1312, contestsAttended: 6, lastInteractionDays: 19, interactions: 7, lastTestScore: 12, risk: { attendance30d: 61, daysSinceInteraction: 19, contestAbsentStreak: 4, weeksAtLevel: 8, testsBelowPassLast3: 3 } },
  { niatId: "N99H01B0154", name: "Ananya Iyer", college: "CDU", section: "IB-2", hall: "Hall 11", instructor: "Divya R.", level: 2, topic: "Sorting", subtopic: null, step: "3.1", attendance30d: 72, attendanceTerm: 80, lcHandle: "ananya_i", lcRating: 1455, contestsAttended: 9, lastInteractionDays: 15, interactions: 9, lastTestScore: 27, risk: { attendance30d: 72, daysSinceInteraction: 15, contestAbsentStreak: 1, weeksAtLevel: 3, testsBelowPassLast3: 0 } },
  { niatId: "N99H01A0207", name: "Arjun Das", college: "BITS", section: "S004", hall: "Hall 3", instructor: "Karthik S.", level: 3, topic: "Two pointers / Sliding window", subtopic: null, step: "3.2", attendance30d: 94, attendanceTerm: 93, lcHandle: "arjun_d", lcRating: 1688, contestsAttended: 12, lastInteractionDays: 2, interactions: 11, lastTestScore: 42, risk: { attendance30d: 94, daysSinceInteraction: 2, contestAbsentStreak: 0, weeksAtLevel: 2, testsBelowPassLast3: 0 } },
  { niatId: "N99H01B0087", name: "Diya Reddy", college: "CDU", section: "IB-2", hall: "Hall 11", instructor: "Divya R.", level: 1, topic: "STL", subtopic: "Map / Unordered Map", step: "2.2", attendance30d: 68, attendanceTerm: 74, lcHandle: null, lcRating: null, contestsAttended: 0, lastInteractionDays: 6, interactions: 6, lastTestScore: 24, risk: { attendance30d: 68, daysSinceInteraction: 6, contestAbsentStreak: 0, weeksAtLevel: 4, testsBelowPassLast3: 1 } },
  { niatId: "N99H01A0019", name: "Isha Verma", college: "BITS", section: "S001", hall: "Hall 1", instructor: "Neha P.", level: 4, topic: "Stack & Queues", subtopic: null, step: "3.1", attendance30d: 97, attendanceTerm: 96, lcHandle: "isha_v", lcRating: 2041, contestsAttended: 12, lastInteractionDays: 1, interactions: 14, lastTestScore: 47, risk: { attendance30d: 97, daysSinceInteraction: 1, contestAbsentStreak: 0, weeksAtLevel: 1, testsBelowPassLast3: 0 } },
  { niatId: "N99H01A0311", name: "Kabir Nair", college: "BITS", section: "S009", hall: "Hall 7", instructor: "Suresh M.", level: 1, topic: "Arrays", subtopic: "Array Traversal", step: "1.3", attendance30d: 88, attendanceTerm: 87, lcHandle: "kabir_n", lcRating: 1390, contestsAttended: 8, lastInteractionDays: 23, interactions: 5, lastTestScore: 26, risk: { attendance30d: 88, daysSinceInteraction: 23, contestAbsentStreak: 1, weeksAtLevel: 6, testsBelowPassLast3: 0 } },
  { niatId: "N99H01A0420", name: "Meera Pillai", college: "BITS", section: "S001", hall: "Hall 1", instructor: "Neha P.", level: 2, topic: "Binary Search", subtopic: null, step: "2.1", attendance30d: 70, attendanceTerm: 79, lcHandle: "meera_p", lcRating: 1502, contestsAttended: 7, lastInteractionDays: 9, interactions: 8, lastTestScore: 30, risk: { attendance30d: 70, daysSinceInteraction: 9, contestAbsentStreak: 1, weeksAtLevel: 2, testsBelowPassLast3: 0 } },
  { niatId: "N99H01A0098", name: "Rohan Gupta", college: "BITS", section: "S004", hall: "Hall 3", instructor: "Karthik S.", level: 2, topic: "Recursion - Basics", subtopic: null, step: "3.1", attendance30d: 79, attendanceTerm: 82, lcHandle: "rohan_g", lcRating: 1401, contestsAttended: 5, lastInteractionDays: 4, interactions: 9, lastTestScore: 29, risk: { attendance30d: 79, daysSinceInteraction: 4, contestAbsentStreak: 4, weeksAtLevel: 3, testsBelowPassLast3: 0 } },
  { niatId: "N99H01A0167", name: "Riya Sen", college: "BITS", section: "S005", hall: "Hall 3", instructor: "Karthik S.", level: 1, topic: "String", subtopic: null, step: "2.1", attendance30d: 66, attendanceTerm: 72, lcHandle: "riya_s", lcRating: 1340, contestsAttended: 4, lastInteractionDays: 4, interactions: 6, lastTestScore: 13, risk: { attendance30d: 66, daysSinceInteraction: 4, contestAbsentStreak: 2, weeksAtLevel: 5, testsBelowPassLast3: 2 } },
];

function build(): RosterStudent[] {
  const rand = seeded(20261117);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const used = new Set(FIXED.map((s) => s.niatId));
  const rows: RosterStudent[] = FIXED.map((s) => {
    const base = s as RosterStudent;
    return { ...base, coach: "", poc: "Ravi V.", joinedOn: "2026-08-12", standing: STANDINGS[base.interactions % STANDINGS.length], flags: riskFlags(base.risk) };
  });

  let serial = 30;
  while (rows.length < 64) {
    const college: College = rand() < 0.63 ? "BITS" : "CDU";
    serial += 1 + Math.floor(rand() * 9);
    const niatId = `N99H01${college === "BITS" ? "A" : "B"}${String(serial).padStart(4, "0")}`;
    if (used.has(niatId)) continue;
    used.add(niatId);
    const level = Math.min(4, Math.floor(rand() ** 1.6 * 5));
    const topic = pick(LEVEL_TOPICS[level]);
    // Roughly matches the real cohort: most students on track, a minority with one or two warning signs.
    const attendance30d = Math.round(60 + rand() ** 0.4 * 40);
    const gap = rand() < 0.02 ? null : rand() < 0.06 ? 14 + Math.floor(rand() * 12) : Math.floor(rand() * 12);
    const streak = rand() < 0.05 ? 3 + Math.floor(rand() * 3) : Math.floor(rand() * 3);
    const weeks = rand() < 0.05 ? 6 + Math.floor(rand() * 3) : Math.floor(rand() * 6);
    const below = rand() < 0.04 ? 2 : rand() < 0.2 ? 1 : 0;
    const hasHandle = rand() > 0.08;
    const risk: RiskInput = { attendance30d, daysSinceInteraction: gap, contestAbsentStreak: streak, weeksAtLevel: weeks, testsBelowPassLast3: below };
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    rows.push({
      niatId,
      name,
      college,
      section: pick(college === "BITS" ? BITS_SECTIONS : CDU_SECTIONS),
      hall: pick(college === "BITS" ? BITS_HALLS : CDU_HALLS),
      instructor: pick(INSTRUCTORS),
      coach: "",
      poc: pick(POCS),
      level,
      topic,
      subtopic: topic === "Arrays" ? pick(ARRAY_SUBTOPICS) : null,
      step: pick(STEPS),
      attendance30d,
      attendanceTerm: Math.min(99, attendance30d + Math.round(rand() * 8)),
      lcHandle: hasHandle ? `${name.split(" ")[0].toLowerCase()}_${niatId.slice(-3)}` : null,
      lcRating: hasHandle ? Math.round(1250 + rand() * 650 + level * 60) : null,
      contestsAttended: hasHandle ? Math.max(0, 12 - streak - Math.floor(rand() * 5)) : 0,
      lastInteractionDays: gap,
      interactions: 2 + Math.floor(rand() * 12),
      standing: STANDINGS[serial % STANDINGS.length],
      lastTestScore: Math.round(below >= 2 ? 10 + rand() * 9 : 20 + rand() * 28),
      risk,
      flags: riskFlags(risk),
      joinedOn: "2026-08-12",
    });
  }
  return rows;
}

export const ROSTER: RosterStudent[] = build();
export const ROSTER_TOTAL_IN_PRODUCTION = 961;
