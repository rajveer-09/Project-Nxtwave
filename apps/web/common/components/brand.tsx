/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import Image from "next/image";
import { cn } from "@/common/lib/utils";

/**
 * The NxtOne lockup: the NxtWave logo, a thin divider and the product name. Nothing else
 * goes in the logo (no module names). The logo file is served by the app itself
 * (public/brand/nxtwave.svg), so it never waits on another server.
 */
export function Brand({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const h = size === "lg" ? 40 : size === "md" ? 30 : 24;
  return (
    <span className={cn("inline-flex items-center", size === "lg" ? "gap-4" : "gap-3", className)}>
      <Image src="/brand/nxtwave.svg" alt="NxtWave" width={Math.round((h * 105) / 61)} height={h} priority unoptimized />
      <span aria-hidden="true" className={cn("w-px bg-border", size === "lg" ? "h-8" : "h-6")} />
      <span
        className={cn(
          "font-heading font-semibold tracking-tight text-[#002A4B]",
          size === "lg" ? "text-[26px]" : size === "md" ? "text-[19px]" : "text-base",
        )}
      >
        NxtOne
      </span>
    </span>
  );
}
