/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/common/components/empty-state";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { Button } from "@/common/ui/button";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { formatDate, todayIst } from "@/common/lib/dates";
import type { SearchParamsRecord } from "@/common/lib/url";
import { questionBank as loadQuestionBank } from "@nxtone/interactions-ui/curriculum/data";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { InteractionForm, type FormStudent } from "@nxtone/interactions-ui/components/interaction-form";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { canLogFor } from "@nxtone/interactions-ui/lib/permissions";
import { fullFormStudent } from "@nxtone/interactions-ui/my-students-data";
import { getRoster, getRosterStudent, usingSampleData } from "@/common/data/roster";
import { buildStudentDetail } from "@/common/sample-data/student-detail";
import { latestTestTotals } from "@/modules/tests/data";
import { STATUS_LABEL } from "@nxtone/interactions-ui/lib/types";

export const metadata = { title: "Log interaction" };

const NIAT = /^N\d{2}H\d{2}[AB]\d{4}$/;
const field =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground uppercase tabular focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * The page for logging an interaction: type a student's NIAT ID (instructors also reach it from the
 * Log button in My students on /interactions). Your own students get the full form context (attendance, last test,
 * contests). For someone else's student (e.g. covering for another instructor) "Taken by" is always the
 * person logging, and only what the form needs is shown: their name and where they are on the roadmap.
 */
async function Content({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const user = await requireAccess("/log-interaction");
  const params = await searchParams;
  const raw = typeof params.niat === "string" ? params.niat.trim().toUpperCase() : "";
  const today = todayIst();

  const lookup = (
    <form method="get" action="/log-interaction" className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5">
      <label className="flex flex-[1_1_260px] flex-col gap-1 text-xs font-medium text-muted-foreground">
        Student’s NIAT ID
        <input name="niat" defaultValue={raw} required autoFocus={!raw} placeholder="e.g. N24H01A0031" maxLength={11} autoComplete="off" spellCheck={false} className={field} />
      </label>
      <Button type="submit" className="h-11 px-5">
        Find student
      </Button>
    </form>
  );

  // What this person logged for students who aren't theirs (their own work, so they may see it).
  const forOthers = await listInteractions({ takenBy: user.name, othersOnly: true, limit: 10 });
  const recent = forOthers.length ? (
    <SectionCard title="You logged recently for other students" description="Only interactions you took yourself">
      <ul className="flex flex-col">
        {forOthers.map((it, i) => (
          <li key={it.id} className={`flex flex-wrap items-baseline justify-between gap-2 py-2 text-[13px] ${i ? "border-t border-muted" : ""}`}>
            <span>
              <span className="font-semibold">{it.studentName}</span> <span className="text-xs text-muted-foreground tabular">{it.niatId}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(it.date)} · L{it.level} · {STATUS_LABEL[it.status]}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  ) : null;

  if (!raw) {
    return (
      <>
        {lookup}
        <EmptyState title="Type a NIAT ID to start" description="Your own students open with their attendance, last test and contests. For anyone else's student you're saved as the person who took it." />
        {recent}
      </>
    );
  }

  const student = NIAT.test(raw) ? await getRosterStudent(raw) : null;
  if (!student) {
    return (
      <>
        {lookup}
        <EmptyState title={NIAT.test(raw) ? `No active student with NIAT ID ${raw}` : "That isn't a NIAT ID"} description="Check the ID, e.g. N24H01A0031." />
        {recent}
      </>
    );
  }

  const [questionBank, structure] = await Promise.all([loadQuestionBank(), getStructure()]);
  const isMine = canLogFor(user, student);
  const instructors = isMine ? [...new Set((await getRoster()).map((s) => s.instructor).filter((name) => name !== "Unassigned"))].sort() : [user.name];
  const latestTest = !isMine ? null : usingSampleData() ? (buildStudentDetail(student).tests.list.at(-1)?.total ?? null) : ((await latestTestTotals([student.niatId])).get(student.niatId) ?? null);
  const formStudent: FormStudent = isMine ? fullFormStudent(student, latestTest) : {
    niatId: student.niatId,
    name: student.name,
    group: "",
    level: student.level,
    topic: student.topic,
    subtopic: student.subtopic,
    attendance30d: null,
    lastInteractionDays: null,
    lastInteractionLabel: null,
    contestAbsentStreak: 0,
    latestTest: null,
  };

  return (
    <>
      {lookup}
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-sidebar-foreground">
        Logging for <b className="text-foreground">{student.name}</b> · Level {student.level} · {student.topic}
        {student.subtopic ? ` › ${student.subtopic}` : ""}.{" "}
        {isMine ? "One of your students." : "Saved with you as the person who took it; their instructor sees it in the student's history."}
      </p>
      <div className="flex flex-wrap items-start gap-5">
        <InteractionForm
          key={student.niatId}
          students={[formStudent]}
          instructors={instructors}
          userId={user.id}
          userName={user.name}
          initialStudent={student.niatId}
          today={today}
          questionBank={questionBank}
          structure={structure}
          fixedTakenBy={isMine ? undefined : user.name}
        />
      </div>
      {recent}
    </>
  );
}

export default function LogInteractionPage({ searchParams }: PageProps<"/log-interaction">) {
  return (
    <>
      <PageHeader
        eyebrow="Interactions"
        title="Log interaction"
        description="Type the student's NIAT ID. For someone else's student you're recorded as the person who took it."
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
