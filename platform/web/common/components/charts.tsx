/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/common/ui/chart";

/**
 * Two small chart forms used across NxtOne. Single series each (the card title names it, so no
 * legend), thin marks with rounded data ends, recessive grid, one axis, a hover tooltip on every
 * point. Colours come from the chart tokens (--chart-1), checked for light and dark surfaces.
 */
export type Point = { day: string; label: string; value: number | null };

/** Counts per day (e.g. interactions logged). */
export function DailyBars({ data, valueLabel, height = 220 }: { data: Point[]; valueLabel: string; height?: number }) {
  const config = { value: { label: valueLabel, color: "var(--chart-1)" } } satisfies ChartConfig;
  const many = data.length > 45;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap={many ? 1 : 3}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={18} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}

export type PresentAbsentPoint = { day: string; label: string; present: number; absent: number };

/**
 * DSA attendance per day as counts: present and absent stacked in one bar per day (present at the
 * base), with a legend and a tooltip. Days nobody was marked (days off) are empty.
 */
export function PresentAbsentBars({ data, height = 240 }: { data: PresentAbsentPoint[]; height?: number }) {
  const config = {
    present: { label: "Present", color: "var(--chart-1)" },
    absent: { label: "Absent", color: "var(--chart-3)" },
  } satisfies ChartConfig;
  const many = data.length > 45;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={many ? 1 : 3}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={18} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="present" stackId="day" fill="var(--color-present)" stroke="var(--card)" strokeWidth={1} maxBarSize={28} />
        <Bar dataKey="absent" stackId="day" fill="var(--color-absent)" stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}

/** Any number over time (e.g. a LeetCode rating), the axis fitted to the values. */
export function ValueLine({ data, valueLabel, height = 220 }: { data: Point[]; valueLabel: string; height?: number }) {
  const config = { value: { label: valueLabel, color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={18} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} domain={["dataMin - 20", "dataMax + 20"]} />
        <ChartTooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={<ChartTooltipContent indicator="line" />} />
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "var(--color-value)" }} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
      </LineChart>
    </ChartContainer>
  );
}

/** A percentage over time (e.g. attendance); days with nothing to measure are gaps, not zeros. */
export function TrendLine({ data, valueLabel, target, height = 220 }: { data: Point[]; valueLabel: string; target?: number; height?: number }) {
  const config = { value: { label: valueLabel, color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={18} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={44} tickFormatter={(v) => `${v}%`} />
        {target !== undefined ? (
          <ReferenceLine y={target} stroke="var(--warning-strong)" strokeDasharray="4 4" label={{ value: `${target}%`, position: "insideTopRight", fontSize: 11, fill: "var(--warning)" }} />
        ) : null}
        <ChartTooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={<ChartTooltipContent indicator="line" formatter={(v) => `${v}%`} />} />
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} connectNulls={false} />
      </LineChart>
    </ChartContainer>
  );
}
