/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { cn } from "@/common/lib/utils";
import { DownloadPdfButton, PrintSetup } from "@/modules/tests/components/student-report-actions";
import { StudentReportSheet } from "@/modules/tests/components/student-report-sheet";
import { getTest } from "@/modules/tests/data";
import { REPORT_LANGS, reportLang } from "@/modules/tests/report-text";
import { loadStudentReports, reportFileName } from "@/modules/tests/student-report";

export const metadata = { title: "Student report" };

async function Content({ params, searchParams }: { params: Promise<{ testId: string; niatId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const user = await requireAccess("/tests");
  const { testId, niatId } = await params;
  const lang = reportLang((await searchParams).lang);
  const test = await getTest(testId);
  if (!test) notFound();
  const loaded = await loadStudentReports(test, user, { niatId: niatId.toUpperCase() });
  const report = loaded?.reports[0];
  // Not in this test's band, or not the instructor's student.
  if (!report) notFound();

  return (
    <>
      <PrintSetup />
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <Link href={`/tests/${test.id}/report`} className="text-[13px] font-semibold text-primary hover:text-accent-strong">
            ← {test.name} · {test.band} report
          </Link>
          <h1 className="text-2xl font-semibold">{report.student.name}</h1>
          <p className="text-[13px] text-muted-foreground">Student report · A4, ready to download or print</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <nav aria-label="Report language" className="flex rounded-lg border border-input bg-card p-0.5">
            {REPORT_LANGS.map((l) => (
              <Link
                key={l.value}
                href={`?lang=${l.value}`}
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
          <DownloadPdfButton fileName={reportFileName(report, lang)} label={lang === "te" ? "Download PDF (తెలుగు)" : "Download PDF"} />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground print:hidden">
        In the window that opens, choose <b>Save as PDF</b> as the destination.
        {lang === "te" ? " Feedback shows in Telugu only where the instructor wrote it in Telugu; otherwise their English is shown and marked." : ""}
      </p>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 print:m-0 print:overflow-visible print:p-0">
        <StudentReportSheet report={report} lang={lang} />
      </div>
    </>
  );
}

export default function StudentReportPage({ params, searchParams }: PageProps<"/tests/[testId]/students/[niatId]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[1123px] w-[794px] max-w-full rounded-xl" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
