/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { authMode } from "@/common/auth/config";
import { hasPanel, type SessionUser } from "@/common/auth/roles";
import { expire, TAGS } from "@/common/data/cache";
import { withChange } from "@/common/db/change";
import type { Db } from "@/common/auth/core/db";
import { getDb } from "@/common/db/pool";
import { MAX_LEVEL, stepRank, structureFromCode, type Structure } from "./lib/structure";

/**
 * Loads and edits the roadmap's structure (core.curriculum_levels / _topics / _subtopics / _steps).
 * Senior instructors, admins and super admins edit it. Every change runs through withChange, so the
 * change log records who made it. Names are stored as text in interaction logs, so items are never
 * deleted (archive instead), and a name can only be corrected while nothing has been logged with it.
 */

const fromDb = () => authMode() === "database";
export const canEditCurriculum = (user: SessionUser) => hasPanel(user.role);

export async function getStructure(): Promise<Structure> {
  if (!fromDb()) return structureFromCode();
  return cachedStructure();
}

async function cachedStructure(): Promise<Structure> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag(TAGS.curriculum);
  const db = getDb();
  const [levels, topics, subtopics, steps] = await Promise.all([
    db.query<{ level: number; title: string }>("SELECT level, title FROM core.curriculum_levels ORDER BY level"),
    db.query<{ id: string; level: number; name: string; max_step: string | null; required: boolean; archived: boolean }>(
      "SELECT id, level, name, max_step, required, archived FROM core.curriculum_topics ORDER BY level, position, created_at",
    ),
    db.query<{ id: string; topic_id: string; name: string; archived: boolean }>(
      "SELECT id, topic_id, name, archived FROM core.curriculum_subtopics ORDER BY position, created_at",
    ),
    db.query<{ code: string; label: string; archived: boolean }>("SELECT code, label, archived FROM core.curriculum_steps"),
  ]);
  return {
    steps: steps.rows.map((r) => ({ code: r.code, label: r.label, archived: r.archived })).sort((a, b) => stepRank(a.code) - stepRank(b.code)),
    levels: levels.rows.map((l) => ({
      level: l.level,
      title: l.title,
      topics: topics.rows
        .filter((t) => t.level === l.level)
        .map((t) => ({
          id: t.id,
          name: t.name,
          maxStep: t.max_step,
          required: t.required,
          archived: t.archived,
          subtopics: subtopics.rows.filter((s) => s.topic_id === t.id).map((s) => ({ id: s.id, name: s.name, archived: s.archived })),
        })),
    })),
  };
}

// ---------------------------------------------------------------- edits

type Result = { ok: true; message: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** Runs one edit as `user`, logged as a NxtOne change, then refreshes everything that reads the roadmap. */
async function edit(user: SessionUser, work: (db: Db) => Promise<Result>): Promise<Result> {
  if (!canEditCurriculum(user)) return fail("Only senior instructors and admins change the curriculum.");
  if (!fromDb()) return fail("Editing the roadmap needs the database.");
  try {
    const result = await withChange(user, "ui", "Question Bank", async (db) => {
      const r = await work(db);
      if (!r.ok) throw new Refused(r.error);
      return r;
    });
    expire(TAGS.curriculum);
    return result;
  } catch (err) {
    if (err instanceof Refused) return fail(err.message);
    if ((err as { code?: string }).code === "23505") return fail("That name is already used here.");
    throw err;
  }
}
class Refused extends Error {}

/** Names are joined with commas in the logs; keep them short and comma-free. */
function cleanName(raw: string): string | Result {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return fail("Give it a name.");
  if (name.length > 80) return fail("Keep the name under 80 characters.");
  if (name.includes(",")) return fail("Names can't contain a comma.");
  return name;
}

// Has anything been logged with this topic / subtopic name? Then the name stays as it is.
async function topicInUse(db: Db, level: number, name: string) {
  const { rows } = await db.query<{ used: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM logs.students WHERE level = $1 AND current_topic = $2)
         OR EXISTS (SELECT 1 FROM logs.interactions WHERE COALESCE(level, 0) = $1 AND $2 = ANY (regexp_split_to_array(topics, '\\s*,\\s*'))) AS used`,
    [level, name],
  );
  return rows[0].used;
}
async function subtopicInUse(db: Db, level: number, topic: string, name: string) {
  const { rows } = await db.query<{ used: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM logs.students WHERE level = $1 AND current_topic = $2 AND current_subtopic = $3)
         OR EXISTS (SELECT 1 FROM logs.interactions WHERE COALESCE(level, 0) = $1 AND $3 = ANY (regexp_split_to_array(subtopics, '\\s*,\\s*'))
                      AND $2 = ANY (regexp_split_to_array(topics, '\\s*,\\s*'))) AS used`,
    [level, topic, name],
  );
  return rows[0].used;
}

