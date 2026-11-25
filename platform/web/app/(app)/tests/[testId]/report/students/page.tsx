/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Dropdown } from "@/common/components/dropdown";
import { LiveForm } from "@/common/components/live-form";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { asOptions } from "@/common/lib/options";
import { cn } from "@/common/lib/utils";
import { DownloadPdfButton, PrintSetup } from "@/modules/tests/components/student-report-actions";
import { StudentReportSheet } from "@/modules/tests/components/student-report-sheet";
import { getTest } from "@/modules/tests/data";
import { REPORT_LANGS, reportLang } from "@/modules/tests/report-text";
import { loadStudentReports } from "@/modules/tests/student-report";

export const metadata = { title: "Student reports" };

/** More sheets than this on one page is slow to open and to save as PDF: pick an instructor instead. */
const MAX_SHEETS = 80;

async function Content({ params, searchParams }: { params: Promise<{ testId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const user = await requireAccess("/tests");
  const { testId } = await params;
  const sp = await searchParams;
  const lang = reportLang(sp.lang);
  const test = await getTest(testId);
  if (!test) notFound();
  const loaded = await loadStudentReports(test, user, { instructor: typeof sp.instructor === "string" ? sp.instructor : null });
  if (!loaded) notFound();
  const { reports, instructors, instructor } = loaded;
  const tooMany = reports.length > MAX_SHEETS;
  const qs = (l: string) => `?lang=${l}${instructor ? `&instructor=${encodeURIComponent(instructor)}` : ""}`;
  const fileName = `${test.name} ${test.band} - student reports${instructor ? ` - ${instructor}` : ""}${lang === "te" ? " - Telugu" : ""}`.replace(/[\\/:*?"<>|]+/g, " ");

  return (
    <>
      <PrintSetup />
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <Link href={`/tests/${test.id}/report${instructor ? `?instructor=${encodeURIComponent(instructor)}` : ""}`} className="text-[13px] font-semibold text-primary hover:text-accent-strong">
            ← {test.name} · {test.band} report
          </Link>
          <h1 className="text-2xl font-semibold">Student reports</h1>
          <p className="text-[13px] text-muted-foreground">
            {reports.length} student{reports.length === 1 ? "" : "s"} · one A4 page each
            {instructor ? ` · ${instructor}'s students` : user.role === "instructor" || user.role === "senior_instructor" ? " · your students" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          {instructors.length > 1 ? (
            <LiveForm aria-label="Whose students">
              <input type="hidden" name="lang" value={lang} />
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Instructor
                <Dropdown
                  name="instructor"
                  defaultValue={instructor ?? ""}
                  options={[{ value: "", label: "All instructors" }, ...asOptions(instructors)]}
                  searchPlaceholder="Search instructors…"
                  className="w-56"
                />
              </label>
            </LiveForm>
          ) : null}
          <nav aria-label="Report language" className="flex rounded-lg border border-input bg-card p-0.5">
            {REPORT_LANGS.map((l) => (
              <Link
                key={l.value}
                href={qs(l.value)}
                aria-current={lang === l.value ? "page" : undefined}
                lang={l.value}
                className={cn(
                  "flex h-9 items-center rounded-md px-3.5 text-sm font-semibold",
                  lang === l.value ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-muted",
                  l.value === "te" && "font-telugu",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {reports.length && !tooMany ? <DownloadPdfButton fileName={fileName} label={`Download all ${reports.length} (PDF)`} /> : null}
        </div>
      </div>

      {tooMany ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm print:hidden">
          {reports.length} students is too many for one PDF. Pick an instructor above to download their students&apos; reports, or open a single student from the{" "}
          <Link href={`/tests/${test.id}/report`} className="font-semibold text-primary hover:text-accent-strong">
            test report
          </Link>
          .
        </p>
      ) : !reports.length ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm">No students in band {test.band} for this view.</p>
      ) : (
        <>
          <p className="-mt-3 text-xs text-muted-foreground print:hidden">
            In the window that opens, choose <b>Save as PDF</b> as the destination. Each student starts on a new page.
          </p>
          <div className="-mx-4 flex flex-col gap-6 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 print:m-0 print:gap-0 print:overflow-visible print:p-0">
            {reports.map((r) => (
              <StudentReportSheet key={r.student.niatId} report={r} lang={lang} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function StudentReportsPage({ params, searchParams }: PageProps<"/tests/[testId]/report/students">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[1123px] w-[794px] max-w-full rounded-xl" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
