/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { cn } from "@/common/lib/utils";
import { Button, buttonVariants } from "@/common/ui/button";

/**
 * What a page shows when something on it breaks (the error.tsx files and global-error.tsx): what
 * happened in plain words, Try again (re-renders just the broken part), Home, and a reference to
 * quote if it keeps happening. The page around it (sidebar, header) stays.
 */
export function ErrorView({ error, reset, home = "/" }: { error: Error & { digest?: string }; reset: () => void; home?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-warning-soft">
        <AlertTriangle aria-hidden="true" className="size-5 text-warning" />
      </span>
      <h1 className="text-lg font-semibold text-foreground">Something went wrong on this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Nothing you saved is lost. Try again, or go back to Home. If it keeps happening, send the reference below to the NxtOne team.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()} className="h-10 gap-1.5 px-4">
          <RotateCcw aria-hidden="true" className="size-4" />
          Try again
        </Button>
        <Link href={home} className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-1.5 px-4")}>
          <Home aria-hidden="true" className="size-4" />
          Go to Home
        </Link>
      </div>
      {error.digest ? <p className="mt-1 text-xs text-muted-foreground">Reference: <span className="font-mono">{error.digest}</span></p> : null}
    </div>
  );
}
