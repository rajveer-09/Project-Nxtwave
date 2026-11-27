/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/common/components/empty-state";
import { PageHeader } from "@/common/components/page-header";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { todayIst } from "@/common/lib/dates";
import type { SearchParamsRecord } from "@/common/lib/url";
import { questionBank as loadQuestionBank } from "@nxtone/interactions-ui/curriculum/data";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { InteractionForm, type FormStudent } from "@nxtone/interactions-ui/components/interaction-form";
import { StudentLookup } from "@nxtone/interactions-ui/components/student-lookup";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { canLogFor } from "@nxtone/interactions-ui/lib/permissions";
import { fullFormStudent } from "@nxtone/interactions-ui/my-students-data";
import { getRoster, getRosterStudent, usingSampleData } from "@/common/data/roster";
import { buildStudentDetail } from "@/common/sample-data/student-detail";
import { latestTestTotals } from "@/modules/tests/data";
import { InteractionsTable } from "@/modules/students/components/interactions-table";
import { LogSnapshot } from "@/modules/students/components/log-snapshot";

export const metadata = { title: "Log interaction" };

const NIAT = /^N\d{2}H\d{2}[AB]\d{4}$/;
/** How many of your latest interactions for other instructors' students the page lists. */
const RECENT_FOR_OTHERS = 25;

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

  // Re-mounted per student (key) so the box shows the ID just opened.
  const lookup = <StudentLookup key={raw} initial={raw} autoFocus={!raw} />;

  // What this person logged for students who aren't theirs (their own work, so they may see it).
  // Same table as Today's interactions (with Inspect, which opens entries you took for anyone's student).
  // Only for those whose Interactions page lists just their own students: admins and senior
  // instructors see everyone's there already, so for them this would repeat it.
  const seesAll = user.role === "owner" || user.role === "admin" || user.role === "senior_instructor";
  const forOthers = seesAll ? [] : await listInteractions({ takenBy: user.name, othersOnly: true, limit: RECENT_FOR_OTHERS });
  const recent = forOthers.length ? (
    <section aria-labelledby="for-others-h" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="for-others-h" className="text-base font-semibold">
          You logged recently for other students
        </h2>
        <span className="text-xs text-muted-foreground">
          Only interactions you took yourself · latest {forOthers.length}
        </span>
      </div>
      <InteractionsTable rows={forOthers} caption="Interactions you took for other students" empty={{ title: "", description: "" }} />
    </section>
  ) : null;

  if (!raw) {
    return (
      <>
        {lookup}
        <EmptyState title="Type a name or NIAT ID to start" description="Your own students open with their attendance, last test and contests. For anyone else's student you're saved as the person who took it." />
        {recent}
      </>
    );
  }

  const student = NIAT.test(raw) ? await getRosterStudent(raw) : null;
  if (!student) {
    return (
      <>
        {lookup}
        <EmptyState title={NIAT.test(raw) ? `No active student with NIAT ID ${raw}` : "That isn't a NIAT ID"} description="Type part of the name or ID and pick the student from the list." />
        {recent}
      </>
    );
  }

  const [questionBank, structure] = await Promise.all([loadQuestionBank(), getStructure()]);
  const isMine = canLogFor(user, student);
  const instructors = isMine ? [...new Set((await getRoster()).map((s) => s.instructor).filter((name) => name !== "Unassigned"))].sort() : [user.name];
  // The latest weekly test and every interaction, for the snapshot above the form (any student).
  const [latestTest, history] = await Promise.all([
    usingSampleData() ? Promise.resolve(buildStudentDetail(student).tests.list.at(-1)?.total ?? null) : latestTestTotals([student.niatId]).then((m) => m.get(student.niatId) ?? null),
    listInteractions({ niatId: student.niatId }),
  ]);
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
      <LogSnapshot student={student} latestTest={latestTest} interactions={history} />
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
        description="Type the student's name or NIAT ID. For someone else's student you're recorded as the person who took it."
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
