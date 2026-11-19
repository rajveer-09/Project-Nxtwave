/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/common/ui/skeleton";
import { requireStudent } from "@/common/auth/student/session";
import { getStudent } from "@/modules/students/data";
import { AttendanceSection, ProgressSection } from "@/modules/students/components/profile/attendance-progress";
import { Snapshot } from "@/modules/students/components/profile/overview";
import { ContestsSection, InteractionsSection, TestsSection } from "@/modules/students/components/profile/sections";
import { JoinBanner } from "@nxtone/interactions-ui/room/components/join-banner";
import { RoomsList } from "@nxtone/interactions-ui/room/components/rooms-list";
import { openRoomsFor } from "@nxtone/interactions-ui/room/data";

export const metadata = { title: "My progress" };

/**
 * A student's own page: attendance, DSA progress, feedback from instructors, weekly tests and
 * contests. Built only from their own record; no other student, no risk flags, no change
 * history, no staff-only links or transcripts.
 */
async function Content() {
  const student = await requireStudent();
  if (student.mustChangePassword) redirect("/me/password");
  const [d, openRooms] = await Promise.all([getStudent(student.niatId), openRoomsFor(student.niatId)]);
  if (!d) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">
        Your record isn&apos;t available right now. Please try again later.
      </p>
    );
  }
  const s = d.student;
  return (
    <>
      <section aria-label="You" className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted-foreground">
          {s.college} · Section {s.section} · {s.hall}
          {d.profile.termLabel ? ` · ${d.profile.termLabel}` : ""}
        </span>
        <h1 className="text-[30px] font-semibold tracking-tight">Hi, {s.name.split(" ")[0]}</h1>
        <span className="text-sm text-sidebar-foreground">
          Instructor: <b>{s.instructor}</b>
          {s.coach ? (
            <>
              {" "}
              · Success coach: <b>{s.coach}</b>
            </>
          ) : null}
        </span>
      </section>
      <JoinBanner initial={openRooms} />
      <Snapshot d={d} />
      <AttendanceSection d={d} student />
      <ProgressSection d={d} student />
      <InteractionsSection d={d} student />
      <Suspense fallback={null}>
        <RoomsList niatId={student.niatId} title="Your code rooms" />
      </Suspense>
      <TestsSection d={d} student />
      <ContestsSection d={d} student />
    </>
  );
}

export default function MyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-20 w-80" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      }
    >
      <Content />
    </Suspense>
  );
}
