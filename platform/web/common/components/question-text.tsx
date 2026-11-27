/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

import { ExternalLink } from "lucide-react";
import { linkLabel, splitLinks } from "@/common/lib/question-text";

function ProblemLink({ url, small = false }: { url: string; small?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className={small ? "inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" : "inline-flex items-center gap-1 text-primary hover:underline"}
    >
      {linkLabel(url)}
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * A question (already cleaned with cleanQuestions): a link shows as a readable name (e.g.
 * "LeetCode · Two Sum") that opens in a new tab; text with links in it keeps the text and lists
 * the links after it.
 */
export function QuestionText({ text }: { text: string }) {
  const parts = splitLinks(text);
  const words = parts.filter((p): p is { text: string } => "text" in p);
  const links = parts.filter((p): p is { url: string } => "url" in p);
  if (!links.length) return <>{text}</>;
  if (!words.length) {
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {links.map((l, i) => (
          <ProblemLink key={`${l.url}-${i}`} url={l.url} />
        ))}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span>{words.map((w) => w.text.trim()).join(" ")}</span>
      {links.map((l, i) => (
        <ProblemLink key={`${l.url}-${i}`} url={l.url} small />
      ))}
    </span>
  );
}
