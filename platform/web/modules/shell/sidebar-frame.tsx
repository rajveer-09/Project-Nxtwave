/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { cn } from "@/common/lib/utils";
import { SIDEBAR_COOKIE } from "@/modules/shell/sidebar-cookie";

/**
 * The sidebar's frame on desktop: a handle on its right edge (halfway down) folds it into a slim
 * icon rail and opens it again. The choice is kept in a cookie, so the server draws it the same way
 * on the next visit (no jump). Inside, `sb-hide` / `sb-only` / `sb-col` / `sb-center` adapt to it
 * (globals.css).
 */

export function SidebarFrame({ initialCollapsed, className, children }: { initialCollapsed: boolean; className?: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <nav aria-label="Main" data-sidebar={collapsed ? "collapsed" : "open"} className={cn("relative lg:z-20", className)}>
      {children}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Show the sidebar" : "Hide the sidebar"}
        title={collapsed ? "Show the sidebar" : "Hide the sidebar"}
        className="absolute top-1/2 -right-3 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:flex"
      >
        <ChevronLeft aria-hidden="true" className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} strokeWidth={2.2} />
      </button>
    </nav>
  );
}
