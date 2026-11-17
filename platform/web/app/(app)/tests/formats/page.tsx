/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/common/components/page-header";
import { FormatBuilder } from "@/modules/tests/components/format-builder";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { isAdminRole } from "@/common/auth/roles";
import { listFormats, listTests } from "@/modules/tests/data";

export const metadata = { title: "Result format" };

async function Content() {
  const user = await requireAccess("/tests");
  if (!isAdminRole(user.role)) redirect("/forbidden");
  const format = (await listFormats())[0];
  const current = format.versions.at(-1)!;
  const usedBy = (await listTests()).filter((t) => t.formatId === format.id && t.version === current.version).length;
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/tests" className="font-semibold text-primary hover:text-accent-strong">
            ← Weekly tests
          </Link>
        }
        title="What instructors fill in for each test"
        description="Add, remove and reorder fields. The results screen is built from this format; the preview updates as you edit."
      />
      {/* key: reset the editor to the newest version after publishing */}
      <FormatBuilder key={current.version} formatId={format.id} name={format.name} current={current} usedBy={usedBy} />
    </>
  );
}

export default function FormatsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
