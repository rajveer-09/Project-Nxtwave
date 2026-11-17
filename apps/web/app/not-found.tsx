/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/common/components/empty-state";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-app max-w-lg flex-col justify-center px-4">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="The link may be old, or the student or record may have been removed."
        action={
          <Link href="/" className="font-semibold text-primary hover:text-accent-strong">
            Back to Home
          </Link>
        }
      />
    </main>
  );
}
