/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { Check, Code2, Copy, ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { startCodeRoom } from "@nxtone/interactions-ui/room/actions";
import { Button } from "@/common/ui/button";

/**
 * In the interaction form: start a live code room for the student, share its link, open it in a
 * new tab. When the interaction is saved, the room is attached to it and ends.
 */
export function RoomPanel({ niatId, studentName, roomId, onRoom }: { niatId: string; studentName: string; roomId: string; onRoom: (id: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? `/room/${roomId}` : `${window.location.origin}/room/${roomId}`;

  if (!roomId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-3.5 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Code2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col text-[13px]">
            <span className="font-semibold">Live code room</span>
            <span className="text-muted-foreground">Share a link: {studentName.split(" ")[0]} writes code there and you see it as they type.</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await startCodeRoom(niatId);
              if (!result.ok) return setError(result.error);
              onRoom(result.id);
              window.open(`/room/${result.id}`, "_blank", "noopener");
            })
          }
        >
          {pending ? "Starting…" : "Start code room"}
        </Button>
        {error ? (
          <p role="alert" className="w-full text-[13px] font-medium text-warning">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-accent-border bg-accent px-3.5 py-3 text-accent-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          Code room is open
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 gap-1.5 bg-card text-foreground"
            onClick={async () => {
              await navigator.clipboard.writeText(link).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <a
            href={`/room/${roomId}`}
            target="_blank"
            rel="noopener"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
          >
            Open room
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </div>
      <p className="text-xs">
        Send the link to {studentName.split(" ")[0]} (they sign in with their NIAT ID), or they can join from their NxtOne page. The code saves automatically and is
        kept with this interaction when you save it.
      </p>
      <p className="truncate font-mono text-xs opacity-80">{link}</p>
    </div>
  );
}
