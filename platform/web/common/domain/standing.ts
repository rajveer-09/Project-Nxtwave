/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

/**
 * A student's standing at their CURRENT DSA level: the outcome of the latest interaction logged at
 * that level. No interaction at the current level yet means "pending", so a student who has just
 * moved up is pending again until someone evaluates them at the new level.
 */
export const STANDINGS = ["pending", "in_progress", "revisit", "cleared"] as const;
export type Standing = (typeof STANDINGS)[number];

export const STANDING_LABEL: Record<Standing, string> = {
  pending: "Not interacted yet",
  in_progress: "In progress",
  revisit: "Needs revisit",
  cleared: "Cleared",
};

export const STANDING_HINT: Record<Standing, string> = {
  pending: "No interaction at their current level",
  in_progress: "Evaluation ongoing",
  revisit: "To be evaluated again",
  cleared: "Ready for the next level",
};

/** Interaction outcome as stored in logs.interactions.status_post_interaction → standing. */
export function standingFromOutcome(outcome: string | null | undefined): Standing {
  if (outcome === "Cleared") return "cleared";
  if (outcome === "Need to Revisit") return "revisit";
  if (outcome === "In Progress") return "in_progress";
  return "pending";
}

export const isStanding = (value: string | undefined): value is Standing => (STANDINGS as readonly string[]).includes(value ?? "");
