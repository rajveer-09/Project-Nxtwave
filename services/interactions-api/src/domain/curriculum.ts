// Ported from Instructor_Evaluation lib/multiLevelCurriculum.ts.

// Levels -> topics -> subtopics -> steps. The roadmap lives in the hub's database (core.curriculum_levels,
// _topics, _subtopics, _steps; edited on the hub's Curriculum page). refreshCurriculum() reloads it at most
// every 30 seconds (app.ts runs it before each request); until it has loaded, or where the core schema isn't
// set up (this service's own CI database), the roadmap below is used. Archived items are left out of every
// list but still pass validation, so past interactions and students already on them stay valid.

type Topic = { name: string; maxStep: string | null; required: boolean; archived: boolean; subtopics: { name: string; archived: boolean }[] };
type Roadmap = { levels: Map<number, Topic[]>; steps: { code: string; label: string; archived: boolean }[] };

// Level 0: topic and step dropdowns offer the same items. Every student starts at Level 0 / Introduction / Introduction.
const LEVEL_0_ITEMS = ['Introduction', 'Data Types', 'If else', 'Loops', 'Traversal', 'Time & Space Complexity analysis', 'Pattern Questions'];

// A student's current step on a topic ("2.1 easy - standard question"). A topic's last step (max_step) cuts it short.
export const BASE_STEP_SEQUENCE = [
  '1.1 Concept & Prerequisites',
  '1.2 Complexity & Reasoning',
  '1.3 Concept Explanation + own testCase / Example',
  '2.1 easy - standard question',
  '2.2 easy - tweaked question',
  '3.1 medium standard question',
  '3.2 medium tweaked question',
  '4.1 hard standard question',
  '4.2 hard tweaked question',
];

const LAUNCH_TOPICS: Record<number, string[]> = {
  0: LEVEL_0_ITEMS,
  1: ['Maths', 'STL', 'Arrays', 'String'],
  2: ['Recursion - Basics', 'Sorting', 'Binary Search'],
  3: ['Two pointers / Sliding window', 'Greedy Algorithms'],
  4: ['Bit Manipulation', 'Stack & Queues', 'Stack - Monotonic Stack'],
  5: ["Heaps / PQ's", 'Linked list', 'Recursion - Advanced', 'AdHoc'],
  6: ['Dynamic Programming'],
  7: ['Binary Trees', 'Binary Search Trees', 'Graphs', 'Advanced Graph'],
};
const LAUNCH_SUBTOPICS: Record<string, string[]> = {
  '1|Maths': ['Digit Manipulation', 'LCM & GCD', 'Prime Numbers', 'Fast Exponentiation'],
  '1|STL': ['Set / Unordered Set', 'Map / Unordered Map', 'Stack', 'Queue'],
  '1|Arrays': ['Array Traversal', 'Prefix & Suffix sum', "Kadane's Algo", 'Array Adhoc', 'Array + Map / Set'],
};
const LAUNCH_STEPS = [
  { code: '1.1', label: 'Theory: concept & prerequisites' },
  { code: '1.2', label: 'Theory: complexity & reasoning' },
  { code: '2.1', label: 'Easy standard question' },
  { code: '2.2', label: 'Easy tweaked question' },
  { code: '3.1', label: 'Medium standard question' },
  { code: '3.2', label: 'Medium tweaked question' },
  { code: '4.1', label: 'Hard standard question' },
];

function launchRoadmap(): Roadmap {
  const levels = new Map<number, Topic[]>();
  for (const [level, topics] of Object.entries(LAUNCH_TOPICS)) {
    levels.set(Number(level), topics.map((name) => ({
      name,
      maxStep: level === '1' ? '3.2' : null,
      required: !(level === '0' && (name === 'Introduction' || name === 'Data Types')),
      archived: false,
      subtopics: (LAUNCH_SUBTOPICS[`${level}|${name}`] ?? []).map((sub) => ({ name: sub, archived: false })),
    })));
  }
  return { levels, steps: LAUNCH_STEPS.map((s) => ({ ...s, archived: false })) };
}

const levelNum = (label: string | undefined) => Number((label ?? 'Level 0').replace(/^Level\s+/, ''));
const stepRank = (code: string) => {
  const [major, minor] = code.split('.').map(Number);
  return (major || 0) * 100 + (minor || 0);
};

let roadmap = launchRoadmap();

// Level names as stored on interactions ("Level 3"). Only levels with at least one topic can be used. Kept as
// one array that is updated in place, so importers always see the current list.
export const LEVELS: string[] = [];
function setLevels() {
  LEVELS.splice(0, LEVELS.length, ...[...roadmap.levels.entries()].filter(([, topics]) => topics.length).map(([n]) => `Level ${n}`).sort((a, b) => levelNum(a) - levelNum(b)));
}
setLevels();

const topicsOf = (level: string | undefined) => roadmap.levels.get(levelNum(level)) ?? [];
const findTopic = (level: string | undefined, topic: string | undefined) => topicsOf(level).find((t) => t.name === (topic || '').trim());

// ---------------------------------------------------------------- loading from the hub

type Query = (sql: string) => Promise<{ rows: any[] }>;
const TTL_MS = 30_000;
let loadedAt = 0;
let loading: Promise<void> | undefined;

