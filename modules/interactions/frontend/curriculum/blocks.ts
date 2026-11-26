import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/common/data/cache";
import { authMode } from "@/common/auth/config";
import { getDb } from "@/common/db/pool";

/**
 * Curriculum blocks (core.curriculum_blocks): the rows of a level's interaction sheet, each with
 * its rules (step, step-wise rating, how many to ask, hints, revisit, time, expectation) and its
 * pool of questions (questions point at their block). A block with no topic applies to the whole
 * level. Until the migration (20261127000001_curriculum_blocks) has run on a database, there are no
 * blocks and the Curriculum page shows questions as before.
 */
export type Block = {
  id: string;
  level: number;
  /** Topic name; null = the whole level. */
  topic: string | null;
  position: number;
  step: string;
  ratingStep: string;
  poolNote: string;
  ask: string;
  hints: string;
  revisit: string;
  minutes: string;
  expectation: string;
};

const known = globalThis as unknown as { __curriculumBlocks?: { ok: boolean; at: number } };

/**
 * Whether this database has the blocks table and the new question columns. Remembered once true;
 * while false it's checked again at most once a minute (so running the migration needs no restart).
 */
export async function hasBlocks(): Promise<boolean> {
  if (authMode() !== "database") return false;
  const k = known.__curriculumBlocks;
  if (k && (k.ok || Date.now() - k.at < 60_000)) return k.ok;
  const { rows } = await getDb().query<{ ok: boolean }>(
    `SELECT to_regclass('core.curriculum_blocks') IS NOT NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'curriculum_questions' AND column_name = 'body') AS ok`,
  );
  known.__curriculumBlocks = { ok: !!rows[0]?.ok, at: Date.now() };
  return known.__curriculumBlocks.ok;
}

/** Every live block, in sheet order per level and topic. Empty without the database or before the migration. */
export async function listBlocks(): Promise<Block[]> {
  if (!(await hasBlocks())) return [];
  return cachedBlocks();
}

async function cachedBlocks(): Promise<Block[]> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 900 });
  cacheTag(TAGS.curriculum);
  const { rows } = await getDb().query<{
    id: string;
    level: number;
    topic: string | null;
    position: number;
    step: string;
    rating_step: string;
    pool_note: string;
    ask: string;
    hints: string;
    revisit: string;
    minutes: string;
    expectation: string;
  }>(
    `SELECT b.id, b.level, t.name AS topic, b.position, b.step, b.rating_step, b.pool_note, b.ask, b.hints, b.revisit, b.minutes, b.expectation
     FROM core.curriculum_blocks b LEFT JOIN core.curriculum_topics t ON t.id = b.topic_id
     WHERE NOT b.archived ORDER BY b.level, t.position NULLS FIRST, b.position`,
  );
  return rows.map((r) => ({
    id: r.id,
    level: r.level,
    topic: r.topic,
    position: r.position,
    step: r.step,
    ratingStep: r.rating_step,
    poolNote: r.pool_note,
    ask: r.ask,
    hints: r.hints,
    revisit: r.revisit,
    minutes: r.minutes,
    expectation: r.expectation,
  }));
}
