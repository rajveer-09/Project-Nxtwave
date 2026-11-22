/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

"use client";

import { Eye, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";

/*
 * "View as" controls (app/api/view-as, common/auth/session.ts, common/auth/student/session.ts).
 * Starting or ending it reloads the whole app, so nothing loaded for one person is shown to another.
 */

function reload(to: string) {
  // A full reload on purpose: nothing cached for one person (router, lists) may show for the other.
  window.location.assign(to);
}

/** Starts viewing NxtOne as a staff member (`staffId`) or a student (`niatId`), read-only. */
export function ViewAsButton({
  staffId,
  niatId,
  name,
  label = "View as",
  variant = "ghost",
  className,
}: {
  staffId?: string;
  niatId?: string;
  name: string;
  label?: string;
  variant?: "ghost" | "outline";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      size="sm"
      className={cn("gap-1.5", className)}
      disabled={busy}
      title={`See NxtOne as ${name} sees it (read-only)`}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/view-as", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(niatId ? { niatId } : { staffId }),
        }).catch(() => null);
        const body = (await res?.json().catch(() => ({}))) as { error?: string; to?: string };
        if (res?.ok) return reload(body.to ?? "/");
        toast.error(body?.error ?? "Couldn't start view as. Try again.");
        setBusy(false);
      }}
    >
      <Eye aria-hidden="true" className="size-3.5" />
      {label}
    </Button>
  );
}

/** Shown on every page while viewing as someone: who, that it's read-only, and the way back. */
export function ViewAsBanner({ name, role, by, backTo, className }: { name: string; role: string; by: string; backTo: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  async function exit() {
    setBusy(true);
    await fetch("/api/view-as", { method: "DELETE" }).catch(() => null);
    reload(backTo);
  }
  return (
    <div
      role="status"
      className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-warning-border bg-warning-soft px-4 py-2.5 text-[13px] text-warning sm:px-8", className)}
    >
      <span className="flex items-center gap-2">
        <Eye aria-hidden="true" className="size-4 shrink-0" />
        <span>
          Viewing as <b>{name}</b> · {role}. Read-only: nothing can be saved. You&apos;re signed in as {by}.
        </span>
      </span>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-card text-foreground" disabled={busy} onClick={exit}>
        <LogOut aria-hidden="true" className="size-3.5" />
        Back to my view
      </Button>
    </div>
  );
}
