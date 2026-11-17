/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { TermsList } from "@/modules/attendance/components/attendance-lists";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";

export const metadata = { title: "Terms" };

async function Content() {
  await requireAccess("/attendance");
  return <TermsList />;
}

export default function TermsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
