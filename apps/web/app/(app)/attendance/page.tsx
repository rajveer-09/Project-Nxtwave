/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { HallSheet } from "@/modules/attendance/components/hall-sheet";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { isAdminRole } from "@/common/auth/roles";
import { todayIst } from "@/common/lib/dates";

export const metadata = { title: "Mark attendance" };

async function Sheet() {
  await connection();
  const user = await requireAccess("/attendance");
  return <HallSheet canMark={isAdminRole(user.role)} today={todayIst()} />;
}

export default function MarkHallPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
      <Sheet />
    </Suspense>
  );
}
