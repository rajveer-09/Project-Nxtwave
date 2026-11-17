/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { StatusPill } from "@/common/components/chips";
import { assignableRoles, ROLE_LABEL, type Role, type SessionUser } from "@/common/auth/roles";
import type { StaffListRow } from "@/modules/admin/staff-data";
import { ActiveToggle, RoleSelect } from "@/modules/admin/components/staff-controls";

const MODULE_LABEL: Record<string, string> = { platform: "NxtOne", attendance: "Attendance", logs: "Interactions", contest: "Contests" };
const MODULE_ROLE_LABEL: Record<string, string> = { ...ROLE_LABEL, viewer: "Viewer" };

/** Staff list; rows the viewer may change get a role picker and a sign-in switch. */
export function StaffTable({ rows, viewer }: { rows: StaffListRow[]; viewer: SessionUser }) {
  const roles: Role[] = assignableRoles(viewer.role);
  const editing = roles.length > 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-[13px]">
        <caption className="sr-only">Staff and their roles</caption>
        <thead>
          <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
            <th scope="col" className="border-b border-border px-5 py-2.5 font-semibold">Person</th>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">NxtOne role</th>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Module roles</th>
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
                {editing && row.editable ? (
                  <RoleSelect staffId={row.id} name={row.name} role={row.role} roles={roles} />
                ) : (
                  <span className="font-medium">{row.role ? ROLE_LABEL[row.role] : "No access"}</span>
                )}
              </td>
              <td className="border-b border-muted px-3 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {row.roles.filter((r) => r.module !== "platform").length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    row.roles
                      .filter((r) => r.module !== "platform")
                      .map((r) => (
                        <span key={r.module} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-sidebar-foreground">
                          {MODULE_LABEL[r.module] ?? r.module}: {MODULE_ROLE_LABEL[r.role] ?? r.role}
                        </span>
                      ))
                  )}
                </div>
              </td>
              <td className="border-b border-muted px-3 py-3 tabular">{row.studentsAssigned || "—"}</td>
              <td className="border-b border-muted px-3 py-3">{row.signIn === "google" ? "Google only" : "Password or Google"}</td>
              <td className="border-b border-muted px-5 py-3">
                <div className="flex items-center gap-2">
                  {row.active ? <StatusPill tone="accent">Active</StatusPill> : <StatusPill>Inactive</StatusPill>}
                  {editing && row.editable ? <ActiveToggle staffId={row.id} name={row.name} active={row.active} /> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
