/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/common/lib/utils";
import type { ContestPage, ContestStatus, WorkerStatus } from "@nxtone/contest-ui/types";

/**
 * Scan progress, as NxtRank showed it: the scan running now (percent, pages read, ready-by time),
 * the queue behind it, and a compact line per contest. The pages poll every few seconds while
 * something is queued or running.
 */

const titleOf = (slug: string) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const day = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** The current time, refreshed every 30 s (for "in 8 min"). */
function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(value * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${Math.max(percent, 2)}%` }} />
    </div>
  );
}

/** "Ready 10:42 pm · in 8 min", or a pulsing dot when it's due any moment. */
export function Eta({ iso, label = "Ready" }: { iso: string; label?: string }) {
  const now = useNow();
  const t = new Date(iso);
  const mins = Math.round((t.getTime() - now) / 60_000);
  const soon = mins <= 1;
  const rel = soon ? "finishing up" : mins < 60 ? `in ${mins} min` : mins < 24 * 60 ? `in ${Math.round(mins / 60)} hr` : day.format(t);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap" title={`${label} by ${t.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`}>
      {soon ? <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-primary" /> : null}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular">{time.format(t)}</span>
      <span className="text-muted-foreground">· {rel}</span>
    </span>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** One contest's scan, compact: a progress bar while scanning, its place while queued. */
export function ScanLine({ status, worker }: { status: ContestStatus; worker?: WorkerStatus }) {
  if (status.state === "scanning") {
    return (
      <div className="flex min-w-40 flex-col gap-1">
        <ProgressBar value={status.progress ?? 0} label="Scan progress" />
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-xs font-semibold tabular">{pct(status.progress ?? 0)}</span>
          {status.ready_at ? <Eta iso={status.ready_at} /> : null}
        </div>
      </div>
    );
  }
  if (status.state === "queued") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular">#{status.position ?? 1} in queue</span>
        {worker && !worker.alive ? <span className="text-xs text-muted-foreground">starts when the scanner is online</span> : status.ready_at ? <Eta iso={status.ready_at} /> : null}
      </div>
    );
  }
  if ((status.state === "scheduled" || status.state === "upcoming" || status.state === "live") && status.ready_at) {
    return <Eta iso={status.ready_at} label="Results" />;
  }
  if (status.state === "failed" && status.error) {
    return (
      <span className="line-clamp-2 max-w-xs text-xs text-muted-foreground" title={status.error}>
        {status.error}
      </span>
    );
  }
  return null;
}

/** "Scanning now" and the queue, above the contests list. Nothing when the scanner is idle. */
export function ScanActivity({ data }: { data: Pick<ContestPage, "worker" | "running" | "queue"> }) {
  const r = data.running;
  if (!r && !data.queue.length) return null;
  return (
    <section aria-label="Scan activity" className="overflow-hidden rounded-xl border border-border bg-card">
      {!data.worker.alive ? (
        <p className="border-b border-warning-border bg-warning-soft px-5 py-2.5 text-[13px] text-[#6E3005] dark:text-[#F5B98A]">
          The scanner is offline, so queued scans start once it&apos;s running again on the scanning laptop.
        </p>
      ) : null}
      {r ? (
        <div className="grid items-center gap-x-8 gap-y-3 px-5 py-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
              <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-primary" />
              {r.cancel_requested ? "Stopping" : "Scanning now"}
            </div>
            <Link href={`/contests/${r.slug}`} className="mt-1 block truncate text-[15px] font-semibold hover:text-primary">
              {titleOf(r.slug)}
            </Link>
            <div className="text-xs text-muted-foreground">
              {r.kind === "final" ? "Final results" : "Early results"}
              {r.requested_by ? ` · requested by ${r.requested_by}` : " · automatic"}
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="text-base font-semibold tabular">{pct(r.progress)}</span>
              {r.pages_total ? (
                <span className="text-muted-foreground tabular">
                  {r.pages_done.toLocaleString("en-IN")} / {r.pages_total.toLocaleString("en-IN")} pages
                </span>
              ) : null}
            </div>
            <ProgressBar value={r.progress} label={`Scanning ${titleOf(r.slug)}`} />
          </div>
          <div className="md:text-right">{r.ready_at ? <Eta iso={r.ready_at} /> : <span className="text-xs text-muted-foreground">Working out the time…</span>}</div>
        </div>
      ) : null}
      {data.queue.length ? (
        <div className={cn("flex flex-wrap items-center gap-2 px-5 py-3", r && "border-t border-border")}>
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Queued</span>
          {data.queue.map((q) => (
            <Link
              key={q.slug}
              href={`/contests/${q.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs hover:border-input"
            >
              <span className="text-muted-foreground tabular">#{q.position}</span>
              <span className="font-medium">{titleOf(q.slug)}</span>
              {q.ready_at ? <Eta iso={q.ready_at} /> : <span className="text-muted-foreground">waiting</span>}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Contest page: where this contest's scan stands, with the pages read while it runs. */
export function ContestScanPanel({ status, scan }: { status: ContestStatus; scan?: Pick<ContestPage, "worker" | "running" | "queue"> }) {
  const r = scan?.running && status.state === "scanning" ? scan.running : null;
  const progress = r?.progress ?? status.progress ?? 0;
  return (
    <section aria-label="Scan in progress" role="status" className="flex flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 text-[13px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold">
          <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-primary" />
          {status.state === "scanning"
            ? status.cancel_requested
              ? "Stopping the scan…"
              : `Scanning LeetCode · ${pct(progress)}`
            : status.position && status.position > 1
              ? `Queued · ${status.position - 1} scan${status.position === 2 ? "" : "s"} ahead`
              : "Queued · starts next"}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 text-muted-foreground">
          {r?.pages_total ? (
            <span className="tabular">
              {r.pages_done.toLocaleString("en-IN")} / {r.pages_total.toLocaleString("en-IN")} pages
            </span>
          ) : null}
          {scan && !scan.worker.alive ? <span>Waiting for the scanner to come online</span> : status.ready_at ? <Eta iso={status.ready_at} /> : null}
        </span>
      </div>
      {status.state === "scanning" ? <ProgressBar value={progress} label="Scan progress" /> : null}
      <p className="text-xs text-muted-foreground">
        {status.requested_by ? `Requested by ${status.requested_by}. The new results wait for an admin's review before they replace these.` : "Scanned automatically. This page updates by itself."}
      </p>
    </section>
  );
}
