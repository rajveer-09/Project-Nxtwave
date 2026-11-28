/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { ErrorView } from "@/common/components/error-view";

/** A student portal page that broke. */
export default function StudentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <ErrorView error={error} reset={reset} home="/me" />
    </div>
  );
}
