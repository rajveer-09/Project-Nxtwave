/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";

type Hit = { niatId: string; name: string; college: string; section: string };
const NIAT = /^N\d{2}H\d{2}[AB]\d{4}$/i;

/**
 * The student box on Log interaction: type a name or NIAT ID and matching students show under it as
 * you type (GET /api/students/search). Arrow keys and Enter, or a click, open that student; a full
 * NIAT ID and Enter (or Find student) works as before. The list sits in the page flow under the box,
 * so the desktop zoom can't move it.
 */
export function StudentLookup({ initial = "", autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState(initial);
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  // Enter pressed before the results for what's typed arrived: open the best match once they do.
  const submitWhenReady = useRef(false);

  // Suggestions once typing pauses; a newer search cancels the one in flight.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const q = text.trim();
      if (!q) {
        setHits([]);
        setSearched("");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/students/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { students?: Hit[] };
        const found = res.ok ? (body.students ?? []) : [];
        setHits(found);
        setSearched(q);
        setActive(0);
        if (submitWhenReady.current) {
          submitWhenReady.current = false;
          if (found[0]) {
            setOpen(false);
            router.push(`/log-interaction?niat=${encodeURIComponent(found[0].niatId)}`);
          } else setOpen(true);
        }
      } catch {
        // aborted by newer typing, or offline: keep what's shown
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, router]);

  function go(niatId: string) {
    submitWhenReady.current = false;
    setOpen(false);
    router.push(`/log-interaction?niat=${encodeURIComponent(niatId.toUpperCase())}`);
  }

  function submit() {
    const q = text.trim();
    if (!q) return;
    if (NIAT.test(q)) return go(q);
    // The list on screen is for what's typed: open the highlighted student.
    if (searched === q) return hits[active] ? go(hits[active].niatId) : setOpen(true);
    // Results for the latest typing are still on their way.
    submitWhenReady.current = true;
    setOpen(true);
  }

  const q = text.trim();
  const stale = searched !== q;
  const showList = open && q.length > 0 && (hits.length > 0 || loading || !stale);
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5"
    >
      <div className="relative flex flex-[1_1_260px] flex-col gap-1">
        <label htmlFor={`${listId}-input`} className="text-xs font-medium text-muted-foreground">
          Student · name or NIAT ID
        </label>
        <span className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={`${listId}-input`}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && hits[active] ? optionId(active) : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => text.trim() && setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && hits.length) {
                e.preventDefault();
                setOpen(true);
                setActive((i) => (i + 1) % hits.length);
              } else if (e.key === "ArrowUp" && hits.length) {
                e.preventDefault();
                setOpen(true);
                setActive((i) => (i - 1 + hits.length) % hits.length);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            maxLength={60}
            placeholder="e.g. Aarav or N24H01A0031"
            className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        </span>
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching students"
            aria-busy={stale}
            className="absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {stale ? (
              <li role="presentation" className="px-3 py-1.5 text-xs text-muted-foreground">
                Searching…
              </li>
            ) : null}
            {hits.length ? (
              hits.map((h, i) => (
                <li
                  key={h.niatId}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  // Keep focus in the box so the click lands before it closes.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h.niatId)}
                  className={cn(
                    "flex cursor-pointer flex-wrap items-baseline justify-between gap-x-3 rounded-md px-3 py-2 text-sm",
                    i === active && "bg-accent text-accent-foreground",
                    stale && "opacity-60",
                  )}
                >
                  <span className="font-semibold">{h.name}</span>
                  <span className="text-xs text-muted-foreground tabular">
                    {h.niatId} · {h.college} · {h.section}
                  </span>
                </li>
              ))
            ) : stale ? null : (
              <li role="presentation" className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                No student matches “{q}”.
              </li>
            )}
          </ul>
        ) : null}
      </div>
      <Button type="submit" className="h-11 px-5">
        Find student
      </Button>
    </form>
  );
}
