/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "@/common/components/chips";
import { cn } from "@/common/lib/utils";

export type InteractionItem = {
  id: string;
  date: string;
  round: number;
  by: string;
  level: string;
  topics: string;
  status: string;
  rating: number;
  questions: string;
  stepsReached: string;
  performedWell: string;
  improvementAreas: string;
  actionItems: string;
  transcriptWords: number;
};

/** Expandable interaction rounds; the latest opens by default. */
export function InteractionsList({ items, student = false }: { items: InteractionItem[]; student?: boolean }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it) => {
        const expanded = open === it.id;
        const panelId = `interaction-${it.id}`;
        return (
          <li key={it.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setOpen(expanded ? null : it.id)}
              className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left hover:bg-surface-subtle"
            >
              <span className="flex flex-col">
                <span className="font-bold">
                  {it.date} · round {it.round} · {it.by}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {it.level} · {it.topics}
                </span>
              </span>
              <span className="flex items-center gap-2.5">
                <StatusPill tone={it.status === "Cleared" ? "accent" : it.status === "In progress" ? "neutral" : "warning"}>{it.status}</StatusPill>
                <span className="font-bold tabular">{it.rating} / 5</span>
                <ChevronDown aria-hidden="true" className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
              </span>
            </button>
            {expanded ? (
              <dl id={panelId} className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-5 gap-y-3 border-t border-muted px-5 pt-3 pb-4 text-[13px]">
                {[
                  ["Questions asked", it.questions],
                  ["Steps reached", it.stepsReached],
                  ["Performed well", it.performedWell],
                  ["Improvement areas", it.improvementAreas],
                  ["Action items", it.actionItems],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5">{value}</dd>
                  </div>
                ))}
                {student ? null : <div>
                  <dt className="text-xs font-bold text-muted-foreground">Recording & transcript</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-x-2">
                    <span className="text-primary">Meet recording</span>·<span className="text-primary">Transcript link</span>
                    {it.transcriptWords ? (
                      <>
                        ·<span className="text-primary">Read pasted transcript ({it.transcriptWords.toLocaleString("en-IN")} words)</span>
                      </>
                    ) : null}
                  </dd>
                </div>}
              </dl>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
