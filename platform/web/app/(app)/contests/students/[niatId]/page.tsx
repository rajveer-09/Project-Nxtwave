/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/common/components/empty-state";
import { LeetCodeLink } from "@/common/components/leetcode-link";
import { requireAccess } from "@/common/auth/guard";
import { canViewStudent } from "@/common/auth/student-access";
import { initials } from "@/common/auth/roles";
import { getRosterStudent } from "@/common/data/roster";
import { Skeleton } from "@/common/ui/skeleton";
import { StudentContestProfile } from "@nxtone/contest-ui/components/student-profile";
import { contestStudentId } from "@nxtone/contest-ui/my-students";

export const metadata = { title: "Contest profile" };

/**
 * A student's contest profile (as NxtRank had): their LeetCode contests only, reached from a
 * contest's results. Contest results are open to everyone who can see Contests, so this page is
 * too; "View complete profile" goes to the full student page for those allowed to see it.
 */
async function Content({ params, searchParams }: { params: Promise<{ niatId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAccess("/contests");
  const { niatId } = await params;
  const from = (await searchParams).from;
  const s = await getRosterStudent(niatId);
  if (!s) notFound();
  const contestId = await contestStudentId(s.niatId);
  const back = typeof from === "string" && /^[a-z0-9-]+$/.test(from) ? { href: `/contests/${from}`, label: "← Back to the contest" } : { href: "/contests", label: "← All contests" };

  return (
    <div className="flex flex-col gap-5">
      <Link href={back.href} className="flex min-h-8 w-fit items-center text-[13px] font-semibold text-primary hover:text-accent-strong">
        {back.label}
      </Link>
      <section aria-label="Student" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent font-heading text-xl font-semibold text-accent-strong">{initials(s.name)}</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contest profile</span>
            <h1 className="text-2xl font-semibold sm:text-[26px]">{s.name}</h1>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
              <span className="tabular">{s.niatId}</span>
              <span aria-hidden="true">·</span>
              <span>
                {s.college} · Section {s.section}
              </span>
              <span aria-hidden="true">·</span>
              {s.lcHandle ? <LeetCodeLink handle={s.lcHandle} className="font-semibold" /> : <span>No LeetCode handle</span>}
            </span>
          </div>
        </div>
        {canViewStudent(user, s) ? (
          <Link
            href={`/students/${s.niatId}`}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/85 sm:w-auto"
          >
            View complete profile
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </section>
      {contestId === null ? (
        <EmptyState title="Not in the contest tracker" description={`${s.name.split(" ")[0]} isn't in the contest tracker yet, so there are no contest results.`} />
      ) : (
        <StudentContestProfile contestId={contestId} firstName={s.name.split(" ")[0]} />
      )}
    </div>
  );
}

export default function ContestStudentPage({ params, searchParams }: PageProps<"/contests/students/[niatId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
