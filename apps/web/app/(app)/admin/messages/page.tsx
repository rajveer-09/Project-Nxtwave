/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { PageHeader } from "@/common/components/page-header";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { STAFF } from "@/common/sample-data/staff";
import { Compose } from "@/modules/messages/components/compose";
import { SentList } from "@/modules/messages/components/sent-list";
import { directory } from "@/modules/messages/data";

export const metadata = { title: "Messages" };

async function Content() {
  const user = await requireAccess("/admin/messages");
  const dir = directory();
  const sender = STAFF.find((s) => s.id === user.id) ?? STAFF.find((s) => s.name === user.name);
  const colleges = [...new Set(dir.flatMap((s) => s.colleges))].sort();
  const halls = [...new Set(dir.flatMap((s) => s.halls))].sort((a, b) => Number(a.split(" ")[1]) - Number(b.split(" ")[1]));
  return (
    <div className="flex flex-wrap items-start gap-5">
      <Compose directory={dir} senderId={sender?.id ?? user.id} colleges={colleges} halls={halls} />
      <SentList />
    </div>
  );
}

export default function AdminMessagesPage() {
  return (
    <>
      <PageHeader eyebrow="Admin" title="Messages" description="Send to whole roles (optionally one college or hall) or to people you pick. Recipients see it on the bell; urgent messages show as a banner until read." />
      <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
        <Content />
      </Suspense>
    </>
  );
}
