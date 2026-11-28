/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { StudentDetail } from "@nxtone/attendance-ui/components/students/student-detail";

export const metadata = { title: "DSA attendance student" };

async function Content({ params }: { params: Promise<{ niatId: string }> }) {
  await connection();
  const user = await requireAccess("/attendance/students");
  const { niatId } = await params;
  return <StudentDetail niatId={decodeURIComponent(niatId).toUpperCase()} isOwner={user.role === "owner"} />;
}

export default function AttendanceStudentPage({ params }: PageProps<"/attendance/students/[niatId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
      <Content params={params} />
    </Suspense>
  );
}
