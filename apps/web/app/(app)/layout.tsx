/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { AppShell } from "@/modules/shell/app-shell";
import { QueryProvider } from "@/modules/shell/query-provider";
import { getSessionUser } from "@/common/auth/session";

async function ShellWithUser({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <QueryProvider>
      <AppShell user={user}>{children}</AppShell>
    </QueryProvider>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh flex-wrap bg-background" aria-busy="true">
      <div className="flex-[1_1_220px] border-r border-sidebar-border bg-sidebar md:max-w-64" />
      <div className="flex-[999_1_560px]" />
    </div>
  );
}

/**
 * The session is read from cookies (request-time data), so with Cache Components
 * it must sit inside its own Suspense boundary.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <ShellWithUser>{children}</ShellWithUser>
    </Suspense>
  );
}
