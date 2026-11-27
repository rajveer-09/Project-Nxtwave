/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { usingSampleData } from "@/common/data/roster";
import { PageHeader } from "@/common/components/page-header";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { CurriculumAdmin } from "@nxtone/interactions-ui/curriculum/components/curriculum-admin";
import { listQuestions, offRoadmapQueue } from "@nxtone/interactions-ui/curriculum/data";
import { listBlocks } from "@nxtone/interactions-ui/curriculum/blocks";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";

export const metadata = { title: "Question Bank" };

async function Content() {
  await requireAccess("/admin/curriculum");
  const [structure, questions, queue, blocks] = await Promise.all([getStructure(), listQuestions(true), offRoadmapQueue(), listBlocks()]);
  return <CurriculumAdmin structure={structure} questions={questions} queue={queue} blocks={blocks} />;
}

/** Read when the page is opened, not at build time. */
async function SamplePill() {
  await connection();
  return usingSampleData() ? <StatusPill>Sample data</StatusPill> : null;
}

export default function CurriculumPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin panel"
        title="Question Bank"
        description="The roadmap instructors follow when they log interactions: levels, topics, subtopics, steps and questions. Changes apply to new interactions; past logs keep what was asked."
        actions={
          <Suspense fallback={null}>
            <SamplePill />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
        <Content />
      </Suspense>
    </>
  );
}
