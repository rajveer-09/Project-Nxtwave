/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { CurriculumAdmin } from "@/modules/curriculum/components/curriculum-admin";
import { listQuestions, offRoadmapQueue, roadmap } from "@/modules/curriculum/data";

export const metadata = { title: "Curriculum" };

async function Content() {
  await requireAccess("/admin/curriculum");
  const [questions, queue] = await Promise.all([listQuestions(true), offRoadmapQueue()]);
  return <CurriculumAdmin roadmap={roadmap()} questions={questions} queue={queue} />;
}

export default function CurriculumPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Curriculum & question bank"
        description="The roadmap instructors follow when they log interactions. Changes apply to new interactions; past logs keep what was asked."
        actions={<StatusPill>Sample data</StatusPill>}
      />
      <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
        <Content />
      </Suspense>
    </>
  );
}
