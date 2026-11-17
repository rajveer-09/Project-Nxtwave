/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { InternshipsList } from "@nxtone/attendance-ui/components/attendance-lists";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { todayIst } from "@/common/lib/dates";

export const metadata = { title: "Internships" };

async function Content() {
  await connection();
  await requireAccess("/attendance");
  return <InternshipsList today={todayIst()} />;
}

export default function InternshipsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-60 rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