/** Reloads the roadmap from core when it is older than 30 s. Never throws: on a failure the last one stays. */
export function refreshCurriculum(query: Query): Promise<void> {
  if (Date.now() - loadedAt < TTL_MS) return Promise.resolve();
  loading ??= (async () => {
    try {
      const { rows: [present] } = await query("SELECT to_regclass('core.curriculum_topics') IS NOT NULL AS ok");
      if (!present?.ok) return;
      const [levels, topics, subtopics, steps] = await Promise.all([
        query('SELECT level FROM core.curriculum_levels'),
        query('SELECT id, level, name, max_step, required, archived FROM core.curriculum_topics ORDER BY level, archived, position, created_at'),
        query('SELECT topic_id, name, archived FROM core.curriculum_subtopics ORDER BY archived, position, created_at'),
        query('SELECT code, label, archived FROM core.curriculum_steps'),
      ]);
      const next: Roadmap = { levels: new Map(levels.rows.map((r) => [Number(r.level), [] as Topic[]])), steps: [] };
      for (const t of topics.rows) {
        next.levels.get(Number(t.level))?.push({
          name: t.name,
          maxStep: t.max_step,
          required: t.required,
          archived: t.archived,
          subtopics: subtopics.rows.filter((s) => s.topic_id === t.id).map((s) => ({ name: s.name, archived: s.archived })),
        });
      }
      next.steps = steps.rows.map((s) => ({ code: s.code, label: s.label, archived: s.archived })).sort((a, b) => stepRank(a.code) - stepRank(b.code));
      roadmap = next;
      setLevels();
    } catch (err) {
      console.error('[curriculum] could not load the roadmap, keeping the last one:', (err as Error).message);
    } finally {
      loadedAt = Date.now();
      loading = undefined;
    }
  })();
  return loading;
}

// ---------------------------------------------------------------- lookups (names as in the original app)

/** Topics that can be picked now, in teaching order. */
export function getTopicOptions(level: string): string[] {
  return topicsOf(level).filter((t) => !t.archived).map((t) => t.name);
}

/** A topic of the level, archived ones included (they stay valid for students already on them). */
export const isKnownTopic = (level: string | undefined, topic: string | undefined) => !!findTopic(level, topic);

/** Topics that count towards completing the level. */
export function getRequiredTopics(level: string): string[] {
  return topicsOf(level).filter((t) => !t.archived && t.required).map((t) => t.name);
}

/** Subtopics that can be picked now, in teaching order. */
export function getSubtopicOptions(level: string, topic: string | undefined): string[] {
  return (findTopic(level, topic)?.subtopics ?? []).filter((s) => !s.archived).map((s) => s.name);
}

export const isKnownSubtopic = (level: string | undefined, topic: string | undefined, subtopic: string) =>
  !!findTopic(level, topic)?.subtopics.some((s) => s.name === subtopic);

// The subtopic to store for a topic: the given one when it belongs to the topic, else the topic's first
// subtopic, or null when the topic has none.
export function coerceSubtopic(level: string, topic: string, subtopic: string | null | undefined): string | null {
  const options = getSubtopicOptions(level, topic);
  if (subtopic && isKnownSubtopic(level, topic, subtopic)) return subtopic;
  return options[0] ?? null;
}

// "Level 3" → "3", for narrow table columns.
export const levelShortLabel = (level: string) => level.replace(/^Level\s+/, '');

export function getStepOptionsForTopic(level: string, topic: string | undefined): string[] {
  if (levelNum(level) === 0) return topicsOf(level).map((t) => t.name);
  const max = findTopic(level, topic)?.maxStep;
  return BASE_STEP_SEQUENCE.filter((name) => !max || stepRank(name.split(' ')[0]) <= stepRank(max));
}

export function getDefaultTopicForLevel(level: string): string {
  return getTopicOptions(level)[0];
}

export function getDefaultStepForLevel(level: string): string {
  return getStepOptionsForTopic(level, getDefaultTopicForLevel(level))[0];
}

// Step reached in an interaction, picked per subtopic (or per topic when it has no subtopics). "3.1" means
// the student solved up to a medium standard question there. Level 0 has no steps.
export function getReachedStepOptions(level: string | undefined): Array<{ code: string; label: string }> {
  return !level || levelNum(level) === 0 ? [] : roadmap.steps.filter((s) => !s.archived).map(({ code, label }) => ({ code, label }));
}

/** Step codes accepted on an interaction, archived ones included. */
export function getKnownStepCodes(level: string | undefined): string[] {
  return !level || levelNum(level) === 0 ? [] : roadmap.steps.map((s) => s.code);
}

// Step assumed for interactions logged (from Level 1 up) before steps existed, until an instructor edits it
// (user, 2026-10-22): 3.1 when the interaction was Cleared, else (Need to Revisit / In Progress) 2.1.
export const pastDefaultStep = (status: string | undefined) => (status === 'Cleared' ? '3.1' : '2.1');

// "3.1" → "3.1 Medium standard question"; unknown codes are shown as stored.
export function reachedStepLabel(code: string): string {
  const step = roadmap.steps.find((s) => s.code === code);
  return step ? `${step.code} ${step.label}` : code;
}

// Keeps a step valid after the topic changes (e.g. a Level 2 "4.1 hard" step moved to a Level 1 topic).
export function coerceStep(level: string, topic: string, step: string | undefined): string {
  const options = getStepOptionsForTopic(level, topic);
  return step && options.includes(step) ? step : options[0];
}
