/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { ErrorView } from "@/common/components/error-view";

/** A staff page that broke: shown inside the app, so the sidebar stays. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-8">
      <ErrorView error={error} reset={reset} />
    </div>
  );
}
