/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { AppShell } from "@/modules/shell/app-shell";
import { QueryProvider } from "@/modules/shell/query-provider";
import { Preload } from "@/modules/shell/preload";
import { getSessionUser } from "@/common/auth/session";

async function ShellWithUser({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <QueryProvider>
      <AppShell user={user}>{children}</AppShell>
      <Preload />
    </QueryProvider>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-app flex-wrap bg-background lg:flex-nowrap" aria-busy="true">
      <div className="flex-[1_1_220px] border-r border-sidebar-border bg-sidebar md:max-w-64 lg:sticky lg:top-0 lg:h-app lg:w-64 lg:flex-none" />
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
