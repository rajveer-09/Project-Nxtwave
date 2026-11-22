/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useState } from "react";
import { StatusPill } from "@/common/components/chips";
import { useConfirm } from "@/common/components/confirm";
import { Dropdown } from "@/common/components/dropdown";
import { SearchField } from "@/common/components/search-field";
import { searchMatcher } from "@/common/lib/search";
import { canViewAs, ROLE_LABEL, type Role } from "@/common/auth/roles";
import { ViewAsButton } from "@/modules/shell/view-as";
import { Button } from "@/common/ui/button";
import { changeRoleAction, deactivateAction, deleteStaffAction, reactivateAction, resetPasswordAction } from "@/modules/admin/actions";
import type { StaffListRow } from "@/modules/admin/staff-data";

const roleName = (r: Role | null) => (r ? ROLE_LABEL[r] : "No access");
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—";

/**
 * Staff list with multi-select. Every change opens a confirmation with a preview first.
 * - "active":      role picker, Deactivate (one or selected) for people the viewer may edit
 * - "deactivated": super admins' list; Reactivate or Delete (one or selected)
 * - "readonly":    no controls
 */
export function StaffTable({
  rows,
  roles,
  mode = "active",
  viewerRole,
}: {
  rows: StaffListRow[];
  roles: Role[];
  mode?: "active" | "deactivated" | "readonly";
  /** The person looking (database mode only): admins and super admins get "View as" on people ranked below them. */
  viewerRole?: Role;
}) {
  const { ask, dialog } = useConfirm();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const match = searchMatcher(query);
  const shown = rows.filter((r) => match(r.name, r.email, r.instructorCode, roleName(r.role)));
  // "Select everyone" and bulk actions cover the people shown by the search.
  const selectable = mode !== "readonly" ? shown.filter((r) => r.editable) : [];
  const chosen = selectable.filter((r) => picked.has(r.id));
  const allPicked = selectable.length > 0 && chosen.length === selectable.length;
  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const clear = () => setPicked(new Set());

  const deactivate = (list: StaffListRow[]) =>
    ask({
      title: list.length === 1 ? `Deactivate ${list[0].name}?` : `Deactivate ${list.length} people?`,
      description: "They're signed out everywhere and can't sign in. They move to the super admins' Deactivated list, where only a super admin can reactivate or delete them.",
      items: list.map((r) => `${r.name} · ${r.email} · ${roleName(r.role)}`),
      confirmLabel: list.length === 1 ? "Deactivate" : `Deactivate ${list.length}`,
      danger: true,
      action: () => deactivateAction(list.map((r) => r.id)),
      onSuccess: clear,
    });
  const resetPassword = (list: StaffListRow[]) =>
    ask({
      title: list.length === 1 ? `Reset ${list[0].name}'s password?` : `Reset ${list.length} passwords?`,
      description: "Their current password stops working and they're signed out everywhere. They sign in with the default first password and choose a new one.",
      items: list.map((r) => `${r.name} · ${r.email}`),
      confirmLabel: list.length === 1 ? "Reset password" : `Reset ${list.length} passwords`,
      action: () => resetPasswordAction(list.map((r) => r.id)),
      onSuccess: clear,
    });
  const reactivate = (list: StaffListRow[]) =>
    ask({
      title: list.length === 1 ? `Reactivate ${list[0].name}?` : `Reactivate ${list.length} people?`,
      description: "They can sign in again with the role they had.",
      items: list.map((r) => `${r.name} · ${roleName(r.role)}`),
      confirmLabel: list.length === 1 ? "Reactivate" : `Reactivate ${list.length}`,
      action: () => reactivateAction(list.map((r) => r.id)),
      onSuccess: clear,
    });
  const remove = (list: StaffListRow[]) =>
    ask({
      title: list.length === 1 ? `Delete ${list[0].name}?` : `Delete ${list.length} people?`,
      description:
        "This can't be undone. Sign-in, roles and email are removed and their students become unassigned. Their name stays in the change log and history.",
      items: list.map((r) => `${r.name} · ${r.email}${r.studentsAssigned ? ` · ${r.studentsAssigned} students will be unassigned` : ""}`),
      confirmLabel: list.length === 1 ? "Delete permanently" : `Delete ${list.length} permanently`,
      danger: true,
      action: () => deleteStaffAction(list.map((r) => r.id)),
      onSuccess: clear,
    });
  const changeRole = (row: StaffListRow, next: Role) =>
    ask({
      title: `Change ${row.name}'s role?`,
      changes: [
        { label: "Person", after: `${row.name} · ${row.email}` },
        { label: "NxtOne role", before: roleName(row.role), after: ROLE_LABEL[next] },
      ],
      description: "It applies the next time they open a page.",
      confirmLabel: "Change role",
      action: () => changeRoleAction(row.id, next),
    });

  return (
    <div className="flex flex-col">
      {rows.length > 6 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          <SearchField label="Search staff" placeholder="Name, email, instructor code or role" value={query} onChange={setQuery} className="w-full max-w-80" />
          {query.trim() ? <span className="text-[13px] text-muted-foreground">{shown.length} of {rows.length}</span> : null}
        </div>
      ) : null}
      {selectable.length ? (
        <div className="flex min-h-12 flex-wrap items-center gap-3 border-b border-border px-5 py-2 text-[13px]">
          <span className="text-muted-foreground">{chosen.length ? `${chosen.length} selected` : "Select people to act on several at once"}</span>
          {chosen.length ? (
            <>
              {mode === "active" ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => resetPassword(chosen)}>
                    Reset {chosen.length} passwords
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deactivate(chosen)}>
                    Deactivate {chosen.length}
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => reactivate(chosen)}>
                    Reactivate {chosen.length}
                  </Button>
                  <Button size="sm" className="bg-[#C42B1C] text-white hover:bg-[#A82315]" onClick={() => remove(chosen)}>
                    Delete {chosen.length}
                  </Button>
                </>
              )}
              <button type="button" onClick={clear} className="text-[13px] font-semibold text-primary hover:text-accent-strong">
                Clear
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-[13px]">
          <caption className="sr-only">Staff and their roles</caption>
          <thead>
            <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
              {selectable.length ? (
                <th scope="col" className="w-10 border-b border-border py-2.5 pl-5">
                  <input
                    type="checkbox"
                    aria-label="Select everyone"
                    className="size-4 accent-primary"
                    checked={allPicked}
                    onChange={() => setPicked(allPicked ? new Set() : new Set(selectable.map((r) => r.id)))}
                  />
                </th>
              ) : null}
              <th scope="col" className="border-b border-border px-5 py-2.5 font-semibold">Person</th>
              <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">NxtOne role</th>
              <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Students</th>
              {mode === "deactivated" ? (
                <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Deactivated by</th>
              ) : (
                <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Sign-in</th>
              )}
              <th scope="col" className="border-b border-border px-5 py-2.5 text-right font-semibold">{mode === "readonly" ? "Status" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const editable = mode !== "readonly" && row.editable;
              return (
                <tr key={row.id} className={picked.has(row.id) ? "bg-accent/40" : undefined}>
                  {selectable.length ? (
                    <td className="border-b border-muted py-3 pl-5">
                      {editable ? (
                        <input type="checkbox" aria-label={`Select ${row.name}`} className="size-4 accent-primary" checked={picked.has(row.id)} onChange={() => toggle(row.id)} />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="border-b border-muted px-5 py-3">
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.email}
                      {row.instructorCode ? ` · ${row.instructorCode}` : ""}
                    </div>
                  </td>
                  <td className="border-b border-muted px-3 py-3">
                    {editable && mode === "active" && roles.length ? (
                      <Dropdown
                        aria-label={`Role for ${row.name}`}
                        className="h-9 w-44 text-[13px]"
                        value={row.role ?? ""}
                        onValueChange={(next) => {
                          if (next && next !== row.role) changeRole(row, next as Role);
                        }}
                        options={[
                          ...(row.role === null ? [{ value: "", label: "No access" }] : []),
                          ...roles.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
                        ]}
                      />
                    ) : (
                      <span className="font-medium">{roleName(row.role)}</span>
                    )}
                  </td>
                  <td className="border-b border-muted px-3 py-3 tabular">{row.studentsAssigned || "—"}</td>
                  {mode === "deactivated" ? (
                    <td className="border-b border-muted px-3 py-3">
                      <div className="font-medium">{row.deactivatedBy ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{when(row.deactivatedAt)}</div>
                    </td>
                  ) : (
                    <td className="border-b border-muted px-3 py-3">
                      {row.signIn === "first" ? <span className="text-muted-foreground">Not set up yet</span> : "Own password"}
                    </td>
                  )}
                  <td className="border-b border-muted px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {viewerRole && mode !== "deactivated" && row.active && row.role && canViewAs(viewerRole, row.role) ? (
                        <ViewAsButton staffId={row.id} name={row.name} />
                      ) : null}
                      {mode === "readonly" || !editable ? (
                        row.active ? <StatusPill tone="accent">Active</StatusPill> : <StatusPill>Deactivated</StatusPill>
                      ) : mode === "active" ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => resetPassword([row])}>
                            Reset password
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => deactivate([row])}>
                            Deactivate
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => reactivate([row])}>
                            Reactivate
                          </Button>
                          <Button size="sm" className="bg-[#C42B1C] text-white hover:bg-[#A82315]" onClick={() => remove([row])}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!shown.length ? (
              <tr>
                <td colSpan={6}className="px-5 py-6 text-center text-muted-foreground">
                  {rows.length ? `Nobody matches “${query.trim()}”.` : mode === "deactivated" ? "Nobody is deactivated." : "Nobody here."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  );
}
