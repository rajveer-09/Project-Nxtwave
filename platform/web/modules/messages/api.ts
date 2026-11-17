/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { apiFetch } from "@/common/lib/api-client";
import type { InboxItem, SentItem } from "./data";

/**
 * Polling intervals. A realtime channel (Ably/Pusher, ARCHITECTURE §4.6) will push
 * changes instead; these stay as the fallback when it disconnects.
 */
export const INBOX_POLL_MS = 15_000;
export const SENT_POLL_MS = 5_000;

export const messagesApi = {
  inbox: () => apiFetch<{ messages: InboxItem[]; unread: number }>("/api/messages/inbox"),
  sent: () => apiFetch<{ sent: SentItem[] }>("/api/messages/sent"),
};

export const inboxKey = ["messages", "inbox"] as const;
export const sentKey = ["messages", "sent"] as const;

export const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
