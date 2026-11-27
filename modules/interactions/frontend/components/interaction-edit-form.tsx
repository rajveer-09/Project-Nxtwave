/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/common/lib/utils";
import { Button } from "@/common/ui/button";
import { saveInteractionLog, type InteractionLogView } from "@nxtone/interactions-ui/actions";
import { STATUSES, STATUS_LABEL, type InteractionStatus } from "@nxtone/interactions-ui/lib/types";

/**
 * The edit form inside an interaction's Inspect pop-up, for those allowed: an admin, who took it, or
 * the student's instructor. Topics and who took it stay as logged. Saving goes through the
 * interactions service, which checks again (and requires questions and remarks).
 */

const input =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const area =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function InteractionEditForm({ v, onDone, onCancel }: { v: InteractionLogView; onDone: () => void; onCancel: () => void }) {
  const it = v.interaction;
  const [f, setF] = useState({
    date: it.date,
    status: it.status as InteractionStatus,
    rating: it.rating,
    questionsText: v.questionsText,
    stepsReached: { ...it.stepsReached } as Record<string, string>,
    performedWell: it.performedWell,
    improvementAreas: it.improvementAreas,
    actionItems: it.actionItems,
    remarks: it.remarks,
    meetRecording: it.meetRecording,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF((x) => ({ ...x, [k]: val }));
  // As the service requires: questions and remarks always; other feedback if it had any before.
  const required = (k: "performedWell" | "improvementAreas" | "actionItems") => !!it[k].trim();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const save = () =>
    start(async () => {
      setError(null);
      const result = await saveInteractionLog(it.id, f);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Interaction updated.");
      onDone();
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-3.5"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Date
          <input type="date" required max={today} value={f.date} onChange={(e) => set("date", e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Outcome
          <select value={f.status} onChange={(e) => set("status", e.target.value as InteractionStatus)} className={input}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Rating</legend>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={f.rating === r}
                onClick={() => set("rating", r)}
                className={cn("h-10 flex-1 rounded-lg border text-sm font-semibold", f.rating === r ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted")}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {v.stepOptions.length ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Steps reached</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {v.stepOptions.map((o) => (
              <label key={o.item} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-medium" title={o.item}>
                  {o.item}
                </span>
                <select
                  value={f.stepsReached[o.item] ?? ""}
                  onChange={(e) => set("stepsReached", { ...f.stepsReached, [o.item]: e.target.value })}
                  className={cn(input, "w-40")}
                >
                  <option value="">Not recorded</option>
                  {o.steps.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} {s.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
        Questions asked (one per line)
        <textarea required rows={6} value={f.questionsText} onChange={(e) => set("questionsText", e.target.value)} className={area} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["performedWell", "Performed well"],
            ["improvementAreas", "Improvement areas"],
            ["actionItems", "Action items"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            {label}
            <textarea rows={3} required={required(k)} value={f[k]} onChange={(e) => set(k, e.target.value)} className={area} />
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
        Remarks
        <textarea required rows={2} value={f.remarks} onChange={(e) => set("remarks", e.target.value)} className={area} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
        Recording link
        <input type="url" value={f.meetRecording} onChange={(e) => set("meetRecording", e.target.value)} placeholder="https://…" className={input} />
      </label>

      {error ? (
        <p role="alert" className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-[13px] text-warning">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
