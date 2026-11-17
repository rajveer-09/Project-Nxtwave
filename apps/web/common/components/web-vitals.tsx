/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useReportWebVitals } from "next/web-vitals";

/** Sends each page's real load and response timings to /api/vitals (production only). */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") return;
    const body = JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating, path: window.location.pathname });
    if (!navigator.sendBeacon?.("/api/vitals", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/vitals", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    }
  });
  return null;
}
