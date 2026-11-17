/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { InteractionForm, type FormStudent } from "@/modules/interactions/components/interaction-form";
import { RecentLogs } from "@/modules/interactions/components/recent-logs";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { instructorScope } from "@/common/auth/student-access";
import { addDays, todayIst } from "@/common/lib/dates";
import { listInteractions } from "@/modules/interactions/data";
import { canLogInteractions } from "@/modules/interactions/lib/permissions";
import { buildStudentDetail } from "@/common/sample-data/student-detail";
import { ROSTER } from "@/common/sample-data/roster";
import { RISK_THRESHOLDS } from "@/common/domain/risk";
import type { SearchParamsRecord } from "@/common/lib/url";
import { questionBank as loadQuestionBank } from "@/modules/curriculum/data";

export const metadata = { title: "Interactions" };

function lastLabel(days: number | null) {
  if (days === null) return null;
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

async function InteractionsContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  // "Today" and the logs are request-time data: render per request, never from a prerender.
  await connection();
  const user = await requireAccess("/interactions");
  const params = await searchParams;
  const scope = instructorScope(user) ?? (user.role === "senior_instructor" ? user.name : undefined);
  const logging = canLogInteractions(user);

  const myStudents = ROSTER.filter((s) => !scope || s.instructor === scope).sort((a, b) => a.name.localeCompare(b.name));
  const [all, questionBank] = await Promise.all([listInteractions({ instructor: scope }), loadQuestionBank()]);
  const overdue = myStudents.filter((s) => s.lastInteractionDays === null || s.lastInteractionDays >= RISK_THRESHOLDS.interactionGapDays);
  const today = todayIst();
  const weekAgo = addDays(today, -7);
  const thisWeek = all.filter((it) => it.date > weekAgo).length;

  const formStudents: FormStudent[] = myStudents.map((s) => ({
    niatId: s.niatId,
    name: s.name,
    group: `${s.college} · ${s.section} · ${s.hall}`,
    level: s.level,
    topic: s.topic,
    subtopic: s.subtopic,
    attendance30d: s.attendance30d,
    lastInteractionDays: s.lastInteractionDays,
    lastInteractionLabel: lastLabel(s.lastInteractionDays),
    contestAbsentStreak: s.risk.contestAbsentStreak,
    latestTest: buildStudentDetail(s).tests.list.at(-1)?.total ?? null,
  }));
  const instructors = [...new Set(ROSTER.map((s) => s.instructor))].sort();
  const student = typeof params.student === "string" ? params.student.toUpperCase() : undefined;

  return (
    <>
      <PageHeader
        eyebrow={logging ? `Interactions · my students (${myStudents.length})` : "Interactions · all students"}
        title={logging ? "Log an interaction" : "Interactions"}
        actions={
          <div className="flex flex-wrap gap-2 text-[13px]">
            <StatusPill tone={overdue.length ? "warning" : "accent"}>
              {overdue.length} {logging ? "of my students" : "students"} overdue ({RISK_THRESHOLDS.interactionGapDays}d+)
            </StatusPill>
            <StatusPill tone="accent">{thisWeek} logged this week</StatusPill>
            <StatusPill>Sample data</StatusPill>
          </div>
        }
      />

      {logging && overdue.length ? (
        <nav aria-label="Overdue students" className="flex flex-wrap items-center gap-2 rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-[13px]">
          <span className="font-semibold text-warning">Overdue:</span>
          {overdue.map((s) => (
            <Link
              key={s.niatId}
              href={`/interactions?student=${s.niatId}`}
              className="flex min-h-8 items-center rounded-full bg-card px-3 font-semibold text-foreground hover:bg-muted"
            >
              {s.name} · {s.lastInteractionDays === null ? "never" : `${s.lastInteractionDays}d`}
            </Link>
          ))}
        </nav>
      ) : null}

      {!logging ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-sidebar-foreground">
          Interactions are logged by the assigned instructor. As {user.role === "owner" ? "an Owner" : "an Admin"} you can read and export every log.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-5">
        {logging ? (
          <InteractionForm
            key={student ?? "none"}
            students={formStudents}
            instructors={instructors}
            userId={user.id}
            userName={user.name}
            initialStudent={student}
            today={today}
            questionBank={questionBank}
          />
        ) : null}
        <RecentLogs rows={all.slice(0, logging ? 12 : 40)} total={all.length} exportHref="/api/logs/interactions/export" />
      </div>
    </>
  );
}

export default function InteractionsPage({ searchParams }: PageProps<"/interactions">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading interactions">
          <Skeleton className="h-16 w-96" />
          <div className="flex flex-wrap gap-5">
            <Skeleton className="h-[640px] flex-[1_1_520px] rounded-xl" />
            <Skeleton className="h-[480px] flex-[1_1_460px] rounded-xl" />
          </div>
        </div>
      }
    >
      <InteractionsContent searchParams={searchParams} />
    </Suspense>
  );
}
