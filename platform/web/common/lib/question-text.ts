/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

/**
 * Questions and feedback as instructors typed them, tidied for reading: no stray quotes (from pasted
 * sheets), typed numbering or extra spaces, a capital first letter, entries with no words (a lone
 * quote) left out. The wording is never changed. Links get a readable name (see QuestionText).
 */

const QUOTES = /^[\s"'`“”‘’]+|[\s"'`“”‘’]+$/g;
const LINK = /https?:\/\/[^\s"'<>]+/gi;
const URL_ONLY = /^https?:\/\/\S+$/i;

export const isLink = (text: string) => URL_ONLY.test(text.trim());

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function cleanQuestion(text: string): string {
  let s = text.replace(/\s+/g, " ").replace(QUOTES, "").trim();
  // Numbering typed into the text ("1.", "2)", "3 -"): the list numbers them already.
  s = s.replace(/^\d{1,2}\s*[.)\-:]\s*/, "").replace(QUOTES, "").trim();
  // Unbalanced quotes left inside after trimming the ends, e.g. `Zero fill matrix"`.
  if ((s.match(/"/g) ?? []).length % 2 === 1) s = s.replace(/"/g, "").trim();
  return isLink(s) ? s : capitalise(s);
}

/** Cleaned, without empty entries or repeats (same text, any case), in the order asked. */
export function cleanQuestions<T extends { title: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const q of list) {
    const title = cleanQuestion(q.title);
    const key = title.toLowerCase();
    if (!/[\p{L}\p{N}]/u.test(title) || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...q, title });
  }
  return out;
}

/** Feedback text (performed well, improvement areas, action items): each line and sentence starts with a capital. */
export function cleanNote(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(QUOTES, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => (isLink(line) ? line : capitalise(line).replace(/([.!?]\s+)([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase())))
    .join("\n");
}

const titleCase = (slug: string) =>
  slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => (/^(of|and|the|in|on|to|a|an|for|with|by|or)$/i.test(w) ? w.toLowerCase() : capitalise(w.toLowerCase())))
    .map((w, i) => (i === 0 ? capitalise(w) : w))
    .join(" ");

/** A readable name for a problem link, e.g. "LeetCode · Two Sum", "CCBP question · a04190bf". */
export function linkLabel(raw: string): string {
  const url = raw.trim();
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  const after = (seg: string) => parts[parts.indexOf(seg) + 1];
  if (host.endsWith("leetcode.com") && parts.includes("problems") && after("problems")) return `LeetCode · ${titleCase(after("problems")!)}`;
  if (host.endsWith("ccbp.in")) {
    const id = parts.includes("question") ? after("question") : u.searchParams.get("q_id");
    if (id) return `CCBP question · ${id.slice(0, 8)}`;
  }
  if (host === "atcoder.jp" && parts.includes("tasks") && after("tasks")) return `AtCoder · ${after("tasks")}`;
  if (host.endsWith("codeforces.com")) {
    const m = /(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Z]\d?)/i.exec(u.pathname);
    if (m) return `Codeforces · ${m[1]}${m[2].toUpperCase()}`;
  }
  if (host.endsWith("geeksforgeeks.org") && parts.includes("problems") && after("problems")) return `GfG · ${titleCase(after("problems")!)}`;
  if (host.endsWith("hackerrank.com") && parts.includes("challenges") && after("challenges")) return `HackerRank · ${titleCase(after("challenges")!)}`;
  const path = parts.join("/");
  return path ? `${host}/${path.length > 36 ? `${path.slice(0, 36)}…` : path}` : host;
}

/** Text with its links pulled out, in order: [{ text } | { url }]. */
export function splitLinks(text: string): ({ text: string } | { url: string })[] {
  const out: ({ text: string } | { url: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const url = m[0].replace(/[),.;]+$/, "");
    const before = text.slice(last, m.index).replace(/[\s\-–:]+$/, "");
    if (before.trim()) out.push({ text: before });
    out.push({ url });
    last = (m.index ?? 0) + url.length;
  }
  const rest = text.slice(last).replace(/^[\s\-–:]+/, "");
  if (rest.trim()) out.push({ text: rest });
  return out;
}
