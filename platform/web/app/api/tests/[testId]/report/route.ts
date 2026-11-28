/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import { getOptionalSessionUser } from "@/common/auth/session";
import { toCsv } from "@/common/lib/csv";
import { canAccess } from "@/common/lib/nav";
import { getTest } from "@/modules/tests/data";
import { loadReport } from "@/modules/tests/report";
import { tookTest, valueText } from "@/modules/tests/types";

const RESULT = { pass: "Passed", below: "Below pass", incomplete: "Incomplete", absent: "Absent", missing: "Not entered" } as const;

/** CSV of a weekly test report: the same students and scope as the report page. */
export async function GET(request: Request, { params }: RouteContext<"/api/tests/[testId]/report">) {
  const user = await getOptionalSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!canAccess(user.role, "/tests")) return Response.json({ error: "Not allowed" }, { status: 403 });
  const { testId } = await params;
  const test = await getTest(testId);
  if (!test) return Response.json({ error: "No such test" }, { status: 404 });
  const report = await loadReport(test, user, new URL(request.url).searchParams.get("instructor"));
  if (!report) return Response.json({ error: "The test's format is missing" }, { status: 404 });

  const fields = report.format.fields;
  const csv = toCsv(
    [
      "NIAT ID", "Student", "College", "Section", "Instructor", "Result", `Total /${report.max}`, "Previous test total",
      ...fields.map((f) => (f.type === "marks" ? `${f.label} /${f.max}` : f.label)),
      "Semester attendance %", "Semester present", "Semester counted days", "Last week attendance %", "Last week present", "Last week counted days",
      "Level", "Topic", "Topic no.", "Topics in level", "Subtopic", "Step", "Roadmap progress %", "DSA attendance as of",
    ],
    report.rows.map((r) => {
      const took = tookTest(r);
      const a = r.auto;
      return [
        r.niatId, r.name, r.college, r.section, r.instructor, RESULT[r.result], r.total, r.previous,
        ...fields.map((f) => (took ? valueText(f, r.values[f.id]).replace(/^—$/, "") : "")),
        a?.semester.pct, a?.semester.present, a?.semester.counted, a?.week.pct, a?.week.present, a?.week.counted,
        a ? `Level ${a.progress.level}` : "", a?.progress.topic, a?.progress.topicNo || "", a?.progress.topicCount, a?.progress.subtopic,
        a?.progress.step ? `${a.progress.step}${a.progress.stepLabel ? ` ${a.progress.stepLabel}` : ""}` : "", a?.progress.percent, a?.asOf,
      ];
    }),
  );
  const slug = `${test.name}-${test.band}${report.scope.instructor ? `-${report.scope.instructor}` : ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-report.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
