/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

/**
 * Real-user speed (Core Web Vitals) sent by common/components/web-vitals.tsx. Written as one JSON
 * line per measurement to the server log, so the hosting provider's log search can chart it.
 * Only the metric, its value and the page path are kept: nothing about the person.
 */
const METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { name?: unknown; value?: unknown; rating?: unknown; path?: unknown } | null;
  if (!body || typeof body.name !== "string" || !METRICS.has(body.name) || typeof body.value !== "number" || !Number.isFinite(body.value)) {
    return new Response(null, { status: 204 });
  }
  const path = typeof body.path === "string" ? body.path.replace(/N\d{2}H\d{2}[AB]\d{4}/gi, ":niatId").slice(0, 120) : "";
  console.info(JSON.stringify({ type: "web-vital", name: body.name, value: Math.round(body.value * 1000) / 1000, rating: String(body.rating ?? ""), path }));
  return new Response(null, { status: 204 });
}
