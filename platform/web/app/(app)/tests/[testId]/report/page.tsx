/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Download, FileText } from "lucide-react";
import { BarList } from "@/common/components/bar-list";
import { Dropdown } from "@/common/components/dropdown";
import { LiveForm } from "@/common/components/live-form";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { asOptions } from "@/common/lib/options";
import { formatDate } from "@/common/lib/dates";
import { cn } from "@/common/lib/utils";
import { asOfDay, weekRange } from "@/modules/tests/autofill";
import { PrintButton, ReportView } from "@/modules/tests/components/report-view";
import { getTest } from "@/modules/tests/data";
import { loadReport } from "@/modules/tests/report";
import { bandLabel } from "@/modules/tests/types";

export const metadata = { title: "Weekly test report" };

const fmt = (n: number | null, suffix = "") => (n === null ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)}${suffix}`);

function Tile({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="break-inside-avoid rounded-xl border border-border bg-card px-4 py-3">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("font-heading text-2xl font-semibold tabular", warn && "text-warning")}>{value}</dd>
      <dd className="text-xs text-muted-foreground">{sub}</dd>
    </div>
  );
}

async function Content({ params, searchParams }: { params: Promise<{ testId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const user = await requireAccess("/tests");
  const { testId } = await params;
  const sp = await searchParams;
  const test = await getTest(testId);
  if (!test) notFound();
  const wanted = typeof sp.instructor === "string" ? sp.instructor : null;
  const report = await loadReport(test, user, wanted);
  if (!report) notFound();
  const { summary: s, format, max, scope } = report;
  const asOf = asOfDay(test);
  const week = weekRange(asOf);
  const semesterName = report.rows.find((r) => r.auto?.semesterName)?.auto?.semesterName ?? null;
  const csv = `/api/tests/${test.id}/report${scope.instructor ? `?instructor=${encodeURIComponent(scope.instructor)}` : ""}`;
  const who = scope.admin ? (scope.instructor ? `${scope.instructor}'s students` : "All instructors") : "Your students";

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/tests/${test.id}`} className="font-semibold text-primary hover:text-accent-strong print:hidden">
            ← {test.name}
          </Link>
        }
        title={`Report · ${test.name} · ${bandLabel(test.band)}`}
        description={`${who} · held ${formatDate(test.heldOn)} · out of ${max}, pass ${format.passMark} · attendance up to ${formatDate(asOf)}${semesterName ? ` (${semesterName})` : ""}, last week ${formatDate(week.from)} – ${formatDate(week.to)}`}
        actions={
          <>
            {scope.admin && scope.instructors.length > 1 ? (
              <LiveForm className="print:hidden" aria-label="Report scope">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Instructor
                  <Dropdown
                    name="instructor"
                    defaultValue={scope.instructor ?? ""}
                    options={[{ value: "", label: "All instructors" }, ...asOptions(scope.instructors)]}
                    searchPlaceholder="Search instructors…"
                    className="w-56"
                  />
                </label>
              </LiveForm>
            ) : null}
            <a href={csv} download className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-muted print:hidden">
              <Download aria-hidden className="size-4" />
              Download CSV
            </a>
            <PrintButton />
            <Link
              href={`/tests/${test.id}/report/students${scope.instructor ? `?instructor=${encodeURIComponent(scope.instructor)}` : ""}`}
              className="flex h-10 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 print:hidden"
            >
              <FileText aria-hidden className="size-4" />
              Student reports (PDF)
            </Link>
          </>
        }
      />

      {!report.rows.length ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm">No students in {bandLabel(test.band)} for this report.</p>
      ) : (
        <>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 print:grid-cols-3">
            <Tile label="Took the test" value={`${s.present} / ${s.students}`} sub={[`${s.absent} absent`, s.incomplete ? `${s.incomplete} incomplete` : "", s.missing ? `${s.missing} not entered` : ""].filter(Boolean).join(" · ")} warn={s.missing + s.incomplete > 0} />
            <Tile label="Average" value={fmt(s.average)} sub={`median ${fmt(s.median)} · out of ${max}`} />
            <Tile label="Highest · lowest" value={s.highest === null ? "—" : `${s.highest} · ${s.lowest}`} sub={`of ${s.passed + s.below} with all marks in`} />
            <Tile label="Pass rate" value={fmt(s.passRate, "%")} sub={`${s.passed} passed · ${s.below} below ${format.passMark}`} warn={s.below > 0} />
            <Tile label="Semester attendance" value={fmt(s.semester, "%")} sub="average, counted days" warn={s.semester !== null && s.semester < 75} />
            <Tile label="DSA attendance last week" value={fmt(s.week, "%")} sub={`${formatDate(week.from)} – ${formatDate(week.to)}`} warn={s.week !== null && s.week < 75} />
            <Tile label="Roadmap progress" value={fmt(s.progress, "%")} sub="average through their level" />
          </dl>

          <div className="grid gap-5 md:grid-cols-2 print:grid-cols-2">
            <SectionCard title="Score distribution" description={`Totals out of ${max}; orange bands are under the pass mark (${format.passMark})`} className="break-inside-avoid">
              {s.passed + s.below ? (
                <BarList
                  items={report.distribution.map((d) => ({ label: d.label, value: d.count, warn: d.belowPass, display: `${d.count}` }))}
                  labelWidth="4.5rem"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No complete totals yet: every mark has to be in for a student to get a total.</p>
              )}
            </SectionCard>
            <SectionCard title="Average by section" description="Of the students who took the test" className="break-inside-avoid">
              {s.present && report.fieldAverages.length ? (
                <ul className="flex flex-col gap-3">
                  {report.fieldAverages.map((f) => {
                    const pct = f.max ? Math.round((f.average / f.max) * 100) : 0;
                    return (
                      <li key={f.label} className="flex flex-col gap-1 text-[13px]">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{f.label}</span>
                          <span className="font-semibold tabular">
                            {fmt(f.average)} / {f.max} <span className="font-normal text-muted-foreground">({pct}%)</span>
                          </span>
                        </div>
                        <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span className={cn("block h-full rounded-full print-exact", pct < 50 ? "bg-warning-strong" : "bg-primary")} style={{ width: `${Math.max(2, pct)}%` }} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No marks yet.</p>
              )}
            </SectionCard>
          </div>

          <ReportView testId={test.id} rows={report.rows} fields={format.fields} max={max} passMark={format.passMark} />

          <p className="text-xs text-muted-foreground">
            Attendance counts only counted days (working days in a term, from when the student joined). For saved results the
            attendance and roadmap progress are as they were when the instructor saved; otherwise as of today. Generated{" "}
            {new Date().toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}.
          </p>
        </>
      )}
    </>
  );
}

export default function TestReportPage({ params, searchParams }: PageProps<"/tests/[testId]/report">) {
  return (
    <Suspense fallback={<Skeleton className="h-[700px] rounded-xl" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
