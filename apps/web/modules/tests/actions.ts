/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/common/auth/session";
import { createTest, publishFormat, saveResults, submitResults, unlockResults } from "@/modules/tests/data";
import { BANDS, FIELD_TYPES } from "@/modules/tests/types";

const value = z.union([z.number(), z.string().max(4000), z.array(z.string().max(200)).max(50), z.boolean(), z.null()]);
const rowsSchema = z
  .array(z.object({ niatId: z.string().regex(/^N\d{2}H\d{2}[AB]\d{4}$/), present: z.boolean(), values: z.record(z.string(), value) }))
  .max(500);

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; problems?: Record<string, string[]> };

export async function saveTestResults(testId: string, rows: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Some values couldn't be read. Nothing was saved." };
  const result = await saveResults(user, testId, parsed.data);
  if (result.ok) revalidatePath(`/tests/${testId}`);
  return result.ok ? { ok: true, message: `Saved ${result.saved} student${result.saved === 1 ? "" : "s"}.` } : result;
}

export async function submitTestResults(testId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const result = await submitResults(user, testId);
  if (result.ok) revalidatePath(`/tests/${testId}`);
  return result;
}

export async function unlockTestResults(testId: string, instructor: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const result = await unlockResults(user, testId, instructor);
  if (result.ok) revalidatePath(`/tests/${testId}`);
  return result;
}

const testSchema = z.object({
  name: z.string().trim().min(1).max(80),
  band: z.enum(BANDS),
  heldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  formatId: z.string().min(1),
});

export async function createWeeklyTest(input: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fill in the name, band, date and due time." };
  const result = await createTest(user, { ...parsed.data, dueAt: `${parsed.data.dueAt}:00+05:30` });
  if (result.ok) revalidatePath("/tests");
  return result.ok ? { ok: true, message: `${result.test.name} (${result.test.band}) created.` } : result;
}

const fieldSchema = z.object({
  id: z.string().regex(/^f[0-9a-z]{1,12}$/),
  label: z.string().trim().max(80),
  type: z.enum(FIELD_TYPES),
  help: z.string().max(200),
  required: z.boolean(),
  column: z.boolean(),
  max: z.number().int().min(0).max(1000).optional(),
  options: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
});

export async function publishResultFormat(formatId: string, input: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = z.object({ passMark: z.number().min(0).max(10000), fields: z.array(fieldSchema).min(1).max(30) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "The format has a field that isn't valid. Check names, marks and options." };
  const result = await publishFormat(user, formatId, parsed.data);
  if (result.ok) revalidatePath("/tests/formats");
  return result.ok ? { ok: true, message: `Published version ${result.version}. New tests will use it.` } : result;
}