export function addLevel(user: SessionUser, rawTitle: string) {
  return edit(user, async (db) => {
    const title = rawTitle.replace(/\s+/g, " ").trim().slice(0, 80);
    const { rows } = await db.query<{ next: number }>("SELECT COALESCE(max(level), -1) + 1 AS next FROM core.curriculum_levels");
    const level = rows[0].next;
    if (level > MAX_LEVEL) return fail(`The roadmap can have up to Level ${MAX_LEVEL}.`);
    await db.query("INSERT INTO core.curriculum_levels (level, title, created_by) VALUES ($1, $2, $3)", [level, title, user.name]);
    return { ok: true, message: `Added Level ${level}. Add its topics next.` };
  });
}

export function setLevelTitle(user: SessionUser, level: number, rawTitle: string) {
  return edit(user, async (db) => {
    const title = rawTitle.replace(/\s+/g, " ").trim().slice(0, 80);
    const { rows } = await db.query("UPDATE core.curriculum_levels SET title = $2 WHERE level = $1 RETURNING level", [level, title]);
    return rows.length ? { ok: true, message: title ? `Level ${level} is now "${title}".` : `Removed the title of Level ${level}.` } : fail("Level not found.");
  });
}

/**
 * Deletes the last level with its topics, subtopics and questions, but only if nothing ever used it:
 * no student is at it and no interaction was logged at it (logs and progress keep level numbers, so a
 * used level, or one in the middle, stays; archive its topics instead). One change-log entry records
 * it (migration 20261122000002).
 */
export function deleteLevel(user: SessionUser, level: number) {
  return edit(user, async (db) => {
    const { rows } = await db.query<{ last: number | null }>("SELECT max(level) AS last FROM core.curriculum_levels");
    const last = rows[0].last;
    if (last === null || level !== last) return fail(`Only the last level (Level ${last}) can be deleted, so the others keep their numbers.`);
    if (level === 0) return fail("Level 0 can't be deleted.");
    const used = await db.query<{ students: number; interactions: number }>(
      `SELECT (SELECT count(*)::int FROM logs.students WHERE level = $1) AS students,
              (SELECT count(*)::int FROM logs.interactions WHERE COALESCE(level, 0) = $1) AS interactions`,
      [level],
    );
    const { students, interactions } = used.rows[0];
    if (students || interactions) {
      const why = [students ? `${students} student${students === 1 ? " is" : "s are"} at it now` : "", interactions ? `${interactions} interaction${interactions === 1 ? " was" : "s were"} logged at it` : ""]
        .filter(Boolean)
        .join(" and ");
      return fail(`Level ${level} is in use (${why}), so it stays. Archive its topics instead.`);
    }
    const counts = await db.query<{ topics: number; questions: number }>(
      `SELECT (SELECT count(*)::int FROM core.curriculum_topics WHERE level = $1) AS topics,
              (SELECT count(*)::int FROM core.curriculum_questions WHERE level = $1) AS questions`,
      [level],
    );
    const { topics, questions } = counts.rows[0];
    const summary = `with ${topics} topic${topics === 1 ? "" : "s"} and ${questions} question${questions === 1 ? "" : "s"}`;
    await db.query("SELECT set_config('app.deleted_summary', $1, true)", [summary]);
    await db.query("UPDATE core.curriculum_questions SET tweak_of = NULL WHERE tweak_of IN (SELECT id FROM core.curriculum_questions WHERE level = $1)", [level]);
    await db.query("DELETE FROM core.curriculum_questions WHERE level = $1", [level]);
    await db.query("DELETE FROM core.curriculum_subtopics WHERE topic_id IN (SELECT id FROM core.curriculum_topics WHERE level = $1)", [level]);
    await db.query("DELETE FROM core.curriculum_topics WHERE level = $1", [level]);
    await db.query("DELETE FROM core.curriculum_levels WHERE level = $1", [level]);
    return { ok: true, message: `Deleted Level ${level} ${summary}.` };
  });
}

export function addTopic(user: SessionUser, level: number, rawName: string, maxStep: string | null, required: boolean) {
  return edit(user, async (db) => {
    const name = cleanName(rawName);
    if (typeof name !== "string") return name;
    const lvl = await db.query("SELECT 1 FROM core.curriculum_levels WHERE level = $1", [level]);
    if (!lvl.rows.length) return fail("Level not found.");
    if (maxStep && !(await db.query("SELECT 1 FROM core.curriculum_steps WHERE code = $1", [maxStep])).rows.length) return fail("Unknown step.");
    await db.query(
      `INSERT INTO core.curriculum_topics (level, name, position, max_step, required, created_by)
       VALUES ($1, $2, (SELECT COALESCE(max(position), 0) + 1 FROM core.curriculum_topics WHERE level = $1), $3, $4, $5)`,
      [level, name, maxStep, required, user.name],
    );
    return { ok: true, message: `Added "${name}" to Level ${level}.` };
  });
}

