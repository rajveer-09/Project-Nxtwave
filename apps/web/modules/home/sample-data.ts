/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

/**
 * Sample data for UI-0 / UI-8 while the APIs are being built (UI plan §5).
 * Fictional names; NIAT IDs use the N99 demo prefix. Replace with /api/core/home.
 */
import type { Trend } from "@/common/components/stat-card";

export type HomeKpi = { module: string; label: string; value: string; sub: string; delta: string; trend: Trend };

export type AtRiskStudent = {
  niatId: string;
  name: string;
  college: "BITS" | "CDU";
  section: string;
  hall: string;
  attendance30d: number;
  lastInteractionDays: number;
  contestsAttended: number;
  flags: string[];
};

export const homeKpis: HomeKpi[] = [
  { module: "Attendance", label: "Present today", value: "91.4%", sub: "792 of 866 marked · 2 halls not marked yet", delta: "+1.2 pts vs last Monday", trend: "good" },
  { module: "Attendance", label: "Last 30 days", value: "84.7%", sub: "63 students below 75%", delta: "−0.8 pts vs previous 30 days", trend: "bad" },
  { module: "Interactions", label: "Logged this week", value: "142", sub: "38 students with none in 14+ days", delta: "+18 vs last week", trend: "good" },
  { module: "Contests", label: "Weekly 476 participation", value: "48%", sub: "412 of 864 verified handles", delta: "−3 pts vs Weekly 475", trend: "bad" },
];

export const atRiskStudents: AtRiskStudent[] = [
  { niatId: "N99H01A0142", name: "Aarav Mehta", college: "BITS", section: "S004", hall: "Hall 3", attendance30d: 61, lastInteractionDays: 19, contestsAttended: 0, flags: ["Attendance < 75%", "No interaction 14d+", "Missed 4 contests"] },
  { niatId: "N99H01B0154", name: "Ananya Iyer", college: "CDU", section: "IB-2", hall: "Hall 11", attendance30d: 72, lastInteractionDays: 15, contestsAttended: 3, flags: ["Attendance < 75%", "No interaction 14d+"] },
  { niatId: "N99H01A0311", name: "Kabir Nair", college: "BITS", section: "S009", hall: "Hall 7", attendance30d: 88, lastInteractionDays: 23, contestsAttended: 2, flags: ["No interaction 14d+", "Level 1 for 6 weeks"] },
  { niatId: "N99H01B0087", name: "Diya Reddy", college: "CDU", section: "IB-2", hall: "Hall 11", attendance30d: 68, lastInteractionDays: 6, contestsAttended: 1, flags: ["Attendance < 75%"] },
  { niatId: "N99H01A0420", name: "Meera Pillai", college: "BITS", section: "S001", hall: "Hall 1", attendance30d: 70, lastInteractionDays: 9, contestsAttended: 1, flags: ["Attendance < 75%"] },
  { niatId: "N99H01A0098", name: "Rohan Gupta", college: "BITS", section: "S004", hall: "Hall 3", attendance30d: 79, lastInteractionDays: 4, contestsAttended: 0, flags: ["Missed 4 contests"] },
];

export const levelDistribution = [
  { label: "L0", value: 312 },
  { label: "L1", value: 288 },
  { label: "L2", value: 196 },
  { label: "L3", value: 104 },
  { label: "L4", value: 42 },
  { label: "L5", value: 15 },
  { label: "L6", value: 5 },
  { label: "L7", value: 2 },
];

export const hallAttendance = [
  { label: "Hall 1", value: 92 },
  { label: "Hall 2", value: 89 },
  { label: "Hall 3", value: 71 },
  { label: "Hall 7", value: 86 },
  { label: "Hall 9", value: 83 },
  { label: "Hall 11", value: 74 },
].map((hall) => ({ ...hall, display: `${hall.value}%`, warn: hall.value < 75 }));

export const adminTodo = [
  { href: "/admin/curriculum", label: "5 off-roadmap questions to review", urgent: true },
  { href: "/attendance", label: "2 halls not marked today", urgent: false },
  { href: "/contests", label: "Biweekly 170 draft scan awaiting review", urgent: false },
];

export const latestContest = {
  name: "Weekly Contest 476",
  date: "Sun 15 Nov · final results published",
  tookPart: 412,
  medianSolved: "2 / 4",
  bestGlobalRank: "1,204",
};
