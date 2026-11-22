/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import { cookies } from "next/headers";
import { authMode, VIEW_AS_COOKIE, VIEW_AS_MINUTES, VIEW_AS_STUDENT_COOKIE } from "@/common/auth/config";
import { findActiveStaffById } from "@/common/auth/core/sessions";
import { canViewAs, isAdminRole, ROLE_LABEL } from "@/common/auth/roles";
import { getRealSessionUser } from "@/common/auth/session";
import { activeStudent, NIAT_ID } from "@/common/auth/student/session";
import { getDb } from "@/common/db/pool";

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });
const cookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: VIEW_AS_MINUTES * 60,
};

/**
 * "View as" (common/auth/session.ts, common/auth/student/session.ts), read-only, for up to
 * VIEW_AS_MINUTES. POST { staffId }: an admin or super admin looks at NxtOne as a staff member
 * ranked below them. POST { niatId }: as a student, in the student portal. DELETE: back to
 * themselves. Always decided by who is really signed in, never by whom they're viewing as; one view
 * at a time. Each start and stop is logged (who, as whom) for the audit trail in the server logs.
 */
export async function POST(request: Request) {
  if (authMode() !== "database") return json({ error: "View as needs the database." }, 503);
  const real = await getRealSessionUser();
  if (!real) return json({ error: "Sign in first." }, 401);
  if (real.mustSetPassword) return json({ error: "Choose your own password first." }, 403);
  const body = (await request.json().catch(() => null)) as { staffId?: unknown; niatId?: unknown } | null;
  const store = await cookies();

  if (typeof body?.niatId === "string") {
    const niatId = body.niatId.trim().toUpperCase();
    if (!isAdminRole(real.role)) return json({ error: "Only admins and super admins can view as a student." }, 403);
    const student = NIAT_ID.test(niatId) ? await activeStudent(niatId) : null;
    if (!student) return json({ error: "That isn't an active student." }, 404);
    store.delete(VIEW_AS_COOKIE);
    store.set(VIEW_AS_STUDENT_COOKIE, student.niatId, cookie);
    console.info(JSON.stringify({ event: "view_as.start", by: real.id, byName: real.name, asStudent: student.niatId, asName: student.name }));
    return json({ ok: true, name: student.name, to: "/me" });
  }

  const staffId = typeof body?.staffId === "string" ? body.staffId : "";
  const target = staffId ? await findActiveStaffById(getDb(), staffId) : null;
  if (!target) return json({ error: "That person isn't an active staff member." }, 404);
  if (target.id === real.id || !canViewAs(real.role, target.role)) {
    return json({ error: `As ${ROLE_LABEL[real.role]} you can view as people ranked below you only.` }, 403);
  }
  store.delete(VIEW_AS_STUDENT_COOKIE);
  store.set(VIEW_AS_COOKIE, target.id, cookie);
  console.info(JSON.stringify({ event: "view_as.start", by: real.id, byName: real.name, as: target.id, asName: target.name, asRole: target.role }));
  return json({ ok: true, name: target.name, role: target.role, to: "/" });
}

export async function DELETE() {
  const store = await cookies();
  const staff = store.get(VIEW_AS_COOKIE)?.value;
  const student = store.get(VIEW_AS_STUDENT_COOKIE)?.value;
  store.delete(VIEW_AS_COOKIE);
  store.delete(VIEW_AS_STUDENT_COOKIE);
  const real = await getRealSessionUser();
  if (staff || student) console.info(JSON.stringify({ event: "view_as.stop", by: real?.id ?? null, as: staff ?? null, asStudent: student ?? null }));
  return json({ ok: true });
}
