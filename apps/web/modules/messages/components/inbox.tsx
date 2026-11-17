/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusPill } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { Button } from "@/common/ui/button";
import { Skeleton } from "@/common/ui/skeleton";
import { cn } from "@/common/lib/utils";
import { markReadAction } from "../actions";
import { INBOX_POLL_MS, inboxKey, messagesApi, timeAgo } from "../api";
import { PRIORITY_INFO } from "../audience";

/** Messages sent to the signed-in person. Opening one marks it read. */
export function Inbox() {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: inboxKey, queryFn: messagesApi.inbox, refetchInterval: INBOX_POLL_MS });
  const [open, setOpen] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(id: string, ack: boolean) {
    startTransition(async () => {
      const result = await markReadAction(id, ack);
      if (!result.ok) toast.error(result.error);
      else if (ack) toast.success("Acknowledged.");
      await queryClient.invalidateQueries({ queryKey: inboxKey });
    });
  }

  if (q.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (q.isError) return <EmptyState title="Couldn't load your messages" description={q.error.message} />;
  if (!q.data?.messages.length) return <EmptyState title="No messages yet" description="Messages from admins show here and on the bell." />;

  return (
    <ul className="flex flex-col gap-3">
      {q.data.messages.map((m) => {
        const expanded = open === m.id;
        return (
          <li key={m.id} className={cn("overflow-hidden rounded-xl border bg-card", m.readAt ? "border-border" : "border-accent-border")}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                setOpen(expanded ? null : m.id);
                if (!m.readAt) act(m.id, false);
              }}
              className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-surface-subtle"
            >
              <span className="flex min-w-0 flex-col">
                <span className={cn(m.readAt ? "font-semibold" : "font-bold")}>
                  {!m.readAt ? <span className="mr-2 inline-block size-2 rounded-full bg-primary align-middle" aria-label="Unread" /> : null}
                  {m.subject}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.fromName} · {timeAgo(m.createdAt)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {m.priority !== "normal" ? <StatusPill tone={m.priority === "urgent" ? "warning" : "accent"}>{PRIORITY_INFO[m.priority].label}</StatusPill> : null}
                {m.requireAck ? <StatusPill tone={m.ackAt ? "accent" : "warning"}>{m.ackAt ? "Acknowledged" : "Needs acknowledgement"}</StatusPill> : null}
              </span>
            </button>
            {expanded ? (
              <div className="flex flex-col gap-3 border-t border-muted px-4 py-3">
                <p className="text-sm whitespace-pre-line">{m.body}</p>
                {m.requireAck && !m.ackAt ? (
                  <Button className="h-10 self-start" disabled={pending} onClick={() => act(m.id, true)}>
                    Acknowledge
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
