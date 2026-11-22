import { getOptionalSessionUser } from "@/common/auth/session";
import { hasPanel } from "@/common/auth/roles";
import { assignmentTemplateCsv } from "@/modules/admin/assignments-data";

/** Blank CSV for the Assignments "Upload from Excel" panel (admins and senior instructors). */
export async function GET() {
  const user = await getOptionalSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!hasPanel(user.role)) return Response.json({ error: "Admins and senior instructors only" }, { status: 403 });
  return new Response(assignmentTemplateCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="assignments-template.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
