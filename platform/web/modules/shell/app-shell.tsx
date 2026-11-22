/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { SidebarFrame } from "@/modules/shell/sidebar-frame";
import { SIDEBAR_COOKIE } from "@/modules/shell/sidebar-cookie";
import { initials, ROLE_LABEL, type SessionUser } from "@/common/auth/roles";
import { navForRole } from "@/common/lib/nav";
import { Brand } from "@/common/components/brand";
import { SideNavLinks, SideNavLinksFallback } from "@/modules/shell/side-nav";
import { ProfileMenu } from "@/modules/shell/profile-menu";
import { MessageBell, UrgentBanner } from "@/modules/messages/components/notifications";
import { ViewAsBanner } from "@/modules/shell/view-as";

/**
 * App frame: sidebar (role-based) + main content. The sidebar stacks above the
 * content at phone width (flex-wrap), matching the prototype.
 */
export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const sections = navForRole(user.role);
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  return (
    <div className="flex min-h-app flex-wrap bg-background lg:flex-nowrap">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <SidebarFrame
        initialCollapsed={collapsed}
        className="flex flex-[1_1_220px] flex-col gap-0.5 border-r border-sidebar-border bg-sidebar px-3.5 py-5 md:max-w-64 lg:sticky lg:top-0 lg:h-app lg:w-64 lg:flex-none lg:self-start"
      >
        {/* Desktop: logo pinned at the top, profile pinned at the bottom, only the menu scrolls. */}
        <div className="sb-col mb-4 flex shrink-0 items-center justify-between gap-2">
          <Link href="/" aria-label="NxtOne home" className="sb-hide flex min-w-0 items-center rounded-lg px-2 py-1.5">
            <Brand size="sm" />
          </Link>
          <Link href="/" aria-label="NxtOne home" className="sb-only flex size-10 items-center justify-center rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static mark */}
            <img src="/icon.svg" alt="" width={30} height={30} />
          </Link>
          <MessageBell />
        </div>
        <div className="lg:-mx-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-1">
          <Suspense fallback={<SideNavLinksFallback sections={sections} />}>
            <SideNavLinks sections={sections} />
          </Suspense>
        </div>
        <div className="min-h-6 grow lg:hidden" />
        <ProfileMenu name={user.name} role={ROLE_LABEL[user.role]} initials={initials(user.name)} />
      </SidebarFrame>
      <main id="main" className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-4 py-7 sm:px-8 sm:pb-12">
        {user.viewedBy ? (
          <ViewAsBanner name={user.name} role={ROLE_LABEL[user.role]} by={user.viewedBy.name} backTo="/admin/staff" className="sticky top-0 z-40 -mx-4 -mt-7 sm:-mx-8" />
        ) : null}
        <UrgentBanner />
        {/* No page-change animation: the next page simply appears. */}
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
