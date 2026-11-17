/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { cn } from "@/common/lib/utils";

/**
 * A filter form that applies itself: results update as you type (after a short pause) or as soon
 * as you pick a dropdown or date. The fields become the page's URL, so filters can be shared and
 * survive a refresh. Empty fields are left out; changing a filter goes back to page 1.
 */
export function LiveForm({ children, className, ...rest }: Omit<React.ComponentProps<"form">, "onSubmit" | "onInput">) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function apply(form: HTMLFormElement, delay: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = new URLSearchParams();
      for (const [key, value] of new FormData(form)) {
        if (typeof value === "string" && value.trim()) query.set(key, value.trim());
      }
      const href = query.size ? `${pathname}?${query}` : pathname;
      startTransition(() => router.replace(href, { scroll: false }));
    }, delay);
  }

  return (
    <form
      {...rest}
      role="search"
      aria-busy={pending}
      className={cn("transition-opacity", pending && "opacity-80", className)}
      onInput={(e) => {
        const target = e.target as HTMLInputElement;
        const typing = target.tagName === "INPUT" && (target.type === "search" || target.type === "text");
        apply(e.currentTarget, typing ? 300 : 0);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget, 0);
      }}
    >
      {children}
    </form>
  );
}
