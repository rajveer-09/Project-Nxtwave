/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/common/components/chips";
import { useConfirm } from "@/common/components/confirm";
import { Button } from "@/common/ui/button";
import { issuePasswordsAction, studentAccessAction } from "@/modules/admin/actions";
import type { AccessRow, AccountStatus, Issued } from "@/modules/admin/student-access-data";

const STATUS: Record<AccountStatus, { label: string; tone: "accent" | "warning" | "neutral" }> = {
  none: { label: "No sign-in", tone: "neutral" },
  waiting: { label: "Not signed in yet", tone: "warning" },
  active: { label: "Active", tone: "accent" },
  disabled: { label: "Switched off", tone: "neutral" },
};
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—";

/** Passwords are shown once: as a CSV download for many students, or on screen for one. */
function downloadCsv(issued: Issued[]) {
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = ["NIAT ID,Name,Temporary password", ...issued.map((i) => [i.niatId, i.name, i.password].map(quote).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `nxtone-student-passwords-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

function useAccessActions() {
  const { ask, dialog } = useConfirm();
  const [shown, setShown] = useState<Record<string, string>>({});

  const issue = (list: { niatId: string; name: string; status: AccountStatus }[], after?: () => void) => {
    const resets = list.filter((r) => r.status !== "none").length;
    ask({
      title: list.length === 1 ? `${list[0].status === "none" ? "Give sign-in to" : "Reset the password of"} ${list[0].name}?` : `Issue new passwords for ${list.length} students?`,
      description: `${resets ? `${resets} existing password${resets === 1 ? " stops" : "s stop"} working. ` : ""}Students choose their own password the first time they sign in. ${
        list.length === 1 ? "The temporary password is shown once." : "You'll get a CSV to share privately; it isn't saved anywhere."
      }`,
      items: list.map((r) => `${r.name} · ${r.niatId} · ${STATUS[r.status].label}`),
      confirmLabel: list.length === 1 ? (list[0].status === "none" ? "Give sign-in" : "Reset password") : `Issue ${list.length} passwords`,
      action: async () => {
        const result = await issuePasswordsAction(list.map((r) => r.niatId));
        return result.ok
          ? { ok: true as const, message: list.length === 1 ? `New password for ${list[0].name} (shown once).` : `Issued ${result.issued.length} passwords. The CSV has downloaded.`, issued: result.issued }
          : result;
      },
      onSuccess: (result) => {
        if (list.length === 1) setShown((prev) => ({ ...prev, [result.issued[0].niatId]: result.issued[0].password }));
        else downloadCsv(result.issued);
        after?.();
      },
    });
  };

  const setAccess = (list: { niatId: string; name: string }[], active: boolean, after?: () => void) =>
    ask({
      title: list.length === 1 ? `Switch ${active ? "on" : "off"} ${list[0].name}'s sign-in?` : `Switch ${active ? "on" : "off"} sign-in for ${list.length} students?`,
      description: active ? "They can sign in again with their current password." : "They're signed out everywhere and can't sign in until it's switched back on.",
      items: list.map((r) => `${r.name} · ${r.niatId}`),
      confirmLabel: active ? "Switch on" : "Switch off",
      danger: !active,
      action: () => studentAccessAction(list.map((r) => r.niatId), active),
      onSuccess: after,
    });

  return { issue, setAccess, shown, dialog };
}

/** "Give sign-in to everyone in this list who has none" (filtered list, across pages). */
export function BulkIssue({ students, label }: { students: { niatId: string; name: string }[]; label: string }) {
  const { issue, dialog } = useAccessActions();
  return (
    <>
      <Button type="button" disabled={!students.length} onClick={() => issue(students.map((s) => ({ ...s, status: "none" as const })))}>
        {label}
      </Button>
      {dialog}
    </>
  );
}

/** One page of students with multi-select and bulk actions; every action is confirmed with a preview. */
export function StudentAccessTable({ rows }: { rows: AccessRow[] }) {
  const { issue, setAccess, shown, dialog } = useAccessActions();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const chosen = rows.filter((r) => picked.has(r.niatId));
  const allPicked = rows.length > 0 && chosen.length === rows.length;
  const clear = () => setPicked(new Set());
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const withAccount = chosen.filter((r) => r.status !== "none");

  return (
    <div className="flex flex-col">
      <div className="flex min-h-12 flex-wrap items-center gap-3 border-b border-border px-5 py-2 text-[13px]">
        <span className="text-muted-foreground">{chosen.length ? `${chosen.length} selected` : "Select students to act on several at once"}</span>
        {chosen.length ? (
          <>
            <Button size="sm" variant="outline" onClick={() => issue(chosen, clear)}>
              {chosen.every((r) => r.status === "none") ? `Give sign-in to ${chosen.length}` : `Issue passwords for ${chosen.length}`}
            </Button>
            {withAccount.some((r) => r.status === "disabled") ? (
              <Button size="sm" variant="outline" onClick={() => setAccess(withAccount.filter((r) => r.status === "disabled"), true, clear)}>
                Switch on {withAccount.filter((r) => r.status === "disabled").length}
              </Button>
            ) : null}
            {withAccount.some((r) => r.status !== "disabled") ? (
              <Button size="sm" variant="outline" onClick={() => setAccess(withAccount.filter((r) => r.status !== "disabled"), false, clear)}>
                Switch off {withAccount.filter((r) => r.status !== "disabled").length}
              </Button>
            ) : null}
            <button type="button" onClick={clear} className="text-[13px] font-semibold text-primary hover:text-accent-strong">
              Clear
            </button>
          </>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <caption className="sr-only">Students and their sign-in</caption>
          <thead>
            <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
              <th scope="col" className="w-10 border-b border-border py-2.5 pl-5">
                <input type="checkbox" aria-label="Select everyone on this page" className="size-4 accent-primary" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.niatId)))} />
              </th>
              <th scope="col" className="border-b border-border px-5 py-2.5 font-semibold">Student</th>
              <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Class</th>
              <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Sign-in</th>
              <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Last signed in</th>
              <th scope="col" className="border-b border-border px-5 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.niatId} className={picked.has(r.niatId) ? "bg-accent/40" : undefined}>
                <td className="border-b border-muted py-2.5 pl-5">
                  <input type="checkbox" aria-label={`Select ${r.name}`} className="size-4 accent-primary" checked={picked.has(r.niatId)} onChange={() => toggle(r.niatId)} />
                </td>
                <td className="border-b border-muted px-5 py-2.5">
                  <Link href={`/students/${r.niatId}`} className="font-semibold hover:text-primary">
                    {r.name}
                  </Link>
                  <div className="text-xs text-muted-foreground tabular">{r.niatId}</div>
                </td>
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">
                  {r.college} · {r.section} · {r.hall}
                </td>
                <td className="border-b border-muted px-3 py-2.5">
                  <StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusPill>
                </td>
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">{when(r.lastSignIn)}</td>
                <td className="border-b border-muted px-5 py-2.5">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {shown[r.niatId] ? (
                      <span className="rounded-md bg-accent px-2 py-1 font-mono text-[13px] font-semibold text-accent-strong select-all" title="Shown once">
                        {shown[r.niatId]}
                      </span>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => issue([r])}>
                      {r.status === "none" ? "Give sign-in" : "Reset password"}
                    </Button>
                    {r.status !== "none" ? (
                      <Button variant="outline" size="sm" onClick={() => setAccess([r], r.status === "disabled")}>
                        {r.status === "disabled" ? "Switch on" : "Switch off"}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  );
}