type TopicRow = { id: string; level: number; name: string; archived: boolean; position: number };
async function getTopic(db: Db, id: string) {
  return (await db.query<TopicRow>("SELECT id, level, name, archived, position FROM core.curriculum_topics WHERE id = $1 FOR UPDATE", [id])).rows[0];
}

export function updateTopic(user: SessionUser, id: string, patch: { name?: string; maxStep?: string | null; required?: boolean }) {
  return edit(user, async (db) => {
    const t = await getTopic(db, id);
    if (!t) return fail("Topic not found.");
    let name = t.name;
    if (patch.name !== undefined) {
      const clean = cleanName(patch.name);
      if (typeof clean !== "string") return clean;
      if (clean !== t.name) {
        if (await topicInUse(db, t.level, t.name)) return fail(`"${t.name}" is already in students' progress or logged interactions, so its name stays. Archive it and add a new topic instead.`);
        name = clean;
        await db.query("UPDATE core.curriculum_questions SET topic = $3 WHERE level = $1 AND topic = $2", [t.level, t.name, name]);
      }
    }
    if (patch.maxStep && !(await db.query("SELECT 1 FROM core.curriculum_steps WHERE code = $1", [patch.maxStep])).rows.length) return fail("Unknown step.");
    await db.query(
      `UPDATE core.curriculum_topics SET name = $2,
              max_step = CASE WHEN $3 THEN $4 ELSE max_step END,
              required = COALESCE($5, required)
       WHERE id = $1`,
      [id, name, patch.maxStep !== undefined, patch.maxStep ?? null, patch.required ?? null],
    );
    return { ok: true, message: name !== t.name ? `Renamed "${t.name}" to "${name}".` : `Saved "${name}".` };
  });
}

export function setTopicArchived(user: SessionUser, id: string, archived: boolean) {
  return edit(user, async (db) => {
    const t = await getTopic(db, id);
    if (!t) return fail("Topic not found.");
    if (archived) {
      const live = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM core.curriculum_topics WHERE level = $1 AND NOT archived", [t.level]);
      if (live.rows[0].n <= 1) return fail(`Level ${t.level} needs at least one topic.`);
    }
    await db.query("UPDATE core.curriculum_topics SET archived = $2 WHERE id = $1", [id, archived]);
    return { ok: true, message: archived ? `Archived "${t.name}". Past interactions keep it.` : `Restored "${t.name}".` };
  });
}

export function moveTopic(user: SessionUser, id: string, direction: -1 | 1) {
  return edit(user, async (db) => {
    const t = await getTopic(db, id);
    if (!t) return fail("Topic not found.");
    const { rows } = await db.query<{ id: string; position: number }>(
      `SELECT id, position FROM core.curriculum_topics WHERE level = $1 AND NOT archived AND id <> $2
         AND CASE WHEN $3 < 0 THEN position <= $4 ELSE position >= $4 END
       ORDER BY CASE WHEN $3 < 0 THEN -position ELSE position END LIMIT 1`,
      [t.level, id, direction, t.position],
    );
    const other = rows[0];
    if (!other) return fail(direction < 0 ? "It's already first." : "It's already last.");
    const swap = other.position === t.position ? t.position + direction : other.position;
    await db.query("UPDATE core.curriculum_topics SET position = CASE WHEN id = $1 THEN $3 ELSE $4 END WHERE id IN ($1, $2)", [id, other.id, swap, t.position]);
    return { ok: true, message: `Moved "${t.name}" ${direction < 0 ? "up" : "down"}.` };
  });
}

type SubtopicRow = { id: string; topic_id: string; name: string; position: number; level: number; topic: string };
async function getSubtopic(db: Db, id: string) {
  return (
    await db.query<SubtopicRow>(
      `SELECT s.id, s.topic_id, s.name, s.position, t.level, t.name AS topic
       FROM core.curriculum_subtopics s JOIN core.curriculum_topics t ON t.id = s.topic_id WHERE s.id = $1 FOR UPDATE OF s`,
      [id],
    )
  ).rows[0];
}

