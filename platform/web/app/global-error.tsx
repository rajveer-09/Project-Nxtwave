/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { ErrorView } from "@/common/components/error-view";
import "./globals.css";

/** Last resort: the whole app (its root layout) broke, so this page brings its own html and styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-4 py-8">
          <ErrorView error={error} reset={reset} />
        </main>
      </body>
    </html>
  );
}
