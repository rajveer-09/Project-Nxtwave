/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

/**
 * One way of matching a search box everywhere (lists filtered in the browser or on the server):
 * - case, accents, dots, commas, dashes and extra spaces don't matter ("a.vaishnavi" = "A. Vaishnavi")
 * - every word typed must appear, in any order ("reddy vaishnavi" finds "Vaishnavi Reddy")
 * - a word may span a space in the text ("akashkumar" finds "Akash Kumar")
 * - an empty search matches everything
 */

/** Lower case, no accents, words separated by single spaces; keeps letters, digits and @. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@]+/gu, " ")
    .trim();
}

/** The words of a search (at most 8). They only hold letters, digits and @, so they're safe in LIKE patterns. */
export function searchWords(query: string | null | undefined): string[] {
  return query ? normalizeSearch(query).split(" ").filter(Boolean).slice(0, 8) : [];
}

/** Whether `fields` (name, NIAT ID, email, …) match the search `query`. */
export function matchesSearch(query: string | null | undefined, ...fields: (string | number | null | undefined)[]): boolean {
  const words = searchWords(query);
  if (!words.length) return true;
  const text = normalizeSearch(fields.filter((f) => f !== null && f !== undefined && f !== "").join(" "));
  const joined = text.replace(/ /g, "");
  return words.every((w) => text.includes(w) || joined.includes(w));
}

/** A matcher made once for a list: `rows.filter((r) => match(r.name, r.niatId))`. */
export function searchMatcher(query: string | null | undefined) {
  const words = searchWords(query);
  if (!words.length) return () => true;
  return (...fields: (string | number | null | undefined)[]) => {
    const text = normalizeSearch(fields.filter((f) => f !== null && f !== undefined && f !== "").join(" "));
    const joined = text.replace(/ /g, "");
    return words.every((w) => text.includes(w) || joined.includes(w));
  };
}
