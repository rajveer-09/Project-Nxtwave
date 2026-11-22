/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { Code2 } from "lucide-react";
import { useEffect, useState } from "react";

type Open = { id: string; createdBy: string };

/**
 * Student's page: shows "Join" as soon as an instructor opens a code room for them (checks every
 * few seconds while the page is visible), so they don't need the link.
 */
export function JoinBanner({ initial }: { initial: Open[] }) {
  const [open, setOpen] = useState(initial);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!document.hidden) {
        try {
          const res = await fetch("/api/rooms/open", { cache: "no-store" });
          if (res.ok && !stop) setOpen(((await res.json()) as { rooms: Open[] }).rooms);
        } catch {
          // offline: try again next time
        }
      }
      if (!stop) timer = setTimeout(poll, 30_000);
    };
    timer = setTimeout(poll, 30_000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  if (!open.length) return null;
  const room = open[0];
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-border bg-accent px-4 py-3.5 text-accent-foreground">
      <span className="flex items-center gap-2.5 text-sm">
        <Code2 aria-hidden="true" className="size-5" />
        <span>
          <b>{room.createdBy}</b> opened a code room for you.
        </span>
      </span>
      <a
        href={`/room/${room.id}`}
        target="_blank"
        rel="noopener"
        className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Join code room
      </a>
    </div>
  );
}
