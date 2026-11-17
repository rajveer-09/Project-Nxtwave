/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { History, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/common/components/confirm";
import { Button } from "@/common/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/common/ui/dialog";
import { assignmentHistoryAction, restoreAssignmentAction } from "@/modules/admin/actions";
import type { AssignmentHistory, KindHistory } from "@/modules/admin/assignments-data";
import { cn } from "@/common/lib/utils";

type Kind = "instructor" | "coach";
const LABEL: Record<Kind, string> = { instructor: "Instructor", coach: "Success coach" };
const NONE: Record<Kind, string> = { instructor: "Unassigned", coach: "No coach" };
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const day = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * History button at the end of an assignment row. Opens the student's instructor and coach history:
 * every change (who, when, from where) and every period, with Undo for the latest change and
 * "Set to …" for anything earlier. Each of those is confirmed with a preview and saved as a new,
 * logged change, so history is never rewritten.
 */
export function AssignmentHistoryButton({ niatId, student }: { niatId: string; student: string }) {
  const { ask, dialog } = useConfirm();
  const [history, setHistory] = useState<AssignmentHistory | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Kind>("instructor");
  const [loading, startLoading] = useTransition();

  function load() {
    startLoading(async () => {
      const result = await assignmentHistoryAction(niatId);
      if (!result.ok) return void toast.error(result.error);
      setHistory(result.history);
      setOpen(true);
    });
  }

  function setTo(kind: Kind, h: KindHistory, target: { staffId: string | null; name: string | null }, how: "undo" | "restore") {
    setOpen(false);
    ask({
      title: how === "undo" ? `Undo the last ${LABEL[kind].toLowerCase()} change for ${student}?` : `Set ${student}'s ${LABEL[kind].toLowerCase()} back?`,
      changes: [
        { label: "Student", after: `${student} · ${niatId}` },
        { label: LABEL[kind], before: h.current.name ?? NONE[kind], after: target.name ?? NONE[kind] },
      ],
      description: "Saved as a new change in the history and the change log; nothing earlier is erased.",
      confirmLabel: how === "undo" ? "Undo change" : "Set it back",
      action: () => restoreAssignmentAction(niatId, kind, target.staffId, how),
      onCancel: () => setOpen(true),
    });
  }

  const h = history?.[tab];
  return (
    <>
      <Button variant="ghost" size="sm" onClick={load} disabled={loading} aria-label={`History of ${student}'s assignments`} title="History, undo and restore">
        <History aria-hidden="true" className="size-4" />
        <span className="hidden xl:inline">{loading ? "Loading…" : "History"}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 p-6 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Assignment history · {student}</DialogTitle>
            <DialogDescription className="text-[13px]">{niatId} · undo the latest change or set any earlier one back.</DialogDescription>
          </DialogHeader>
          {history && h ? (
            <>
              <div role="tablist" aria-label="Which assignment" className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-semibold">
                {(["instructor", "coach"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={cn("h-9 rounded-lg transition-colors", tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    {LABEL[k]} · {history[k].current.name ?? NONE[k]}
                  </button>
                ))}
              </div>

              <section aria-label="Changes" className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Changes</h3>
                {!h.events.length ? <p className="text-[13px] text-muted-foreground">No changes recorded yet. The log starts on 17 Nov 2026.</p> : null}
                {h.events.map((e, i) => {
                  const latest = i === 0 && (e.after.staffId ?? null) === (h.current.staffId ?? null);
                  const canSetBefore = e.before.staffId === null ? !!h.current.staffId : h.available.includes(e.before.staffId) && e.before.staffId !== h.current.staffId;
                  return (
                    <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5">
                      <div className="flex min-w-0 flex-col gap-0.5 text-[13px]">
                        <span>
                          <span className="text-muted-foreground">{e.before.name ?? NONE[tab]}</span>
                          <span aria-label="changed to" className="px-1.5 text-muted-foreground">→</span>
                          <span className="font-semibold">{e.after.name ?? NONE[tab]}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {when(e.at)} · by {e.by} · {e.source}
                          {e.detail ? ` · ${e.detail}` : ""}
                        </span>
                      </div>
                      {latest && canSetBefore ? (
                        <Button size="sm" variant="outline" onClick={() => setTo(tab, h, e.before, "undo")}>
                          <RotateCcw aria-hidden="true" className="size-3.5" />
                          Undo
                        </Button>
                      ) : canSetBefore && e.before.staffId ? (
                        <Button size="sm" variant="outline" onClick={() => setTo(tab, h, e.before, "restore")}>
                          Set to {e.before.name}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </section>

              <section aria-label="Periods" className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Assignment periods</h3>
                {!h.periods.length ? <p className="text-[13px] text-muted-foreground">Never assigned.</p> : null}
                <ul className="flex flex-col divide-y divide-muted rounded-xl border border-border">
                  {h.periods.map((p) => (
                    <li key={`${p.staffId}-${p.from}`} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 text-[13px]">
                      <span>
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {day(p.from)} → {p.to ? day(p.to) : "now"}
                        </span>
                      </span>
                      {!p.to ? (
                        <span className="text-xs font-semibold text-accent-strong">Current</span>
                      ) : p.available && p.staffId !== h.current.staffId ? (
                        <Button size="sm" variant="outline" onClick={() => setTo(tab, h, { staffId: p.staffId, name: p.name }, "restore")}>
                          Set to {p.name}
                        </Button>
                      ) : !p.available ? (
                        <span className="text-xs text-muted-foreground">No longer active</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}
