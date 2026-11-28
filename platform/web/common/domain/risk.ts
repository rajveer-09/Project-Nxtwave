/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

/**
 * At-risk rules: the single definition used by Home, the Students list and the
 * Student page (UI plan UI-8: "flags from one shared rules source"). Thresholds
 * will move to core settings so admins can tune them.
 */
export const RISK_THRESHOLDS = {
  attendancePct: 75,
  interactionGapDays: 14,
  missedContestsInARow: 3,
  weeksAtLevel: 6,
  testsBelowPassOutOfLast3: 2,
} as const;

export type FlagKey = "attendance" | "interaction" | "contests" | "level" | "tests";

export const FLAG_LABEL: Record<FlagKey, string> = {
  attendance: `DSA attendance < ${RISK_THRESHOLDS.attendancePct}%`,
  interaction: `No interaction ${RISK_THRESHOLDS.interactionGapDays}d+`,
  contests: "Missed contests",
  level: "Stuck on level",
  tests: "Below pass in tests",
};

export type RiskInput = {
  /** Null when nothing is marked in the last 30 days. */
  attendance30d: number | null;
  daysSinceInteraction: number | null;
  contestAbsentStreak: number;
  weeksAtLevel: number;
  testsBelowPassLast3: number;
};

export function riskFlags(input: RiskInput): FlagKey[] {
  const flags: FlagKey[] = [];
  if (input.attendance30d !== null && input.attendance30d < RISK_THRESHOLDS.attendancePct) flags.push("attendance");
  if (input.daysSinceInteraction === null || input.daysSinceInteraction >= RISK_THRESHOLDS.interactionGapDays) flags.push("interaction");
  if (input.contestAbsentStreak >= RISK_THRESHOLDS.missedContestsInARow) flags.push("contests");
  if (input.weeksAtLevel >= RISK_THRESHOLDS.weeksAtLevel) flags.push("level");
  if (input.testsBelowPassLast3 >= RISK_THRESHOLDS.testsBelowPassOutOfLast3) flags.push("tests");
  return flags;
}

/** A flag with its reason spelled out from the student's own numbers (for display). */
export type FlagWithDetail = { key: FlagKey; detail: string };

/** Pairs each of a student's flags with its human-readable reason (flagDetail). */
export function flagsWithDetail(flags: FlagKey[], input: RiskInput): FlagWithDetail[] {
  return flags.map((key) => ({ key, detail: flagDetail(key, input) }));
}

/** Human-readable reason, e.g. for the flags banner on the Student page. */
export function flagDetail(key: FlagKey, input: RiskInput): string {
  switch (key) {
    case "attendance":
      return `DSA attendance ${input.attendance30d}% (below ${RISK_THRESHOLDS.attendancePct}%)`;
    case "interaction":
      return input.daysSinceInteraction === null ? "No interaction yet" : `No interaction for ${input.daysSinceInteraction} days`;
    case "contests":
      return `Missed the last ${input.contestAbsentStreak} contests`;
    case "level":
      return `${input.weeksAtLevel} weeks at the current level`;
    case "tests":
      return `Below pass in ${input.testsBelowPassLast3} of the last 3 weekly tests`;
  }
}
