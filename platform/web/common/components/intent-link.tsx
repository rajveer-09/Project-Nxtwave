/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

/**
 * A link that loads its page (with the data) as soon as the pointer rests on it, a finger touches
 * it or it gets keyboard focus, so the click shows the page at once. Used for lists of students
 * and contests, where pre-loading every row up front would be too much.
 */
export function IntentLink({
  href,
  onIntent,
  ...props
}: React.ComponentProps<typeof Link> & { href: string; onIntent?: () => void }) {
  const router = useRouter();
  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = () => {
    if (done.current) return;
    done.current = true;
    router.prefetch(href);
    onIntent?.();
  };
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onMouseEnter={(e) => {
        // A short pause, so sweeping the pointer across a list doesn't load every row.
        timer.current = setTimeout(load, 60);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (timer.current) clearTimeout(timer.current);
        props.onMouseLeave?.(e);
      }}
      onTouchStart={(e) => {
        load();
        props.onTouchStart?.(e);
      }}
      onFocus={(e) => {
        load();
        props.onFocus?.(e);
      }}
    />
  );
}
