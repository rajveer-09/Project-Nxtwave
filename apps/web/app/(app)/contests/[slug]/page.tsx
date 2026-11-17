/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { ContestView } from "@/modules/contests/components/contest-view";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { isAdminRole } from "@/common/auth/roles";

export const metadata = { title: "Contest" };

async function Content({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireAccess("/contests");
  const { slug } = await params;
  // Admins publish or discard held scans; instructors start on "My students" (the contest service
  // only knows instructors' own students; everyone else starts on all students).
  return <ContestView slug={slug} canReview={isAdminRole(user.role)} hasStudents={user.role === "instructor"} />;
}

export default function ContestPage({ params }: PageProps<"/contests/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
      <Content params={params} />
    </Suspense>
  );
}
