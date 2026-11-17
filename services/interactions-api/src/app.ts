/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AuthError, actorFrom } from './auth.ts';
import { getPool } from './db/pool.ts';
import {
  ForbiddenError, ValidationError, addInteraction, assignStudentsToInstructor, createInstructor, deleteInteraction,
  getInstructorChanges, getInstructorList, getInstructorOptions, getInteractions, getLevelConversions, getStudents,
  updateInteraction, updateStudentProgress,
} from './db/queries.ts';
import type { Actor, InstructorRole, InteractionLog, NewInstructorInput } from './types.ts';

/*
 * Same routes, permissions and responses as the original Instructor_Evaluation app/api routes,
 * minus its own sign-in (now in the web app). The web app reaches them at /api/logs/*.
 */

type Run = (actor: Actor) => Promise<Response>;

// Runs `run` for the request's actor (401/403 otherwise); `roles` limits which roles may call the route.
async function withActor(c: Context, run: Run, roles?: InstructorRole[]): Promise<Response> {
  try {
    const actor = await actorFrom(c.req.header('authorization'));
    if (roles && !roles.includes(actor.role)) return c.json({ error: 'You do not have access to this.' }, 403);
    return await run(actor);
  } catch (err) {
    if (err instanceof AuthError) return c.json({ error: err.message }, err.status);
    if (err instanceof ValidationError) return c.json({ error: err.message }, 400);
    if (err instanceof ForbiddenError) return c.json({ error: err.message }, 403);
    console.error(err);
    return c.json({ error: 'Database request failed.' }, 500);
  }
}

async function body<T>(c: Context): Promise<Partial<T>> {
  const value: unknown = await c.req.json().catch(() => ({}));
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<T>) : {};
}

const ALL: InstructorRole[] | undefined = undefined;

export function createApp() {
  const app = new Hono();

  // Wispr Flow transcripts can be long; nothing legitimate comes near this.
  app.use('/api/*', bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) => c.json({ error: 'Request is too large.' }, 413) }));
  app.use('/api/*', async (c, next) => {
    await next();
    c.header('cache-control', 'private, no-store');
  });

  app.get('/health', async (c) => {
    try {
      await getPool().query('SELECT 1');
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

  // Interactions: everyone signed in reads; only the student's assigned instructor logs (checked in addInteraction).
  app.get('/api/interactions', (c) => withActor(c, async () => c.json(await getInteractions()), ALL));
  app.post('/api/interactions', (c) => withActor(c, async (actor) => {
    const log = await body<InteractionLog>(c);
    // The client generates the id (as in the original form), so a retry can't log twice.
    if (typeof log.id !== 'string' || !log.id.trim()) return c.json({ error: 'Missing interaction id.' }, 400);
    return c.json(await addInteraction(log as InteractionLog, actor), 201);
  }, ['instructor']));
  // Edit or delete (with a reason): assigned instructor or the author (checked in the queries).
  app.patch('/api/interactions/:id', (c) => withActor(c, async (actor) => {
    return c.json(await updateInteraction(c.req.param('id'), await body<InteractionLog>(c), actor));
  }, ['instructor']));
  app.delete('/api/interactions/:id', (c) => withActor(c, async (actor) => {
    const { reason } = await body<{ reason: string }>(c);
    return c.json(await deleteInteraction(c.req.param('id'), typeof reason === 'string' ? reason : '', actor));
  }, ['instructor']));

  // Students: everyone signed in reads; the assigned instructor updates level / topic / subtopic / step.
  app.get('/api/students', (c) => withActor(c, async () => c.json(await getStudents()), ALL));
  app.patch('/api/students/:id', (c) => withActor(c, async (actor) => {
    const patch = await body<{ level: unknown; currentTopic: unknown; currentSubtopic: unknown; currentStep: unknown }>(c);
    const pick = (value: unknown) => (typeof value === 'string' ? value : undefined);
    const student = await updateStudentProgress(c.req.param('id'), {
      level: pick(patch.level),
      currentTopic: pick(patch.currentTopic),
      currentSubtopic: patch.currentSubtopic === null ? null : pick(patch.currentSubtopic),
      currentStep: pick(patch.currentStep),
    }, actor);
    return student ? c.json(student) : c.json({ error: 'Student not found.' }, 404);
  }, ['instructor']));

  // Instructors: list for admins and seniors; add / assign for admins and seniors (checked in the queries).
  app.get('/api/instructors', (c) => withActor(c, async (actor) => {
    if (actor.role !== 'admin' && !actor.isSenior) return c.json({ error: 'You do not have access to this.' }, 403);
    return c.json(await getInstructorList());
  }, ['admin', 'instructor']));
  app.post('/api/instructors', (c) => withActor(c, async (actor) => {
    const input = await body<NewInstructorInput>(c);
    const result = await createInstructor({
      name: String(input.name ?? ''),
      firstName: String(input.firstName ?? ''),
      email: String(input.email ?? ''),
      password: String(input.password ?? ''),
      studentIds: Array.isArray(input.studentIds) ? input.studentIds.map(String) : [],
    }, actor);
    return c.json(result, 201);
  }, ['admin', 'instructor']));
  // Names and ids for the "Interaction Taken By" dropdown.
  app.get('/api/instructors/options', (c) => withActor(c, async () => c.json(await getInstructorOptions()), ALL));
  app.get('/api/instructors/changes', (c) => withActor(c, async () => c.json(await getInstructorChanges()), ['admin']));
  app.post('/api/instructors/:id/students', (c) => withActor(c, async (actor) => {
    const { studentIds } = await body<{ studentIds: unknown[] }>(c);
    const ids = Array.isArray(studentIds) ? studentIds.map(String) : [];
    return c.json(await assignStudentsToInstructor(c.req.param('id'), ids, actor));
  }, ['admin', 'instructor']));

  // Analytics: level conversions.
  app.get('/api/analytics/level-conversions', (c) => withActor(c, async () => {
    try {
      return c.json(await getLevelConversions());
    } catch (err) {
      if ((err as { code?: string }).code === '42P01') {
        return c.json({ error: 'Level conversion tracking is not set up yet (run npm run migrate).' }, 503);
      }
      throw err;
    }
  }, ALL));

  app.notFound((c) => c.json({ error: 'Not found.' }, 404));
  return app;
}
