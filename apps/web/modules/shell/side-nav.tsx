/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/common/lib/utils";
import type { NavSection } from "@/common/lib/nav";
import { NavIcon } from "@/modules/shell/nav-icon";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** Shows at once that a click registered, while the next page loads. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-auto size-1.5 rounded-full bg-primary transition-opacity duration-150",
        pending ? "animate-pulse opacity-100 delay-100" : "opacity-0",
      )}
    />
  );
}

/** Sidebar links. Reads the pathname, so the shell renders it inside <Suspense>. */
export function SideNavLinks({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-0.5">
      {sections.map((section, i) => (
        <div key={section.label ?? i} className="flex flex-col gap-0.5">
          {section.label ? (
            <span className="px-3 pt-5 pb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              {section.label}
            </span>
          ) : null}
          {section.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <NavIcon name={item.icon} className="size-[18px]" />
                {item.label}
                <PendingDot />
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Static fallback used while the pathname is not yet known (prerender). */
export function SideNavLinksFallback({ sections }: { sections: NavSection[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {sections.map((section, i) => (
        <div key={section.label ?? i} className="flex flex-col gap-0.5">
          {section.label ? (
            <span className="px-3 pt-5 pb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              {section.label}
            </span>
          ) : null}
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-sidebar-foreground"
            >
              <NavIcon name={item.icon} className="size-[18px]" />
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
