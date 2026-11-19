/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { HallSheet } from "@nxtone/attendance-ui/components/hall-sheet";
import { Skeleton } from "@/common/ui/skeleton";
import { authMode } from "@/common/auth/config";
import { requireAccess } from "@/common/auth/guard";
import { getRoster } from "@/common/data/roster";
import { todayIst } from "@/common/lib/dates";
import { canMarkAttendance } from "@nxtone/attendance-ui/db-service";

export const metadata = { title: "Mark attendance" };

async function Sheet() {
  await connection();
  const user = await requireAccess("/attendance");
  // Instructors (and senior instructors) open on their own students and their hall, success coaches
  // on the students they coach; they can switch to everyone in the hall and mark them too.
  let mine: { ids: string[]; hall: string | null } | undefined;
  if (user.role === "instructor" || user.role === "senior_instructor" || user.role === "success_coach") {
    const own = (await getRoster()).filter((s) => (user.role === "success_coach" ? s.coach === user.name : s.instructor === user.name));
    if (own.length) {
      const halls = new Map<string, number>();
      for (const s of own) halls.set(s.hall, (halls.get(s.hall) ?? 0) + 1);
      const hall = [...halls.entries()].sort((a, b) => b[1] - a[1])[0][0];
      mine = { ids: own.map((s) => s.niatId), hall: hall === "No hall" || hall === "—" ? "" : hall };
    }
  }
  return <HallSheet canMark={canMarkAttendance(user)} savesInHub={authMode() === "database"} today={todayIst()} mine={mine} />;
}

export default function MarkHallPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
      <Sheet />
    </Suspense>
  );
}
