/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { ExternalLink } from "lucide-react";
import { cn } from "@/common/lib/utils";

/** A question's name: a link (new tab) when it has one, plain text when it doesn't. */
export function QuestionTitle({ title, url, className }: { title: string; url?: string | null; className?: string }) {
  if (!url) return <span className={cn("font-semibold", className)}>{title}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-baseline gap-1 font-semibold text-primary underline-offset-2 hover:underline focus-visible:underline", className)}
    >
      {title}
      <ExternalLink aria-hidden="true" className="size-3 shrink-0 self-center" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
