/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { ROLE_LABEL, type Role } from "@/common/auth/roles";
import { listChanges } from "@/modules/admin/change-log-data";
import { listStaff } from "@/modules/admin/staff-data";
import { ChangeTable } from "@/modules/admin/components/change-table";
import { StaffTable } from "@/modules/admin/components/staff-table";

export const metadata = { title: "Super admin" };

const RULES: [Role, string][] = [
  ["owner", "Superadmin panel and everything else. The only role that can see, add or edit super admins."],
  ["admin", "Admin panel: assignments, staff (including other admins), change log, curriculum, messages. Never sees super admins."],
  ["senior_instructor", "Senior SDI panel: assignments and their team. Never sees admins or super admins, and no change log."],
  ["instructor", "No panel. My students: the students assigned to them."],
  ["success_coach", "No panel. My students: the students they coach."],
];

async function Content() {
  const user = await requireAccess("/superadmin");
  const [{ rows }, roleChanges] = await Promise.all([listStaff(user), listChanges(user, { entity: "staff_role" })]);
  const supers = rows.filter((r) => r.role === "owner");
  return (
    <>
      <PageHeader eyebrow="Superadmin panel" title="Super admins & access" description="Who can do what in NxtOne." />
      <SectionCard title="Access rules">
        <dl className="grid gap-2.5 text-[13px]">
          {RULES.map(([role, text]) => (
            <div key={role} className="grid grid-cols-[150px_1fr] gap-3">
              <dt className="font-semibold">{ROLE_LABEL[role]}</dt>
              <dd className="text-sidebar-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
      <SectionCard
        title={`Super admins · ${supers.filter((r) => r.active).length} active`}
        description="Make someone a super admin by picking that role for them below or in Staff & roles. Admins can't see this list."
        bodyClassName="px-0 pb-2"
      >
        <StaffTable rows={supers} viewer={user} />
      </SectionCard>
      <SectionCard title="Everyone" description="All staff, including super admins." bodyClassName="px-0 pb-2">
        <StaffTable rows={rows.filter((r) => r.role !== "owner")} viewer={user} />
      </SectionCard>
      <SectionCard
        title="Recent role changes"
        bodyClassName="px-0 pb-2"
        action={
          <Link href="/admin/change-log?entity=staff_role" className="text-[13px] font-semibold text-primary hover:text-accent-strong">
            Full change log →
          </Link>
        }
      >
        <ChangeTable entries={roleChanges.entries.slice(0, 15)} />
      </SectionCard>
    </>
  );
}

export default function SuperAdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
