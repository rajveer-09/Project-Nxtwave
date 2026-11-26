"use client";

import { useEffect } from "react";

/**
 * Puts form fields back to the values the page's data actually uses. Runs:
 * - whenever `version` changes: pass a value the server makes fresh on every render, so each new
 *   page payload resets the fields (Next.js can keep the same page instance when only the search
 *   params change, e.g. "Back to today", and a prefetched payload can arrive without a request);
 * - whenever the page is shown again: with cacheComponents, pages you leave stay alive but hidden,
 *   with whatever was typed in them, and React re-runs effects when they are revealed.
 */
export function useResetWhenShown(reset: () => void, version: string | number) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the trigger; `reset` reads that render's props
  useEffect(() => reset(), [version]);
}
