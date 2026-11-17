/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/common/ui/chart";

const config = {
  score: { label: "Score", color: "var(--chart-1)" },
  classAvg: { label: "Class average", color: "#D5D8DF" },
} satisfies ChartConfig;

/** Student score vs class average per weekly test; bars below the pass mark turn orange. */
export function TestsChart({ data, passMark, max }: { data: { key: string; score: number; classAvg: number }[]; passMark: number; max: number }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-[190px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barGap={3}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="key" tickLine={false} axisLine={false} tickMargin={6} />
        <YAxis domain={[0, max]} tickLine={false} axisLine={false} ticks={[0, 10, 20, 30, 40, 50]} />
        <ReferenceLine y={passMark} stroke="var(--warning-strong)" strokeDasharray="4 4" label={{ value: "pass", position: "insideTopRight", fontSize: 11, fill: "var(--warning)" }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.score < passMark ? "var(--warning-strong)" : "var(--chart-1)"} />
          ))}
        </Bar>
        <Bar dataKey="classAvg" fill="var(--color-classAvg)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