export function addSubtopic(user: SessionUser, topicId: string, rawName: string) {
  return edit(user, async (db) => {
    const name = cleanName(rawName);
    if (typeof name !== "string") return name;
    const t = await getTopic(db, topicId);
    if (!t) return fail("Topic not found.");
    await db.query(
      `INSERT INTO core.curriculum_subtopics (topic_id, name, position, created_by)
       VALUES ($1, $2, (SELECT COALESCE(max(position), 0) + 1 FROM core.curriculum_subtopics WHERE topic_id = $1), $3)`,
      [topicId, name, user.name],
    );
    return { ok: true, message: `Added "${name}" to ${t.name}.` };
  });
}

export function renameSubtopic(user: SessionUser, id: string, rawName: string) {
  return edit(user, async (db) => {
    const s = await getSubtopic(db, id);
    if (!s) return fail("Subtopic not found.");
    const name = cleanName(rawName);
    if (typeof name !== "string") return name;
    if (name === s.name) return { ok: true, message: "No change." };
    if (await subtopicInUse(db, s.level, s.topic, s.name)) return fail(`"${s.name}" is already in students' progress or logged interactions, so its name stays. Archive it and add a new subtopic instead.`);
    await db.query("UPDATE core.curriculum_questions SET subtopic = $4 WHERE level = $1 AND topic = $2 AND subtopic = $3", [s.level, s.topic, s.name, name]);
    await db.query("UPDATE core.curriculum_subtopics SET name = $2 WHERE id = $1", [id, name]);
    return { ok: true, message: `Renamed "${s.name}" to "${name}".` };
  });
}

export function setSubtopicArchived(user: SessionUser, id: string, archived: boolean) {
  return edit(user, async (db) => {
    const s = await getSubtopic(db, id);
    if (!s) return fail("Subtopic not found.");
    await db.query("UPDATE core.curriculum_subtopics SET archived = $2 WHERE id = $1", [id, archived]);
    return { ok: true, message: archived ? `Archived "${s.name}". Past interactions keep it.` : `Restored "${s.name}".` };
  });
}

export function moveSubtopic(user: SessionUser, id: string, direction: -1 | 1) {
  return edit(user, async (db) => {
    const s = await getSubtopic(db, id);
    if (!s) return fail("Subtopic not found.");
    const { rows } = await db.query<{ id: string; position: number }>(
      `SELECT id, position FROM core.curriculum_subtopics WHERE topic_id = $1 AND NOT archived AND id <> $2
         AND CASE WHEN $3 < 0 THEN position <= $4 ELSE position >= $4 END
       ORDER BY CASE WHEN $3 < 0 THEN -position ELSE position END LIMIT 1`,
      [s.topic_id, id, direction, s.position],
    );
    const other = rows[0];
    if (!other) return fail(direction < 0 ? "It's already first." : "It's already last.");
    const swap = other.position === s.position ? s.position + direction : other.position;
    await db.query("UPDATE core.curriculum_subtopics SET position = CASE WHEN id = $1 THEN $3 ELSE $4 END WHERE id IN ($1, $2)", [id, other.id, swap, s.position]);
    return { ok: true, message: `Moved "${s.name}" ${direction < 0 ? "up" : "down"}.` };
  });
}

const cleanLabel = (raw: string) => raw.replace(/\s+/g, " ").trim();

export function addStep(user: SessionUser, rawCode: string, rawLabel: string) {
  return edit(user, async (db) => {
    const code = rawCode.trim();
    const label = cleanLabel(rawLabel);
    if (!/^[1-9]\d?\.[1-9]\d?$/.test(code)) return fail("Write the step as a number like 4.2.");
    if (!label || label.length > 80) return fail("Describe the step in under 80 characters.");
    await db.query("INSERT INTO core.curriculum_steps (code, label, created_by) VALUES ($1, $2, $3)", [code, label, user.name]);
    return { ok: true, message: `Added step ${code}.` };
  });
}

export function updateStep(user: SessionUser, code: string, patch: { label?: string; archived?: boolean }) {
  return edit(user, async (db) => {
    const label = patch.label === undefined ? null : cleanLabel(patch.label);
    if (label !== null && (!label || label.length > 80)) return fail("Describe the step in under 80 characters.");
    if (patch.archived) {
      const live = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM core.curriculum_steps WHERE NOT archived AND code <> $1", [code]);
      if (!live.rows[0].n) return fail("Keep at least one step.");
    }
    const { rows } = await db.query(
      "UPDATE core.curriculum_steps SET label = COALESCE($2, label), archived = COALESCE($3, archived) WHERE code = $1 RETURNING code",
      [code, label, patch.archived ?? null],
    );
    if (!rows.length) return fail("Step not found.");
    return { ok: true, message: patch.archived === true ? `Archived step ${code}. Past interactions keep it.` : patch.archived === false ? `Restored step ${code}.` : `Saved step ${code}.` };
  });
}
