/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { LogOut } from "lucide-react";
import { signOut } from "@/modules/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        aria-label="Sign out"
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <LogOut aria-hidden="true" className="size-4" strokeWidth={1.8} />
      </button>
    </form>
  );
}
