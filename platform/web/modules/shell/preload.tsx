/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { addDays, todayIst } from "@/common/lib/dates";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import { contestApi } from "@nxtone/contest-ui/api";

/**
 * Loads the data the Attendance and Contests pages read in the browser, once the current page
 * has finished and the browser is idle, so those pages open with their data already there.
 * Same query keys as the pages, so they simply find it in the cache. Runs once per visit.
 */
let started = false;

export function Preload() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (started) return;
    started = true;
    const today = todayIst();
    const run = async () => {
      const opts = { staleTime: 60_000 };
      const halls = await queryClient.fetchQuery({ queryKey: ["attendance", "halls"], queryFn: attendanceApi.halls, ...opts }).catch(() => null);
      const firstHall = halls?.halls[0]?.hall;
      await Promise.allSettled([
        firstHall !== undefined
          ? queryClient.prefetchQuery({ queryKey: ["attendance", "sheet", today, firstHall], queryFn: () => attendanceApi.sheet(today, firstHall), ...opts })
          : null,
        queryClient.prefetchQuery({ queryKey: ["attendance", "calendar", today.slice(0, 7), "ALL"], queryFn: () => attendanceApi.calendar(today.slice(0, 7), "ALL"), ...opts }),
        queryClient.prefetchQuery({ queryKey: ["attendance", "terms"], queryFn: attendanceApi.terms, ...opts }),
        queryClient.prefetchQuery({
          queryKey: ["attendance", "internships", today],
          queryFn: () => attendanceApi.internships(addDays(today, -60), addDays(today, 60)),
          ...opts,
        }),
        queryClient.prefetchQuery({ queryKey: ["contests", "list", "", ""], queryFn: () => contestApi.list({ type: "", q: "" }), ...opts }),
      ]);
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => void run(), { timeout: 2500 });
    else setTimeout(() => void run(), 800);
  }, [queryClient]);
  return null;
}
