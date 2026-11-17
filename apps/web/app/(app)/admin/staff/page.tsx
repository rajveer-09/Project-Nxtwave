/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { requireAccess } from "@/common/auth/guard";
import { listStaff } from "@/modules/admin/staff-data";

export const metadata = { title: "Staff and roles" };

const MODULE_LABEL: Record<string, string> = {
  platform: "Platform",
  attendance: "Attendance",
  logs: "Interactions",
  contest: "Contests",
};
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  senior_instructor: "Senior instructor",
  instructor: "Instructor",
  viewer: "Viewer",
};

export default async function StaffPage() {
  await requireAccess("/admin/staff");
  const { rows, sample } = await listStaff();
  const active = rows.filter((r) => r.active).length;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Staff & roles"
        description="Who can sign in, and what they can do in each module. Adding people and changing roles comes next in this phase."
        actions={sample ? <StatusPill>Sample data · no database connected</StatusPill> : null}
      />
      <SectionCard
        title={`${active} active staff`}
        description={`${rows.length - active} inactive or left`}
        bodyClassName="px-0 pb-2"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <caption className="sr-only">Staff and their roles</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                <th scope="col" className="border-b border-border px-5 py-2.5 font-semibold">Person</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Roles</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Students</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Sign-in</th>
                <th scope="col" className="border-b border-border px-5 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.active ? undefined : "text-muted-foreground"}>
                  <td className="border-b border-muted px-5 py-3">
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.email}
                      {row.instructorCode ? ` · ${row.instructorCode}` : ""}
                    </div>
                  </td>
                  <td className="border-b border-muted px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.roles.length === 0 ? (
                        <span className="text-muted-foreground">No roles</span>
                      ) : (
                        row.roles.map((r) => (
                          <span key={r.module} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-sidebar-foreground">
                            {MODULE_LABEL[r.module] ?? r.module}: {ROLE_LABEL[r.role] ?? r.role}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="border-b border-muted px-3 py-3 tabular">{row.studentsAssigned || "—"}</td>
                  <td className="border-b border-muted px-3 py-3">{row.signIn === "google" ? "Google only" : "Password or Google"}</td>
                  <td className="border-b border-muted px-5 py-3">
                    {row.active ? <StatusPill tone="accent">Active</StatusPill> : <StatusPill>Inactive</StatusPill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
