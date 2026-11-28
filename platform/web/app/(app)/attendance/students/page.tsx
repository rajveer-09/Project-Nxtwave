/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { StudentsList } from "@nxtone/attendance-ui/components/students/students-list";

export const metadata = { title: "DSA attendance students" };

async function Content() {
  await connection();
  // Owners and admins (nav.ts PAGE_RULES); the attendance service checks it again, and lets only the Owner delete.
  const user = await requireAccess("/attendance/students");
  return <StudentsList isOwner={user.role === "owner"} />;
}

export default function AttendanceStudentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
