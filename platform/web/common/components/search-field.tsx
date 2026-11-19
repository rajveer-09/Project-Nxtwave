/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { Search } from "lucide-react";
import { cn } from "@/common/lib/utils";

/** Small search box that filters a list on this page (nothing goes in the URL). */
export function SearchField({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
        className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-8 text-[13px] text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
    </label>
  );
}

export const selectClass =
  "h-9 rounded-lg border border-input bg-card px-2.5 text-[13px] text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
