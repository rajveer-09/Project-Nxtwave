/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { useState } from "react";
import { Dropdown } from "@/common/components/dropdown";
import { SearchField } from "@/common/components/search-field";
import { searchMatcher } from "@/common/lib/search";

export type TopicLevel = { level: number; title: string; students: number; topics: { topic: string; count: number }[] };

/** Students on each topic right now: every level's topics, or one level's; searchable. */
export function TopicProgression({ levels }: { levels: TopicLevel[] }) {
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");
  const chosen = level === "all" ? null : levels.find((l) => String(l.level) === level) ?? null;
  const match = searchMatcher(query);
  const rows = (chosen ? [chosen] : levels)
    .flatMap((l) => l.topics.map((t) => ({ ...t, level: l.level })))
    .filter((t) => match(t.topic));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Dropdown
          aria-label="Show topics of"
          value={level}
          onValueChange={setLevel}
          options={[{ value: "all", label: "All topics" }, ...levels.map((l) => ({ value: String(l.level), label: `Level ${l.level} topics` }))]}
          className="w-36"
        />
        <SearchField label="Search topic" value={query} onChange={setQuery} className="min-w-40 flex-1" />
      </div>
      {chosen ? (
        <p className="flex justify-between border-b border-border pb-2 text-xs text-muted-foreground">
          <span>
            Students at Level {chosen.level} · {chosen.title}
          </span>
          <span className="font-semibold text-foreground tabular">{chosen.students}</span>
        </p>
      ) : null}
      <ul className="flex max-h-[22rem] flex-col overflow-y-auto pr-1 text-[13px]">
        {rows.length ? (
          rows.map((t) => (
            <li key={`${t.level}-${t.topic}`} className="flex items-center justify-between gap-3 border-b border-muted py-1.5 last:border-0">
              <span className="min-w-0 truncate">
                {chosen ? null : <span className="mr-1.5 text-xs text-muted-foreground">Level {t.level}</span>}
                {t.topic}
              </span>
              <span className={t.count ? "font-semibold tabular" : "text-muted-foreground/60 tabular"}>{t.count}</span>
            </li>
          ))
        ) : (
          <li className="py-2 text-muted-foreground">No topic matches.</li>
        )}
      </ul>
    </div>
  );
}
