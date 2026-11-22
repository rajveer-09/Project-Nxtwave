/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StatusPill } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { SearchField } from "@/common/components/search-field";
import { searchMatcher } from "@/common/lib/search";
import { Skeleton } from "@/common/ui/skeleton";
import { cn } from "@/common/lib/utils";
import { messagesApi, SENT_POLL_MS, sentKey, timeAgo } from "../api";
import { PRIORITY_INFO } from "../audience";

/** Sent messages with delivery / read / acknowledged counts, refreshed every few seconds. */
export function SentList() {
  const q = useQuery({ queryKey: sentKey, queryFn: messagesApi.sent, refetchInterval: SENT_POLL_MS });
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const match = searchMatcher(query);
  const sent = q.data?.sent ?? [];
  const shown = sent.filter((m) => match(m.subject, m.body, m.audienceLabel, m.fromName));

  return (
    <section aria-labelledby="sent-h" className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="sent-h" className="text-lg font-semibold">
          Sent
        </h2>
        <span className="text-xs text-muted-foreground">Counts refresh every few seconds</span>
      </div>
      {sent.length > 5 ? (
        <SearchField label="Search sent messages" placeholder="Subject, text or who it went to" value={query} onChange={setQuery} className="w-full max-w-80" />
      ) : null}
      {q.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : q.isError ? (
        <EmptyState title="Couldn't load sent messages" description={q.error.message} />
      ) : !sent.length ? (
        <EmptyState title="Nothing sent yet" />
      ) : !shown.length ? (
        <EmptyState title={`No message matches “${query.trim()}”`} />
      ) : (
        shown.map((m) => {
          const expanded = open === m.id;
          const pct = (n: number) => `${m.total ? (n / m.total) * 100 : 0}%`;
          return (
            <article key={m.id} className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="font-bold">{m.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.audienceLabel} · {timeAgo(m.createdAt)} · from {m.fromName}
                  </span>
                </div>
                <StatusPill tone={m.priority === "urgent" ? "warning" : m.priority === "important" ? "accent" : "neutral"}>{PRIORITY_INFO[m.priority].label}</StatusPill>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="bg-primary" style={{ width: pct(m.read) }} />
                <span className="bg-accent-border" style={{ width: pct(m.delivered - m.read) }} />
              </div>
              <p className="flex flex-wrap gap-x-4 text-xs text-sidebar-foreground">
                <span>
                  <b>{m.read}</b> read
                </span>
                <span>
                  <b>{m.delivered - m.read}</b> delivered, not read
                </span>
                <span>
                  <b>{m.total - m.delivered}</b> not opened the app yet
                </span>
                {m.requireAck ? (
                  <span>
                    <b>{m.acked}</b> of {m.total} acknowledged
                  </span>
                ) : null}
              </p>
              <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : m.id)} className="min-h-9 self-start text-[13px] font-semibold text-primary hover:text-accent-strong">
                {expanded ? "Hide recipients" : "Show who has read it"}
              </button>
              {expanded ? (
                <ul className="border-t border-muted text-[13px]">
                  {m.recipients.map((r) => (
                    <li key={r.id} className="flex min-h-10 items-center justify-between gap-2 border-b border-muted last:border-b-0">
                      <span>
                        <b>{r.name}</b>
                      </span>
                      <span className={cn("font-semibold", r.ackAt || r.readAt ? "text-accent-strong" : r.deliveredAt ? "text-sidebar-foreground" : "text-muted-foreground")}>
                        {r.ackAt ? "Acknowledged" : r.readAt ? "Read" : r.deliveredAt ? "Delivered" : "Not opened yet"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })
      )}
    </section>
  );
}
