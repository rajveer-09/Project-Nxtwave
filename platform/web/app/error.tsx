/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { ErrorView } from "@/common/components/error-view";

/** Any other page that broke (sign-in, code rooms, ...). */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-app items-center justify-center px-4 py-8">
      <ErrorView error={error} reset={reset} />
    </main>
  );
}
