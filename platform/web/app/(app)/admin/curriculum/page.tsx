/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { usingSampleData } from "@/common/data/roster";
import { PageHeader } from "@/common/components/page-header";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { CurriculumAdmin } from "@nxtone/interactions-ui/curriculum/components/curriculum-admin";
import { listQuestions, offRoadmapQueue } from "@nxtone/interactions-ui/curriculum/data";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";

export const metadata = { title: "Curriculum" };

async function Content() {
  await requireAccess("/admin/curriculum");
  const [structure, questions, queue] = await Promise.all([getStructure(), listQuestions(true), offRoadmapQueue()]);
  return <CurriculumAdmin structure={structure} questions={questions} queue={queue} />;
}

export default function CurriculumPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin panel"
        title="Curriculum & question bank"
        description="The roadmap instructors follow when they log interactions: levels, topics, subtopics, steps and questions. Changes apply to new interactions; past logs keep what was asked."
        actions={usingSampleData() ? <StatusPill>Sample data</StatusPill> : null}
      />
      <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
        <Content />
      </Suspense>
    </>
  );
}
