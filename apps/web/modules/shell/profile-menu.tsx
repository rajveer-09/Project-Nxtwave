/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { ChevronsUpDown, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { switchTheme } from "@/common/components/theme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/common/ui/dropdown-menu";
import { signOut } from "@/modules/login/actions";

/**
 * The profile card at the bottom of the sidebar. Clicking it opens a menu: switch between the light
 * and dark theme first, log out second.
 */
export function ProfileMenu({
  name,
  role,
  initials,
  variant = "sidebar",
  signOutAction = signOut,
}: {
  name: string;
  role: string;
  initials: string;
  /** "header": a compact button for the student portal's top bar. */
  variant?: "sidebar" | "header";
  signOutAction?: () => Promise<void>;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [signingOut, startSignOut] = useTransition();
  const dark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${name}, ${role}. Open the profile menu`}
        className={
          variant === "sidebar"
            ? "sb-col flex w-full shrink-0 items-center gap-2.5 rounded-xl border border-border bg-sidebar p-3 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-popup-open:bg-muted lg:mt-2"
            : "flex items-center gap-2.5 rounded-xl border border-border bg-card py-1.5 pr-2.5 pl-1.5 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-popup-open:bg-muted"
        }
      >
        <span title={`${name} · ${role}`} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-sidebar-foreground">
          {initials}
        </span>
        <span className={variant === "sidebar" ? "sb-hide flex min-w-0 flex-1 flex-col" : "hidden min-w-0 flex-col sm:flex"}>
          <span className="truncate text-[13px] font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">{role}</span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="sb-hide size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side={variant === "sidebar" ? "top" : "bottom"} align={variant === "sidebar" ? "start" : "end"} sideOffset={6} className="w-60 p-1.5">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <span className="block truncate text-[13px] font-semibold text-foreground">{name}</span>
          <span className="block">{role}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-10 gap-2.5 px-2 text-[13px] font-medium" onClick={() => switchTheme(dark ? "light" : "dark", setTheme)}>
          {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          {dark ? "Switch to light theme" : "Switch to dark theme"}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className="min-h-10 gap-2.5 px-2 text-[13px] font-medium"
          disabled={signingOut}
          onClick={() => startSignOut(() => signOutAction())}
        >
          <LogOut aria-hidden="true" />
          {signingOut ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
