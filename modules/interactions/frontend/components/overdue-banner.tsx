"use client";

import { ChevronDown, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useId, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/common/ui/tooltip";
import { cn } from "@/common/lib/utils";
import { OVERDUE_COOKIE } from "../lib/overdue-cookie";

/*
 * The overdue reminder on /interactions, in two parts that share one open/closed state:
 *   OverduePill    the "N of my students overdue" pill in the page header, a button that shows/hides the list
 *   OverdueBanner  the row of overdue students below the header, with its own Hide button
 * Wrap both in <OverdueReminder>. It starts open after each sign-in (see lib/overdue-cookie.ts).
 */

export type OverdueStudent = { niatId: string; name: string; days: number | null };

type State = { open: boolean; toggle: () => void; hide: () => void; bannerId: string };
const Ctx = createContext<State | null>(null);

function useReminder() {
  const state = useContext(Ctx);
  if (!state) throw new Error("OverduePill and OverdueBanner go inside <OverdueReminder>.");
  return state;
}

function remember(value: string) {
  document.cookie = `${OVERDUE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function OverdueReminder({
  count,
  initialOpen,
  seen,
  children,
}: {
  count: number;
  initialOpen: boolean;
  /** Overdue count when it was hidden (null: not hidden since sign-in). */
  seen: number | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  const bannerId = useId();

  // While hidden, measure a later rise from what they last saw (fewer overdue now than when hidden).
  useEffect(() => {
    if (!open && seen !== null && count < seen) remember(`hidden:${count}`);
  }, [open, seen, count]);

  function set(next: boolean) {
    setOpen(next);
    remember(next ? "open" : `hidden:${count}`);
  }

  return <Ctx.Provider value={{ open, toggle: () => set(!open), hide: () => set(false), bannerId }}>{children}</Ctx.Provider>;
}

/** The header pill, as a button: shows or hides the list of overdue students. */
export function OverduePill({ children }: { children: React.ReactNode }) {
  const { open, toggle, bannerId } = useReminder();
  const hint = open ? "Hide overdue students" : "Show overdue students";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={bannerId}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold whitespace-nowrap text-warning ring-1 ring-warning-border hover:brightness-125 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        {children}
        <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/** The overdue students, below the header; hidden entirely until the pill opens it again. */
export function OverdueBanner({ students }: { students: OverdueStudent[] }) {
  const { open, hide, bannerId } = useReminder();
  if (!open) return <div id={bannerId} hidden />;
  return (
    <nav
      id={bannerId}
      aria-label="Overdue students"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-[13px]"
    >
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-warning" />
      <span className="font-semibold text-warning">Overdue:</span>
      {students.map((s) => (
        <Link
          key={s.niatId}
          href={`/interactions?student=${s.niatId}`}
          className="flex min-h-8 items-center rounded-full bg-card px-3 font-semibold text-foreground hover:bg-muted"
        >
          {s.name} · {s.days === null ? "never" : `${s.days}d`}
        </Link>
      ))}
      <button
        type="button"
        onClick={hide}
        className="ml-auto flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-foreground hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        Hide
        <ChevronDown aria-hidden="true" className="size-3.5 rotate-180" />
      </button>
    </nav>
  );
}
