/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/common/lib/utils";

/**
 * A list shown a page at a time (five by default), with ‹ › to move between pages:
 *
 *   const pg = usePages(items);
 *   pg.items.map(…); <Pager {...pg} label="Interaction pages" />
 */
export function usePages<T>(all: T[], size = 5, onChange?: () => void) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(all.length / size));
  const current = Math.min(page, pages - 1);
  const from = current * size;
  return {
    items: all.slice(from, from + size),
    total: all.length,
    from,
    to: Math.min(from + size, all.length),
    current,
    pages,
    go: (p: number) => {
      setPage(Math.max(0, Math.min(pages - 1, p)));
      onChange?.();
    },
  };
}

type PagerProps = ReturnType<typeof usePages<unknown>> & { label: string; prevLabel?: string; nextLabel?: string; className?: string };

const arrow = "flex size-9 items-center justify-center rounded-lg border border-input bg-card hover:bg-muted disabled:pointer-events-none disabled:opacity-40";

/** "6–10 of 19  ‹ 2 / 4 ›". Nothing when everything fits on one page. */
export function Pager({ total, from, to, current, pages, go, label, prevLabel = "Previous page", nextLabel = "Next page", className }: PagerProps) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className={cn("flex items-center justify-end gap-2", className)}>
      <span className="mr-1 text-xs text-muted-foreground tabular" aria-live="polite">
        {from + 1}–{to} of {total}
      </span>
      <button type="button" onClick={() => go(current - 1)} disabled={current === 0} aria-label={prevLabel} className={arrow}>
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      <span className="min-w-14 text-center text-[13px] font-semibold tabular">
        {current + 1} / {pages}
      </span>
      <button type="button" onClick={() => go(current + 1)} disabled={current === pages - 1} aria-label={nextLabel} className={arrow}>
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}
