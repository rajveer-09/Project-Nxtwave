"use client";

import { CircleCheck, Info } from "lucide-react";
import { useState } from "react";
import { RISK_THRESHOLDS, type FlagKey, type FlagWithDetail } from "@/common/domain/risk";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/common/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/common/ui/tooltip";
import { cn } from "@/common/lib/utils";

/** Display order only (most urgent first); which flags a student has comes from common/domain/risk.ts. */
const ORDER: FlagKey[] = ["attendance", "tests", "interaction", "level", "contests"];

/** How many dots a row shows; the rest are counted in "+N". */
const VISIBLE = 2;

/** One solid colour per flag, the same in light and dark theme. */
const DOT: Record<FlagKey, string> = {
  attendance: "bg-[#DC2626]",
  tests: "bg-[#9333EA]",
  interaction: "bg-[#F59E0B]",
  level: "bg-[#2563EB]",
  contests: "bg-[#64748B]",
};

const T = RISK_THRESHOLDS;

/** What each flag is called (popover, legend, screen-reader label). */
const TITLE: Record<FlagKey, string> = {
  attendance: `DSA attendance below ${T.attendancePct}%`,
  tests: "Below pass in tests",
  interaction: `No interaction for ${T.interactionGapDays}+ days`,
  level: "Stuck on level",
  contests: "Missed contests",
};

/** The rule behind each flag, for the legend (thresholds from common/domain/risk.ts). */
const RULE: Record<FlagKey, string> = {
  attendance: `Under ${T.attendancePct}% over the last 30 days`,
  tests: `Below pass in ${T.testsBelowPassOutOfLast3}+ of the last 3 weekly tests`,
  interaction: `No logged interaction in ${T.interactionGapDays}+ days`,
  level: `${T.weeksAtLevel}+ weeks at the same level`,
  contests: `Missed ${T.missedContestsInARow}+ contests in a row`,
};

function Dot({ flag, className }: { flag: FlagKey; className?: string }) {
  return <span aria-hidden="true" className={cn("block size-2.5 shrink-0 rounded-full", DOT[flag], className)} />;
}

/** The compact row display: up to two dots, then "+N". */
function Summary({ ordered }: { ordered: FlagWithDetail[] }) {
  const more = ordered.length - VISIBLE;
  return (
    <span aria-hidden="true" className="flex items-center gap-2 whitespace-nowrap">
      {ordered.slice(0, VISIBLE).map((f) => (
        <Dot key={f.key} flag={f.key} />
      ))}
      {more > 0 ? <span className="text-xs font-semibold text-muted-foreground tabular">+{more}</span> : null}
    </span>
  );
}

/**
 * A student's at-risk flags in a table cell: at most two coloured dots (most urgent first) and
 * "+N" for the rest, on one line so rows keep the same height; a green check when there are none.
 *
 * The whole cell is the trigger: put this in a `relative` cell and pass that cell's padding as
 * `className` (e.g. "px-3"). Hover anywhere in the cell, Tab onto it, or click/tap it to see every
 * flag with the student's own numbers in one card. It's a tooltip (styled like a popover), not a
 * popover: the card has nothing to focus, and a popover would hold Tab on the cell.
 */
export function StudentFlags({ flags, name, className }: { flags: FlagWithDetail[]; name?: string; className?: string }) {
  const [open, setOpen] = useState(false);

  if (!flags.length) {
    return (
      <span className="inline-grid size-5 place-items-center align-middle">
        <CircleCheck aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
        <span className="sr-only">On track, no flags</span>
      </span>
    );
  }

  const ordered = [...flags].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  const count = `${ordered.length} attention flag${ordered.length === 1 ? "" : "s"}`;

  return (
    <>
      {/* Invisible copy in the normal flow, so the column is as wide as the dots need. */}
      <span className="invisible block">
        <Summary ordered={ordered} />
      </span>
      <Tooltip
        open={open}
        // Hover and keyboard focus open/close it as usual; a click or tap opens it (below), so
        // don't let that same click close it again.
        onOpenChange={(next, details) => {
          if (!next && details.reason === "trigger-press") return;
          setOpen(next);
        }}
      >
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`${count}${name ? ` for ${name}` : ""}: ${ordered.map((f) => `${TITLE[f.key]} (${f.detail})`).join("; ")}`}
              className={cn(
                "absolute inset-0 flex cursor-pointer items-center outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset data-popup-open:bg-muted/60",
                className,
              )}
            />
          }
        >
          <Summary ordered={ordered} />
        </TooltipTrigger>
        <TooltipContent
          showArrow={false}
          side="bottom"
          align="start"
          sideOffset={6}
          className="block w-80 max-w-[calc(100vw-2rem)] rounded-lg bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          <p className="text-[13px] font-semibold text-foreground">
            Student attention flags · {ordered.length}
            {name ? <span className="block text-xs font-normal text-muted-foreground">{name}</span> : null}
          </p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {ordered.map((f) => (
              <li key={f.key} className="flex items-start gap-2.5 text-[13px]">
                <Dot flag={f.key} className="mt-1" />
                <span>
                  <span className="font-semibold text-foreground">{TITLE[f.key]}</span>
                  <span className="text-muted-foreground"> — {f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

/** Info icon for the Flags column header: hover, click or keyboard shows what each dot colour means. */
export function FlagLegend() {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={100}
        aria-label="What the flag colours mean"
        className="inline-grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:text-foreground"
      >
        <Info aria-hidden="true" className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="font-normal normal-case">
        <PopoverTitle>Flag colours</PopoverTitle>
        <ul className="mt-2.5 flex flex-col gap-2.5">
          {ORDER.map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-[13px]">
              <Dot flag={key} className="mt-1" />
              <span>
                <span className="block font-semibold text-foreground">{TITLE[key]}</span>
                <span className="block text-xs text-muted-foreground">{RULE[key]}</span>
              </span>
            </li>
          ))}
          <li className="flex items-start gap-2.5 text-[13px]">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-foreground">On track, no flags</span>
          </li>
        </ul>
        <p className="mt-2.5 text-xs text-muted-foreground">A row shows up to two dots; +N counts the rest. Hover a row&apos;s flags to see them all.</p>
      </PopoverContent>
    </Popover>
  );
}
