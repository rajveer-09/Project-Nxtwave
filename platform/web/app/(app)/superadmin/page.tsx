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
import { assignableRoles, ROLE_LABEL, type Role } from "@/common/auth/roles";
import { listChanges } from "@/modules/admin/change-log-data";
import { listStaff } from "@/modules/admin/staff-data";
import { ChangeTable } from "@/modules/admin/components/change-table";
import { StaffTable } from "@/modules/admin/components/staff-table";
import { usingSampleData } from "@/common/data/roster";

export const metadata = { title: "Super admin" };

const RULES: [Role, string][] = [
  ["owner", "Superadmin panel and everything else. Super admins are set in the database only: nobody can add, change or remove one from NxtOne, including other super admins."],
  ["admin", "Admin panel: assignments, staff (including other admins), change log, curriculum, messages. Never sees super admins."],
  ["senior_instructor", "Senior SDI panel: assignments and their team. Never sees admins or super admins, and no change log."],
  ["instructor", "No panel. My students: the students assigned to them."],
  ["success_coach", "No panel. My students: the students they coach."],
];
const STUDENT_RULE = "Students sign in with their NIAT ID at /login (Student tab) and see only their own page at /me. Admins issue their first password in Student access.";

/** Everyone below super admin, one section per role (people with no NxtOne access last). */
const GROUPS: { role: Role | null; title: string; description: string }[] = [
  { role: "admin", title: "Admins", description: "Managers: the Admin panel. They can add and edit admins and everyone below." },
  { role: "senior_instructor", title: "Senior instructors", description: "The Senior SDI panel: assignments and their team." },
  { role: "instructor", title: "Instructors", description: "My students: the students assigned to them." },
  { role: "success_coach", title: "Success coaches", description: "My students: the students they coach." },
  { role: null, title: "No NxtOne access", description: "Staff records without a role, e.g. instructors from the old apps who never signed in. Give a role to let them in." },
];

async function Content() {
  const user = await requireAccess("/superadmin");
  const [{ rows }, roleChanges] = await Promise.all([listStaff(user), listChanges(user, { entity: "staff_role" })]);
  const supers = rows.filter((r) => r.role === "owner");
  const deactivated = rows.filter((r) => !r.active && r.role !== "owner");
  const roles = assignableRoles(user.role);
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
          <div className="grid grid-cols-[150px_1fr] gap-3">
            <dt className="font-semibold">Student</dt>
            <dd className="text-sidebar-foreground">{STUDENT_RULE}</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard
        title={`Super admins · ${supers.filter((r) => r.active).length} active`}
        description="Fixed in the database; they can't be changed from NxtOne. Admins can't see this list."
        bodyClassName="px-0 pb-2"
      >
        <StaffTable rows={supers} roles={[]} mode="readonly" />
      </SectionCard>
      <SectionCard
        title={`Deactivated · ${deactivated.length}`}
        description="Deactivated by admins or super admins; they can't sign in. Reactivate, or delete permanently (select several to act on many)."
        bodyClassName="px-0 pb-2"
      >
        <StaffTable rows={deactivated} roles={[]} mode="deactivated" />
      </SectionCard>
      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.active && r.role === g.role);
        return (
          <SectionCard key={g.title} title={`${g.title} · ${list.length}`} description={g.description} bodyClassName="px-0 pb-2">
            <StaffTable rows={list} roles={roles} mode="active" viewerRole={usingSampleData() ? undefined : user.role} />
          </SectionCard>
        );
      })}
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
