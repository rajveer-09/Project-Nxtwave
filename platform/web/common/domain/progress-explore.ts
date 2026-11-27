/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

/**
 * The Student page's DSA progress, every level and topic at once, so the section can be explored by
 * clicking: a level shows its topics, a topic or subtopic shows how far the student got on its steps
 * (from what was logged) and the interaction rounds that covered it.
 */

/** done: reached; now: where the student is; started: some rounds logged (subtopics only); todo: not yet. */
export type StepState = "done" | "now" | "started" | "todo";
export type ExploreStep = { code: string; label: string; state: StepState };
/** stepsNote: why the steps aren't filled although it's cleared (no step was recorded for it). */
export type ExploreItem = { name: string; state: StepState; steps: ExploreStep[]; stepsNote?: string | null };
/** covered: not reached by the roster position, but rounds were logged on it. */
export type ExploreTopic = { name: string; state: "cleared" | "current" | "covered" | "not-started"; steps: ExploreStep[]; stepsNote?: string | null; subtopics: ExploreItem[] };
export type ExploreLevel = { level: number; title: string; state: "cleared" | "current" | "future"; topics: ExploreTopic[] };

/** One interaction round, with what it covered (for filtering by topic / subtopic). */
export type ExploreRound = {
  id: string;
  date: string;
  round: number;
  by: string;
  status: string;
  rating: number;
  level: number;
  topics: string[];
  subtopics: string[];
  /** Step reached per topic or subtopic name. */
  reached: Record<string, string>;
  questions: { title: string; tag: string }[];
};

export type ProgressExplore = { level: number; topic: string; subtopic: string | null; levels: ExploreLevel[]; rounds: ExploreRound[] };

type Basic = {
  level: number;
  topic: string;
  subtopic: string | null;
  levels: { level: number; state: string }[];
  topics: { name: string; state: string; subtopics: { name: string; state: string }[] }[];
  steps: { code: string; label: string; state: string }[];
};

/** Without the full curriculum (sample data): the current level only, as the section always showed it. */
export function basicExplore(p: Basic): ProgressExplore {
  return {
    level: p.level,
    topic: p.topic,
    subtopic: p.subtopic,
    rounds: [],
    levels: p.levels.map((l) => ({
      level: l.level,
      title: "",
      state: l.state as ExploreLevel["state"],
      topics:
        l.level !== p.level
          ? []
          : p.topics.map((t) => {
              const steps = p.steps.map((s) => ({
                code: s.code,
                label: s.label,
                state: (t.state === "cleared" ? "done" : t.state === "current" ? s.state : "todo") as StepState,
              }));
              return {
                name: t.name,
                state: t.state as ExploreTopic["state"],
                steps,
                subtopics: t.subtopics.map((sub) => ({ name: sub.name, state: sub.state as StepState, steps: sub.state === "now" ? steps : steps.map((s) => ({ ...s, state: (sub.state === "done" ? "done" : "todo") as StepState })) })),
              };
            }),
    })),
  };
}
