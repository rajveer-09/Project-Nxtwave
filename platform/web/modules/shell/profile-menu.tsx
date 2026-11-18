/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { ChevronsUpDown, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { switchTheme } from "@/common/components/theme";
import { cn } from "@/common/lib/utils";
import { signOut } from "@/modules/login/actions";

/**
 * The profile card (bottom of the sidebar, or the student portal's header). Clicking it opens a
 * small menu right next to it: switch between the light and dark theme first, log out second.
 *
 * Positioned with plain CSS against the card, not a floating-position library: the desktop UI is
 * scaled with CSS zoom (globals.css), which such libraries measure wrongly, opening the menu far
 * from the card.
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
  /** "header": a compact button for the student portal's top bar (menu opens below it). */
  variant?: "sidebar" | "header";
  signOutAction?: () => Promise<void>;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const dark = resolvedTheme === "dark";
  const sidebar = variant === "sidebar";

  // Close on a click outside or Escape (focus goes back to the card).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    items.current[0]?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onMenuKey(e: React.KeyboardEvent) {
    const list = items.current.filter(Boolean) as HTMLButtonElement[];
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (at + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
      list[next]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const item =
    "flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

  return (
    <div ref={wrap} className={cn("relative", sidebar && "sb-col shrink-0 lg:mt-2")}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${name}, ${role}. Open the profile menu`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          sidebar
            ? "sb-col w-full rounded-xl border border-border bg-sidebar p-3 hover:bg-muted"
            : "rounded-xl border border-border bg-card py-1.5 pr-2.5 pl-1.5 hover:bg-muted",
          open && "bg-muted",
        )}
      >
        <span title={`${name} · ${role}`} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-sidebar-foreground">
          {initials}
        </span>
        <span className={sidebar ? "sb-hide flex min-w-0 flex-1 flex-col" : "hidden min-w-0 flex-col sm:flex"}>
          <span className="truncate text-[13px] font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">{role}</span>
        </span>
        <ChevronsUpDown aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground", sidebar ? "sb-hide" : "hidden sm:block")} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Profile"
          onKeyDown={onMenuKey}
          className={cn(
            "absolute z-50 w-60 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg",
            sidebar ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2",
          )}
        >
          <div className="px-2.5 py-2 text-xs text-muted-foreground">
            <span className="block truncate text-[13px] font-semibold text-foreground">{name}</span>
            <span className="block">{role}</span>
          </div>
          <div aria-hidden="true" className="my-1 h-px bg-border" />
          <button
            ref={(el) => {
              items.current[0] = el;
            }}
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              switchTheme(dark ? "light" : "dark", setTheme);
              setOpen(false);
            }}
          >
            {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            {dark ? "Switch to light theme" : "Switch to dark theme"}
          </button>
          <button
            ref={(el) => {
              items.current[1] = el;
            }}
            type="button"
            role="menuitem"
            disabled={signingOut}
            className={cn(item, "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10")}
            onClick={() => startSignOut(() => signOutAction())}
          >
            <LogOut aria-hidden="true" />
            {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
