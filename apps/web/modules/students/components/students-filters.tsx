/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { withParams } from "@/common/lib/url";

type Options = { sections: string[]; halls: string[]; instructors: string[] };

const selectClass =
  "h-10 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** Search box (debounced) and dropdown filters, all stored in the URL. */
export function StudentsFilters({ options }: { options: Options }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function go(changes: Record<string, string | null>) {
    startTransition(() => router.replace(withParams(pathname, params, changes), { scroll: false }));
  }

  function onSearch(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go({ q: value.trim() || null }), 300);
  }

  const selects: { key: string; label: string; all: string; values: { value: string; label: string }[] }[] = [
    { key: "college", label: "College", all: "All", values: ["BITS", "CDU"].map((v) => ({ value: v, label: v })) },
    { key: "section", label: "Section", all: "All", values: options.sections.map((v) => ({ value: v, label: v })) },
    { key: "hall", label: "Hall", all: "All", values: options.halls.map((v) => ({ value: v, label: v })) },
    { key: "instructor", label: "Instructor", all: "All", values: options.instructors.map((v) => ({ value: v, label: v })) },
    { key: "level", label: "Level", all: "All", values: [0, 1, 2, 3, 4].map((v) => ({ value: String(v), label: `L${v}` })) },
  ];

  return (
    <div className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5" aria-busy={pending}>
      <label className="flex min-w-60 flex-[1_1_260px] flex-col gap-1 text-xs font-medium text-muted-foreground">
        Search name or NIAT ID
        <span className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="e.g. Mehta or N99H01A0142"
            className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        </span>
      </label>
      {selects.map((select) => (
        <label key={select.key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {select.label}
          <select
            value={params.get(select.key) ?? ""}
            onChange={(event) => go({ [select.key]: event.target.value || null })}
            className={selectClass}
          >
            <option value="">{select.all}</option>
            {select.values.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export function StudentsFiltersFallback() {
  return <div className="h-[78px] rounded-xl border border-border bg-card" aria-hidden="true" />;
}
