/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

import { ExternalLink } from "lucide-react";
import { cn } from "@/common/lib/utils";

/** A student's public LeetCode profile. */
export const leetcodeProfileUrl = (handle: string) => `https://leetcode.com/u/${encodeURIComponent(handle.trim())}/`;

/** A LeetCode handle that opens the student's profile on leetcode.com in a new tab. */
export function LeetCodeLink({ handle, className }: { handle: string; className?: string }) {
  return (
    <a
      href={leetcodeProfileUrl(handle)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${handle} on LeetCode`}
      className={cn("inline-flex items-center gap-1 text-primary underline-offset-2 hover:text-accent-strong hover:underline", className)}
    >
      {handle}
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      <span className="sr-only"> (LeetCode profile, opens in a new tab)</span>
    </a>
  );
}
