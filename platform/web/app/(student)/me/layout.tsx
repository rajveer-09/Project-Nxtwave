/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/common/components/brand";
import { ProfileMenu } from "@/modules/shell/profile-menu";
import { initials } from "@/common/auth/roles";
import { getOptionalStudent } from "@/common/auth/student/session";
import { studentSignOut } from "@/modules/student/actions";

/** Who is signed in, and sign out. */
async function Who() {
  const student = await getOptionalStudent();
  if (!student) return null;
  return <ProfileMenu variant="header" name={student.name} role={student.niatId} initials={initials(student.name)} signOutAction={studentSignOut} />;
}

/** The student portal frame: brand, who is signed in, sign out. No staff navigation. */
export default function StudentLayout({ children }: LayoutProps<"/me">) {
  return (
    <div className="min-h-app bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link href="/me" aria-label="NxtOne home">
            <Brand size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <Who />
            </Suspense>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-7 sm:px-8 sm:pb-12">
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
