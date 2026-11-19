/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

/**
 * Text sync helpers for the code room. Each side edits its own copy and sends the whole text with
 * the version it started from. When both changed the same version, the two edits are merged: each
 * edit is the one region that differs from the common base (typing, pasting and deleting are all a
 * single region), so non-overlapping edits both survive. Overlapping edits keep the local one.
 */

export type Hunk = { start: number; end: number; text: string };

/** The single region of `from` that was replaced to get `to` (start/end are offsets in `from`). */
export function diffHunk(from: string, to: string): Hunk | null {
  if (from === to) return null;
  const max = Math.min(from.length, to.length);
  let p = 0;
  while (p < max && from.charCodeAt(p) === to.charCodeAt(p)) p++;
  let s = 0;
  while (s < max - p && from.charCodeAt(from.length - 1 - s) === to.charCodeAt(to.length - 1 - s)) s++;
  return { start: p, end: from.length - s, text: to.slice(p, to.length - s) };
}

/** Merges the local and remote edits of the same base text. */
export function merge3(base: string, local: string, remote: string): string {
  if (local === base) return remote;
  if (remote === base || remote === local) return local;
  const mine = diffHunk(base, local)!;
  const theirs = diffHunk(base, remote)!;
  if (mine.end <= theirs.start && !(mine.start === mine.end && mine.start === theirs.start)) {
    return base.slice(0, mine.start) + mine.text + base.slice(mine.end, theirs.start) + theirs.text + base.slice(theirs.end);
  }
  if (theirs.end <= mine.start) {
    return base.slice(0, theirs.start) + theirs.text + base.slice(theirs.end, mine.start) + mine.text + base.slice(mine.end);
  }
  // Both inserted at the same point: keep both, theirs first.
  if (mine.start === mine.end && theirs.start === theirs.end && mine.start === theirs.start) {
    return base.slice(0, theirs.start) + theirs.text + mine.text + base.slice(mine.end);
  }
  return local;
}

/** Where a caret at `pos` in `before` ends up in `after` (text after the change keeps its place). */
export function mapCaret(before: string, after: string, pos: number): number {
  const hunk = diffHunk(before, after);
  if (!hunk || pos <= hunk.start) return pos;
  if (pos >= hunk.end) return pos + hunk.text.length - (hunk.end - hunk.start);
  return hunk.start + hunk.text.length;
}
