/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * College / section / hall filters kept in the URL query string, so links and the
 * back button preserve them (UI plan §3). Options are static until the core roster
 * API exists; they will come from /api/core/filters.
 */
const FILTERS = [
  { key: "college", label: "College", all: "All colleges", options: ["BITS", "CDU"] },
  { key: "section", label: "Section", all: "All sections", options: ["S001", "S004", "S009", "IB-2", "IB-4"] },
  { key: "hall", label: "Hall", all: "All halls", options: ["Hall 1", "Hall 3", "Hall 7", "Hall 11", "Hall 12"] },
] as const;

export function GlobalFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-end gap-2.5" aria-busy={pending}>
      {FILTERS.map((filter) => (
        <label key={filter.key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {filter.label}
          <select
            value={params.get(filter.key) ?? ""}
            onChange={(event) => update(filter.key, event.target.value)}
            className="h-10 min-w-32 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">{filter.all}</option>
            {filter.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export function GlobalFiltersFallback() {
  return (
    <div className="flex flex-wrap items-end gap-2.5" aria-hidden="true">
      {FILTERS.map((filter) => (
        <div key={filter.key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {filter.label}
          <div className="h-10 w-32 rounded-lg border border-input bg-card" />
        </div>
      ))}
    </div>
  );
}
