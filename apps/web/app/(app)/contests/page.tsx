/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { ContestsList } from "@/modules/contests/components/contests-list";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";

export const metadata = { title: "Contests" };

const connected = !!(process.env.CONTEST_API_ORIGIN && process.env.CONTEST_JWT_SECRET);

async function Content() {
  await requireAccess("/contests");
  return <ContestsList />;
}

export default function ContestsPage() {
  return (
    <>
      <PageHeader
        eyebrow="LeetCode contests · scanned automatically"
        title="Contests"
        actions={connected ? null : <StatusPill>Sample contest service · NxtRank not connected</StatusPill>}
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <Content />
      </Suspense>
    </>
  );
}
