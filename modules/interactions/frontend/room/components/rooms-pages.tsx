/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use client";

import { Code2 } from "lucide-react";
import { Pager, usePages } from "@/common/components/pager";
import { roomName } from "@nxtone/interactions-ui/room/lib/types";

export type RoomRow = { id: string; createdAt: string; createdBy: string; closedAt: string | null; interactionId: string | null };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** A student's code rooms, five a page with ‹ › (RoomsList loads them). */
export function RoomsPages({ rooms, title }: { rooms: RoomRow[]; title: string }) {
  const pg = usePages(rooms);
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-[13px] text-muted-foreground">Code written live during interactions</span>
      </div>
      <ul className="flex flex-col px-5 pb-2">
        {pg.items.map((r, i) => (
          <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px] ${i ? "border-t border-muted" : ""}`}>
            <span className="flex items-center gap-2">
              <Code2 aria-hidden="true" className="size-4 text-muted-foreground" />
              <span>
                <span className="font-medium">{roomName(r.createdAt)}</span> · {time(r.createdAt)} · {r.createdBy}
              </span>
              {r.closedAt ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{r.interactionId ? "Saved with interaction" : "Ended"}</span>
              ) : (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">Open</span>
              )}
            </span>
            {/* The room opens in a new tab, so this page stays where it was. */}
            <a href={`/room/${r.id}`} target="_blank" rel="noopener" className="font-semibold text-primary hover:text-accent-strong">
              {r.closedAt ? "View code →" : "Open room →"}
            </a>
          </li>
        ))}
      </ul>
      <Pager {...pg} label="Code room pages" prevLabel="Newer rooms" nextLabel="Older rooms" className="px-5 pb-4" />
      {pg.pages <= 1 ? <div className="pb-2" /> : null}
    </section>
  );
}
