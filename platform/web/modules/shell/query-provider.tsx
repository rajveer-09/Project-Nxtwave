/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/common/lib/api-client";

/** A backend service that is starting up (it answers once awake). */
export const waking = (error: unknown) => error instanceof ApiError && (error.status === 502 || error.status === 504);

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            // A service waking from sleep (502/504 from common/services/forward.ts, about a minute):
            // keep trying every 10 s. Otherwise don't retry errors the user has to fix (auth,
            // permissions, bad input, missing), and other server errors twice.
            retry: (count, error) => (waking(error) ? count < 8 : !(error instanceof ApiError && error.status < 500) && count < 2),
            retryDelay: (count, error) => (waking(error) ? 10_000 : Math.min(1000 * 2 ** count, 8000)),
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
