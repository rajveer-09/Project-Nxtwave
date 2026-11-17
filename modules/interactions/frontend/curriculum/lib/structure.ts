/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { BASE_STEP_SEQUENCE, getSubtopicOptions, getTopicOptions, LEVELS, REACHED_STEPS } from "@nxtone/interactions-ui/lib/curriculum";

/**
 * The roadmap's structure as stored in core.curriculum_* (platform/db/core/migrations/20261118000005):
 * levels → topics → subtopics, and the steps (1.1, 1.2 …) questions sit at. Safe on the client;
 * the server loads it with getStructure() (../structure.ts). Archived items stay in the structure
 * (past logs name them) but are left out of every picker below.
 */

export type StepDef = { code: string; label: string; archived: boolean };
export type SubtopicDef = { id: string; name: string; archived: boolean };
export type TopicDef = { id: string; name: string; maxStep: string | null; required: boolean; archived: boolean; subtopics: SubtopicDef[] };
export type LevelDef = { level: number; title: string; topics: TopicDef[] };
export type Structure = { levels: LevelDef[]; steps: StepDef[] };

export const MAX_LEVEL = 15;
export const levelName = (level: number) => `Level ${level}`;
export const levelNumber = (name: string) => Number(name.replace(/^Level\s+/, ""));

/** "3.1" → 301, for ordering and "up to" checks. */
export const stepRank = (code: string) => {
  const [major, minor] = code.split(".").map(Number);
  return (major || 0) * 100 + (minor || 0);
};

export const findLevel = (s: Structure, level: number) => s.levels.find((l) => l.level === level);

/** Topics of a level that can be picked now, in teaching order. */
export function liveTopics(s: Structure, level: number): TopicDef[] {
  return (findLevel(s, level)?.topics ?? []).filter((t) => !t.archived);
}
export const topicNames = (s: Structure, level: number) => liveTopics(s, level).map((t) => t.name);

export function findTopic(s: Structure, level: number, topic: string | undefined | null): TopicDef | undefined {
  return findLevel(s, level)?.topics.find((t) => t.name === (topic ?? "").trim());
}

export function subtopicNames(s: Structure, level: number, topic: string | undefined | null): string[] {
  return (findTopic(s, level, topic)?.subtopics ?? []).filter((x) => !x.archived).map((x) => x.name);
}

/** Steps an interaction can reach (Level 0 has none). */
export function reachedSteps(s: Structure, level: number): { code: string; label: string }[] {
  return level === 0 ? [] : s.steps.filter((x) => !x.archived).map(({ code, label }) => ({ code, label }));
}

/** The steps a topic's questions sit at: every live step, up to the topic's last step if it has one. */
export function topicSteps(s: Structure, level: number, topic: string | undefined | null): { code: string; label: string }[] {
  const max = findTopic(s, level, topic)?.maxStep;
  return reachedSteps(s, level).filter((x) => !max || stepRank(x.code) <= stepRank(max));
}

/** A student's step sequence on a topic (Student page progress), from the fixed long step names. */
export function studentSteps(s: Structure, level: number, topic: string | undefined | null): string[] {
  if (level === 0) return topicNames(s, 0);
  const max = findTopic(s, level, topic)?.maxStep;
  return BASE_STEP_SEQUENCE.filter((name) => !max || stepRank(name.split(" ")[0]) <= stepRank(max));
}

/** Levels in order with their display name. */
export const levelList = (s: Structure) => s.levels.map((l) => ({ level: l.level, name: levelName(l.level), title: l.title }));

/** The structure the apps shipped with, for running without the database. */
export function structureFromCode(): Structure {
  return {
    steps: REACHED_STEPS.map((x) => ({ ...x, archived: false })),
    levels: LEVELS.map((name, level) => ({
      level,
      title: "",
      topics: getTopicOptions(name).map((topic) => ({
        id: `${level}|${topic}`,
        name: topic,
        maxStep: level === 1 ? "3.2" : null,
        required: !(level === 0 && (topic === "Introduction" || topic === "Data Types")),
        archived: false,
        subtopics: getSubtopicOptions(name, topic).map((sub) => ({ id: `${level}|${topic}|${sub}`, name: sub, archived: false })),
      })),
    })),
  };
}
