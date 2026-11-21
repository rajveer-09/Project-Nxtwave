/*

Author : Rajveer Sharma
Date : 21 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { PageHeader } from "@/common/components/page-header";
import { StudentsResults, StudentsResultsSkeleton } from "@/modules/students/components/students-results";

export const metadata = { title: "My students" };

/** Senior instructors' own students (assigned to them on Assignments); Students lists everyone. */
export default function MyStudentsPage({ searchParams }: PageProps<"/my-students">) {
  return (
    <>
      <PageHeader eyebrow="Assigned to you" title="My students" />
      <Suspense fallback={<StudentsResultsSkeleton />}>
        <StudentsResults searchParams={searchParams} mine />
      </Suspense>
    </>
  );
}
