/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { Suspense } from "react";
import { initials, ROLE_LABEL, type SessionUser } from "@/common/auth/roles";
import { navForRole } from "@/common/lib/nav";
import { SideNavLinks, SideNavLinksFallback } from "@/modules/shell/side-nav";
import { SignOutButton } from "@/modules/shell/sign-out-button";
import { MessageBell, UrgentBanner } from "@/modules/messages/components/notifications";

/**
 * App frame: sidebar (role-based) + main content. The sidebar stacks above the
 * content at phone width (flex-wrap), matching the prototype.
 */
export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const sections = navForRole(user.role);
  return (
    <div className="flex min-h-dvh flex-wrap bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <nav
        aria-label="Main"
        className="flex flex-[1_1_220px] flex-col gap-0.5 border-r border-sidebar-border bg-sidebar px-3.5 py-5 md:max-w-64"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-1">
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-primary font-heading text-base font-bold text-primary-foreground">
              N
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-heading text-[15px] font-semibold text-foreground">NxtWave Student Hub</span>
              <span className="text-xs text-muted-foreground">Attendance · Interactions · Contests</span>
            </span>
          </Link>
          <MessageBell />
        </div>
        <Suspense fallback={<SideNavLinksFallback sections={sections} />}>
          <SideNavLinks sections={sections} />
        </Suspense>
        <div className="min-h-6 grow" />
        <div className="flex items-center gap-2.5 rounded-xl border border-border p-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-sidebar-foreground">
            {initials(user.name)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-semibold">{user.name}</span>
            <span className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</span>
          </span>
          <SignOutButton />
        </div>
      </nav>
      <main id="main" className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-4 py-7 sm:px-8 sm:pb-12">
        <UrgentBanner />
        {children}
      </main>
    </div>
  );
}
