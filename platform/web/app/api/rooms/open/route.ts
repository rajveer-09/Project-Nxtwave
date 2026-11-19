/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { getOptionalStudent } from "@/common/auth/student/session";
import { openRoomsFor } from "@nxtone/interactions-ui/room/data";

/** The signed-in student's open code rooms (their page shows "Join"). */
export async function GET() {
  const student = await getOptionalStudent();
  if (!student) return Response.json({ error: "Sign in" }, { status: 401 });
  return Response.json({ rooms: await openRoomsFor(student.niatId) }, { headers: { "Cache-Control": "no-store" } });
}
