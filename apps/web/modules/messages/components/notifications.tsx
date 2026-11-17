/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Megaphone } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/common/ui/button";
import { markReadAction } from "../actions";
import { INBOX_POLL_MS, inboxKey, messagesApi } from "../api";

function useInbox() {
  return useQuery({ queryKey: inboxKey, queryFn: messagesApi.inbox, refetchInterval: INBOX_POLL_MS, refetchOnWindowFocus: true });
}

/** Bell in the sidebar with the unread count. */
export function MessageBell() {
  const q = useInbox();
  const unread = q.data?.unread ?? 0;
  return (
    <Link
      href="/messages"
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-sidebar-foreground hover:bg-muted"
    >
      <Bell aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
      {unread ? (
        <span className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-[#C2560F] px-1 text-[11px] font-bold text-white tabular">{unread}</span>
      ) : null}
    </Link>
  );
}

/** Urgent unread messages stay as a banner on every page until read. */
export function UrgentBanner() {
  const q = useInbox();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const urgent = q.data?.messages.find((m) => m.priority === "urgent" && !m.readAt);
  if (!urgent) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-soft px-4 py-3">
      <div className="flex min-w-0 flex-[1_1_360px] items-start gap-3 text-[#6E3005]">
        <Megaphone aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px]">
            <b>Urgent · {urgent.subject}</b> · {urgent.fromName}
          </span>
          <span className="text-[13px]">{urgent.body}</span>
        </div>
      </div>
      <Button
        className="h-10"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await markReadAction(urgent.id, urgent.requireAck);
            if (!result.ok) toast.error(result.error);
            await queryClient.invalidateQueries({ queryKey: inboxKey });
          })
        }
      >
        {urgent.requireAck ? "Acknowledge" : "Mark as read"}
      </Button>
    </div>
  );
}
