/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { NewTestForm } from "@/modules/tests/components/admin-tools";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { isAdminRole } from "@/common/auth/roles";
import { formatDate, todayIst } from "@/common/lib/dates";
import { getResults, listFormats, listSubmissions, listTests, studentsFor } from "@/modules/tests/data";
import { getRoster, usingSampleData } from "@/common/data/roster";
import { bandOf } from "@/modules/tests/types";

export const metadata = { title: "Weekly tests" };

const dueLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

async function Content() {
  await connection();
  const user = await requireAccess("/tests");
  const admin = isAdminRole(user.role);
  const tests = await listTests();
  const myBands = new Set((await getRoster()).filter((s) => s.instructor === user.name).map((s) => bandOf(s.level)));
  const visible = admin ? tests : tests.filter((t) => myBands.has(t.band));
  const now = new Date().toISOString();

  const rows = await Promise.all(
    visible.map(async (t) => {
      const students = await studentsFor(t, admin ? undefined : user.name);
      const results = await getResults(t.id, students.map((s) => s.niatId));
      const subs = await listSubmissions(t.id);
      const instructors = new Set(students.map((s) => s.instructor));
      return {
        test: t,
        students: students.length,
        entered: results.filter(Boolean).length,
        submitted: admin ? [...instructors].filter((i) => subs.some((s) => s.instructor === i)).length : subs.some((s) => s.instructor === user.name) ? 1 : 0,
        of: admin ? instructors.size : 1,
        overdue: t.dueAt < now,
      };
    }),
  );
  const formats = (await listFormats()).map((f) => ({ id: f.id, name: f.name, version: f.versions.at(-1)!.version }));
  const nextNumber = Math.max(0, ...tests.map((t) => Number(t.name.match(/(\d+)$/)?.[1] ?? 0))) + 1;

  return (
    <>
      <PageHeader
        eyebrow={admin ? "Weekly tests · all level bands" : `Weekly tests · my bands: ${[...myBands].join(", ") || "none"}`}
        title="Weekly tests"
        actions={
          <>
            {admin ? (
              <Link href="/tests/formats" className="flex min-h-10 items-center rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-muted">
                Result format
              </Link>
            ) : null}
            {usingSampleData() ? <StatusPill>Sample data</StatusPill> : null}
          </>
        }
      />
      {admin ? <NewTestForm formats={formats} suggestedName={`Weekly Test ${nextNumber}`} today={todayIst()} /> : null}
      <section aria-label="Tests" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <caption className="sr-only">Weekly tests</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                {["Test", "Band", "Results entered", admin ? "Instructors submitted" : "Status", "Due"].map((h) => (
                  <th key={h} scope="col" className="border-b border-border px-3 py-2.5 first:pl-5 last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ test, students, entered, submitted, of, overdue }) => {
                const done = submitted === of;
                return (
                  <tr key={test.id} className="hover:bg-surface-subtle">
                    <td className="border-b border-muted py-3 pr-3 pl-5">
                      <Link href={`/tests/${test.id}`} className="font-semibold hover:text-primary">
                        {test.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">Held {formatDate(test.heldOn)}</div>
                    </td>
                    <td className="border-b border-muted px-3 py-3 font-semibold">{test.band}</td>
                    <td className="border-b border-muted px-3 py-3 tabular">
                      {entered} / {students}
                    </td>
                    <td className="border-b border-muted px-3 py-3">
                      {admin ? (
                        <span className="tabular">
                          {submitted} / {of}
                        </span>
                      ) : done ? (
                        <StatusPill tone="accent">Submitted</StatusPill>
                      ) : (
                        <StatusPill tone={overdue ? "warning" : "neutral"}>{overdue ? "Overdue" : "Open"}</StatusPill>
                      )}
                    </td>
                    <td className={`border-b border-muted py-3 pr-5 pl-3 ${overdue && !done ? "font-semibold text-warning" : "text-sidebar-foreground"}`}>{dueLabel(test.dueAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default function TestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
