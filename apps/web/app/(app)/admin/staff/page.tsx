/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { assignableRoles } from "@/common/auth/roles";
import { listStaff } from "@/modules/admin/staff-data";
import { AddStaffForm } from "@/modules/admin/components/staff-controls";
import { StaffTable } from "@/modules/admin/components/staff-table";

export const metadata = { title: "Staff and roles" };

async function StaffContent() {
  const user = await requireAccess("/admin/staff");
  const { rows, sample } = await listStaff(user);
  const active = rows.filter((r) => r.active).length;
  const roles = assignableRoles(user.role);
  const senior = user.role === "senior_instructor";

  return (
    <>
      <PageHeader
        eyebrow={senior ? "Senior SDI panel" : "Admin panel"}
        title={senior ? "My team" : "Staff & roles"}
        description={
          senior
            ? "Instructors, success coaches and senior instructors. Ask an admin to change someone's role."
            : user.role === "owner"
              ? "Everyone who can sign in, and what they can do. Every change is in the change log."
              : "Everyone below super admin. You can add and edit admins too; every change is in the change log."
        }
        actions={sample ? <StatusPill>Sample data · no database connected</StatusPill> : null}
      />
      {roles.length && !sample ? (
        <SectionCard title="Add a person" description="They sign in with Google, or with the first password you set here.">
          <AddStaffForm roles={roles} />
        </SectionCard>
      ) : null}
      <SectionCard title={`${active} active`} description={`${rows.length - active} inactive or left`} bodyClassName="px-0 pb-2">
        <StaffTable rows={rows} viewer={user} />
      </SectionCard>
    </>
  );
}

export default function StaffPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
      <StaffContent />
    </Suspense>
  );
}
