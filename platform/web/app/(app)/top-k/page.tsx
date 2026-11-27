/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/common/components/empty-state";
import { PageHeader } from "@/common/components/page-header";
import { requireAccess } from "@/common/auth/guard";
import type { RosterStudent } from "@/common/sample-data/roster";
import { Skeleton } from "@/common/ui/skeleton";
import { TopKBoard, type TopKRow } from "@/modules/top-k/components/top-k-board";
import { listTopK, seesAllTopK, topKCandidates, topKReady, type TopKStudent } from "@/modules/top-k/data";

export const metadata = { title: "Top K" };

const row = (s: RosterStudent | TopKStudent): TopKRow => ({
  niatId: s.niatId,
  name: s.name,
  college: s.college,
  section: s.section,
  instructor: s.instructor,
  level: s.level,
  topic: s.topic,
  attendance30d: s.attendance30d,
  lastInteractionDays: s.lastInteractionDays,
  contestsAttended: s.contestsAttended,
  ...("mark" in s ? { markedBy: s.mark.markedBy, markedAt: s.mark.markedAt, source: s.mark.source } : {}),
});

/**
 * Top K: instructors pick the students they count among their best and see them here; senior
 * instructors, admins and super admins see every instructor's Top K (by student or by instructor).
 */
async function Content() {
  await connection();
  const user = await requireAccess("/top-k");
  if (!(await topKReady())) {
    return <EmptyState title="Top K isn't set up yet" description="Its table (migration 20261127000002_top_k) hasn't been added to this database." />;
  }
  const [students, candidates] = await Promise.all([listTopK(user), topKCandidates(user)]);
  return <TopKBoard rows={students.map(row)} candidates={candidates.map(row)} seesAll={seesAllTopK(user)} me={user.name} />;
}

export default function TopKPage() {
  return (
    <>
      <PageHeader
        eyebrow="Students"
        title="Top K"
        description="The students each instructor counts among their best. Their contest results are under Contests › Top K."
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <Content />
      </Suspense>
    </>
  );
}
