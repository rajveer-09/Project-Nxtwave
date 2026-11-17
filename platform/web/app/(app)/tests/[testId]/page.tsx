/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { UnlockButton } from "@/modules/tests/components/admin-tools";
import { ResultsEntry } from "@/modules/tests/components/results-entry";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { isAdminRole } from "@/common/auth/roles";
import { formatDate } from "@/common/lib/dates";
import { getFormatVersion, getResults, getSubmission, getTest, listSubmissions, listTests, studentsFor } from "@/modules/tests/data";
import { maxTotal, totalOf } from "@/modules/tests/types";

export const metadata = { title: "Weekly test" };

async function Content({ params }: { params: Promise<{ testId: string }> }) {
  await connection();
  const user = await requireAccess("/tests");
  const { testId } = await params;
  const test = await getTest(testId);
  if (!test) notFound();
  const format = await getFormatVersion(test.formatId, test.version);
  if (!format) notFound();
  const admin = isAdminRole(user.role);

  const header = (
    <PageHeader
      eyebrow={
        <Link href="/tests" className="font-semibold text-primary hover:text-accent-strong">
          ← Weekly tests
        </Link>
      }
      title={`${test.name} · ${test.band}`}
      description={`Held ${formatDate(test.heldOn)} · ${format.fields.filter((f) => f.type === "marks").map((f) => `${f.label} ${f.max}`).join(" + ")} = ${maxTotal(format.fields)} · pass ${format.passMark} · format v${format.version}`}
      actions={<StatusPill>Due {new Date(test.dueAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</StatusPill>}
    />
  );

  if (admin) {
    // Admins see progress per instructor and can unlock; instructors enter results.
    const students = await studentsFor(test);
    const results = await getResults(test.id, students.map((s) => s.niatId));
    const subs = await listSubmissions(test.id);
    const byInstructor = [...new Set(students.map((s) => s.instructor))].sort().map((instructor) => {
      const idx = students.map((s, i) => (s.instructor === instructor ? i : -1)).filter((i) => i >= 0);
      const totals = idx.map((i) => (results[i]?.present ? totalOf(format.fields, results[i]!.values) : null)).filter((t): t is number => t !== null);
      return {
        instructor,
        students: idx.length,
        entered: idx.filter((i) => results[i]).length,
        avg: totals.length ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : "—",
        below: totals.filter((t) => t < format.passMark).length,
        submitted: subs.find((s) => s.instructor === instructor) ?? null,
      };
    });
    return (
      <>
        {header}
        <section aria-label="Progress by instructor" className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <caption className="sr-only">Progress by instructor</caption>
              <thead>
                <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                  {["Instructor", "Entered", "Average", "Below pass", "Status", ""].map((h, i) => (
                    <th key={i} scope="col" className="border-b border-border px-3 py-2.5 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byInstructor.map((r) => (
                  <tr key={r.instructor}>
                    <td className="border-b border-muted py-3 pr-3 pl-5 font-semibold">{r.instructor}</td>
                    <td className="border-b border-muted px-3 py-3 tabular">
                      {r.entered} / {r.students}
                    </td>
                    <td className="border-b border-muted px-3 py-3 tabular">{r.avg}</td>
                    <td className={`border-b border-muted px-3 py-3 tabular ${r.below ? "font-semibold text-warning" : ""}`}>{r.below}</td>
                    <td className="border-b border-muted px-3 py-3">{r.submitted ? <StatusPill tone="accent">Submitted</StatusPill> : <StatusPill tone="warning">Not submitted</StatusPill>}</td>
                    <td className="border-b border-muted py-2 pr-5 pl-3 text-right">{r.submitted ? <UnlockButton testId={test.id} instructor={r.instructor} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  const students = await studentsFor(test, user.name);
  if (!students.length) {
    return (
      <>
        {header}
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm">None of your students are in band {test.band}.</p>
      </>
    );
  }
  const results = await getResults(test.id, students.map((s) => s.niatId));
  const locked = !!(await getSubmission(test.id, user.name));
  // The previous test in the same band, for context in the feedback panel.
  const previous = (await listTests()).filter((t) => t.band === test.band && t.heldOn < test.heldOn).sort((a, b) => b.heldOn.localeCompare(a.heldOn))[0];
  const prevResults = previous ? await getResults(previous.id, students.map((s) => s.niatId)) : [];
  const prevFormat = previous ? await getFormatVersion(previous.formatId, previous.version) : null;

  return (
    <>
      {header}
      <ResultsEntry
        testId={test.id}
        format={format}
        locked={locked}
        students={students.map((s) => ({ niatId: s.niatId, name: s.name, section: s.section, attendance30d: s.attendance30d }))}
        initial={Object.fromEntries(students.map((s, i) => [s.niatId, results[i] ? { present: results[i]!.present, values: results[i]!.values } : null]))}
        lastScores={Object.fromEntries(
          students.map((s, i) => {
            const r = prevResults[i];
            const t = r && prevFormat ? (r.present ? totalOf(prevFormat.fields, r.values) : null) : null;
            return [s.niatId, t];
          }),
        )}
      />
    </>
  );
}

export default function TestPage({ params }: PageProps<"/tests/[testId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
      <Content params={params} />
    </Suspense>
  );
}
