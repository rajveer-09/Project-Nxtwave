import { getOptionalSessionUser } from "@/common/auth/session";
import { todayIst } from "@/common/lib/dates";
import { assignmentsCsv } from "@/modules/admin/assignments-data";

/** Every student's current instructor and coach as CSV, to edit and upload back (admins and senior instructors). */
export async function GET() {
  const user = await getOptionalSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const result = await assignmentsCsv(user);
  if (!result.ok) return Response.json({ error: result.error }, { status: 403 });
  return new Response(result.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="assignments-${todayIst()}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
