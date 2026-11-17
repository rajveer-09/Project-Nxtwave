/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROLES } from "@/common/auth/roles";
import { getSessionUser } from "@/common/auth/session";
import { invalidateRoster } from "@/common/data/roster";
import { applyAssignmentImport, assignStudent, previewAssignmentImport, type ImportPreview } from "@/modules/admin/assignments-data";
import { addStaff, setStaffActive, setStaffRole } from "@/modules/admin/staff-data";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

function refreshStaff() {
  revalidatePath("/admin/staff");
  revalidatePath("/superadmin");
}

export async function changeRoleAction(staffId: string, role: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = z.enum(ROLES).safeParse(role);
  if (!parsed.success) return { ok: false, error: "Pick a role." };
  const result = await setStaffRole(user, String(staffId), parsed.data);
  if (result.ok) refreshStaff();
  return result;
}

export async function setActiveAction(staffId: string, active: boolean): Promise<ActionResult> {
  const user = await getSessionUser();
  const result = await setStaffActive(user, String(staffId), !!active);
  if (result.ok) refreshStaff();
  return result;
}

const addSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(200),
  role: z.enum(ROLES),
  password: z.string().max(200),
});

export async function addStaffAction(input: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fill in the name, email and role." };
  const result = await addStaff(user, parsed.data);
  if (result.ok) refreshStaff();
  return result;
}

// ---------------------------------------------------------------- assignments

export async function assignAction(niatId: string, kind: string, staffId: string | null): Promise<ActionResult> {
  const user = await getSessionUser();
  const k = z.enum(["instructor", "coach"]).safeParse(kind);
  if (!k.success) return { ok: false, error: "Unknown assignment." };
  const result = await assignStudent(user, String(niatId), k.data, staffId ? String(staffId) : null);
  if (result.ok) {
    invalidateRoster(String(niatId));
    revalidatePath("/admin/assignments");
  }
  return result;
}

const MAX_UPLOAD = 2 * 1024 * 1024;

export async function previewImportAction(form: FormData): Promise<{ ok: true; preview: ImportPreview } | { ok: false; error: string }> {
  const user = await getSessionUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose an Excel (.xlsx) or CSV file." };
  if (file.size > MAX_UPLOAD) return { ok: false, error: "The file is larger than 2 MB." };
  return previewAssignmentImport(user, file.name, Buffer.from(await file.arrayBuffer()));
}

export async function applyImportAction(importId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const result = await applyAssignmentImport(user, String(importId));
  if (result.ok) {
    invalidateRoster();
    revalidatePath("/admin/assignments");
  }
  return result;
}
