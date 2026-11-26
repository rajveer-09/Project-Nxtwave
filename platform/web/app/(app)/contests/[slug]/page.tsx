/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { ContestView } from "@nxtone/contest-ui/components/contest-view";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { isAdminRole } from "@/common/auth/roles";
import { myStudentIds } from "@nxtone/contest-ui/my-students";

export const metadata = { title: "Contest" };

async function Content({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireAccess("/contests");
  const { slug } = await params;
  // Admins publish or discard held scans; anyone with students of their own starts on "My students"
  // (as NxtOne assigns them). Only the super admin rescans (enforced again in modules/contest/frontend/service.ts).
  return <ContestView slug={slug} canReview={isAdminRole(user.role)} canRescan={user.role === "owner" && !user.viewedBy} myIds={await myStudentIds(user)} />;
}

export default function ContestPage({ params }: PageProps<"/contests/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
      <Content params={params} />
    </Suspense>
  );
}
