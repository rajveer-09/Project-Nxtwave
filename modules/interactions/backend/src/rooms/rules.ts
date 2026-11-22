/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

/*
 * What a code room pad may hold. The same rules as the web app's editor and HTTP API
 * (modules/interactions/frontend/room/lib/types.ts and lib/emoji.ts): keep them in step.
 */

export const MAX_CODE = 50_000;
export const MAX_LINES = 2_000;
export const LANGUAGES = ['cpp', 'java', 'python', 'javascript', 'c', 'text'] as const;
export type Language = (typeof LANGUAGES)[number];

const EMOJI =
  /\p{Regional_Indicator}|[#*0-9]️?⃣|(?![©®™])\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍(?![©®™])\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*|\p{Emoji_Modifier}|⃣|️/u;

function lineCount(text: string): number {
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++;
  return n;
}

/** Why `code` can't be saved, or null if it can. */
export function codeProblem(code: unknown): string | null {
  if (typeof code !== 'string') return "That change isn't valid.";
  if (code.length > MAX_CODE || lineCount(code) > MAX_LINES) {
    return `The code room holds up to ${MAX_LINES.toLocaleString('en-IN')} lines and ${MAX_CODE.toLocaleString('en-IN')} characters.`;
  }
  if (EMOJI.test(code)) return "Emoji aren't allowed in the code room.";
  return null;
}

/**
 * Merges two edits of the same base text (same as the web app's lib/merge.ts): each edit is the one
 * region that differs from the base; non-overlapping edits both survive, overlapping ones keep `local`.
 */
export function merge3(base: string, local: string, remote: string): string {
  if (local === base) return remote;
  if (remote === base || remote === local) return local;
  const hunk = (from: string, to: string) => {
    const max = Math.min(from.length, to.length);
    let p = 0;
    while (p < max && from.charCodeAt(p) === to.charCodeAt(p)) p++;
    let s = 0;
    while (s < max - p && from.charCodeAt(from.length - 1 - s) === to.charCodeAt(to.length - 1 - s)) s++;
    return { start: p, end: from.length - s, text: to.slice(p, to.length - s) };
  };
  const mine = hunk(base, local);
  const theirs = hunk(base, remote);
  if (mine.end <= theirs.start && !(mine.start === mine.end && mine.start === theirs.start)) {
    return base.slice(0, mine.start) + mine.text + base.slice(mine.end, theirs.start) + theirs.text + base.slice(theirs.end);
  }
  if (theirs.end <= mine.start) {
    return base.slice(0, theirs.start) + theirs.text + base.slice(theirs.end, mine.start) + mine.text + base.slice(mine.end);
  }
  if (mine.start === mine.end && theirs.start === theirs.end && mine.start === theirs.start) {
    return base.slice(0, theirs.start) + theirs.text + mine.text + base.slice(mine.end);
  }
  return local;
}
