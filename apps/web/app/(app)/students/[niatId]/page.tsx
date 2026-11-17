/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AttendanceSection, ProgressSection } from "@/modules/students/components/profile/attendance-progress";
import { FlagsBanner, JumpBar, ProfileHeader, Snapshot } from "@/modules/students/components/profile/overview";
import { ContestsSection, InteractionsSection, RecordsSection, TestsSection, TimelineSection } from "@/modules/students/components/profile/sections";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { canViewStudent } from "@/common/auth/student-access";
import { isAdminRole, type SessionUser } from "@/common/auth/roles";
import { studentChanges } from "@/modules/admin/change-log-data";
import { ChangeTable } from "@/modules/admin/components/change-table";
import { getStudent, type StudentDetail } from "@/modules/students/data";

export const metadata = { title: "Student" };

type SectionComponent = (props: { d: StudentDetail }) => React.ReactNode;

/**
 * Each section loads on its own, so a slow module (e.g. contests) never holds up
 * attendance or interactions. getStudent() is cached per request; when the module
 * APIs are connected, each section gets its own fetch here.
 */
async function Section({ niatId, component: Component }: { niatId: string; component: SectionComponent }) {
  const d = await getStudent(niatId);
  return d ? <Component d={d} /> : null;
}

function SectionSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-7 w-48" />
      <Skeleton className={tall ? "h-96 rounded-xl" : "h-56 rounded-xl"} />
    </div>
  );
}

const SECTIONS: { key: string; component: SectionComponent; tall?: boolean }[] = [
  { key: "attendance", component: AttendanceSection, tall: true },
  { key: "progress", component: ProgressSection, tall: true },
  { key: "interactions", component: InteractionsSection },
  { key: "tests", component: TestsSection, tall: true },
  { key: "contests", component: ContestsSection, tall: true },
  { key: "records", component: RecordsSection },
  { key: "timeline", component: TimelineSection },
];

/** Admins and super admins: who changed this student's instructor, coach or class, and from where. */
async function ChangeHistory({ user, niatId }: { user: SessionUser; niatId: string }) {
  const entries = await studentChanges(user, niatId);
  return (
    <section id="changes" aria-labelledby="changes-h" className="flex scroll-mt-6 flex-col gap-3">
      <h2 id="changes-h" className="text-[22px] font-semibold">
        Change history
        <span className="ml-2 text-[15px] font-medium text-muted-foreground">· admins only</span>
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ChangeTable entries={entries} showSubject={false} />
      </div>
    </section>
  );
}

async function StudentContent({ params }: { params: Promise<{ niatId: string }> }) {
  const user = await requireAccess("/students");
  const { niatId } = await params;
  const d = await getStudent(niatId);
  if (!d) notFound();
  if (!canViewStudent(user, d.student)) redirect("/forbidden");

  return (
    <>
      <Link href="/students" className="flex min-h-8 items-center text-[13px] font-semibold text-primary hover:text-accent-strong">
        ← All students
      </Link>
      <ProfileHeader d={d} />
      <FlagsBanner d={d} />
      <Snapshot d={d} />
      <JumpBar />
      {SECTIONS.map(({ key, component, tall }) => (
        <Suspense key={key} fallback={<SectionSkeleton tall={tall} />}>
          <Section niatId={d.student.niatId} component={component} />
        </Suspense>
      ))}
      {isAdminRole(user.role) ? (
        <Suspense fallback={<SectionSkeleton />}>
          <ChangeHistory user={user} niatId={d.student.niatId} />
        </Suspense>
      ) : null}
    </>
  );
}

export default function StudentPage({ params }: PageProps<"/students/[niatId]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading student">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      }
    >
      <StudentContent params={params} />
    </Suspense>
  );
}
