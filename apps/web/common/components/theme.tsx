/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/common/lib/utils";

/**
 * Light, dark or the device's setting. The choice is kept in the browser and applied before the
 * page paints (no flash). Switching crossfades the whole page in about 0.2 s (styles in globals.css);
 * with reduced motion, or without View Transitions support, it switches instantly.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="nxtone-theme">
      {children}
    </NextThemes>
  );
}

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Applies a theme with a short crossfade (View Transitions), or instantly with reduced motion or
 * without support. The class is set inside the transition so the "after" snapshot is already right.
 */
export function switchTheme(next: string, setTheme: (theme: string) => void) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
  if (reduce || !start) return setTheme(next);
  const root = document.documentElement;
  root.setAttribute("data-theme-switch", "");
  const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const transition = start.call(document, () => {
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    root.style.colorScheme = dark ? "dark" : "light";
    flushSync(() => setTheme(next));
  }) as { finished?: Promise<void> };
  void transition.finished?.finally(() => root.removeAttribute("data-theme-switch"));
}

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // The stored choice is only known in the browser; until then nothing is shown as selected.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- runs once, after hydration
  useEffect(() => setMounted(true), []);

  function choose(next: string) {
    if (next !== theme) switchTheme(next, setTheme);
  }

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => choose(value)}
            className={cn(
              "flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors",
              selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              compact ? "w-8 px-0" : "",
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
            {compact ? null : label}
          </button>
        );
      })}
    </div>
  );
}
