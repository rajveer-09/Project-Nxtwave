/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { StudentsResults, StudentsResultsSkeleton } from "@/modules/students/components/students-results";
import { usingSampleData } from "@/common/data/roster";

export const metadata = { title: "Students" };

export default function StudentsPage({ searchParams }: PageProps<"/students">) {
  return (
    <>
      <PageHeader
        title="Students"
        actions={usingSampleData() ? <StatusPill>Sample data · no database connected</StatusPill> : null}
      />
      <Suspense fallback={<StudentsResultsSkeleton />}>
        <StudentsResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}
