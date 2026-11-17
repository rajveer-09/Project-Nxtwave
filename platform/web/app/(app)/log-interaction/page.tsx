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
import { getRosterStudent } from "@/common/data/roster";
import { formatDate, todayIst } from "@/common/lib/dates";
import type { SearchParamsRecord } from "@/common/lib/url";
import { questionBank as loadQuestionBank } from "@nxtone/interactions-ui/curriculum/data";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { InteractionForm, type FormStudent } from "@nxtone/interactions-ui/components/interaction-form";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { canLogFor } from "@nxtone/interactions-ui/lib/permissions";
import { STATUS_LABEL } from "@nxtone/interactions-ui/lib/types";

export const metadata = { title: "Log interaction" };

const NIAT = /^N\d{2}H\d{2}[AB]\d{4}$/;
const field =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground uppercase tabular focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * Log an interaction with any student by NIAT ID, e.g. when covering for another instructor. "Taken by"
 * is always the person logging. Only what the form needs is shown: the student's name and where they
 * are on the roadmap; nothing of their instructor's other data (attendance, tests, other students).
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
        Student&apos;s NIAT ID
        <input name="niat" defaultValue={raw} required autoFocus={!raw} placeholder="e.g. N24H01A0031" maxLength={11} autoComplete="off" spellCheck={false} className={field} />
      </label>
      <Button type="submit" className="h-11 px-5">
        Find student
      </Button>
    </form>
  );

  // What this person logged for students who aren't theirs (their own work, so they may see it).
  const mine = (await listInteractions())
    .filter((it) => it.takenBy === user.name && it.assignedInstructor !== user.name)
    .slice(0, 10);
  const recent = mine.length ? (
    <SectionCard title="You logged recently for other students" description="Only interactions you took yourself">
      <ul className="flex flex-col">
        {mine.map((it, i) => (
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
        <EmptyState title="Type a NIAT ID to start" description="You can log an interaction you took with any student. It's saved with you as the person who took it." />
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
  const own = canLogFor(user, student);
  const formStudent: FormStudent = {
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
        {own ? "This is one of your students; their full context is on the Interactions page." : "Saved with you as the person who took it; their instructor sees it in the student's history."}
      </p>
      <div className="flex flex-wrap items-start gap-5">
        <InteractionForm
          key={student.niatId}
          students={[formStudent]}
          instructors={[user.name]}
          userId={user.id}
          userName={user.name}
          initialStudent={student.niatId}
          today={today}
          questionBank={questionBank}
          structure={structure}
          fixedTakenBy={user.name}
        />
      </div>
      {recent}
    </>
  );
}

export default function LogInteractionPage({ searchParams }: PageProps<"/log-interaction">) {
  return (
    <>
      <PageHeader eyebrow="Any student · by NIAT ID" title="Log interaction" description="Took an interaction with a student who isn't yours? Log it here. You are recorded as the person who took it." />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
