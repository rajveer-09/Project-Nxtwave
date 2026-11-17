/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** Copy of the current params with changes applied; null/"" removes a key. Resets page unless set. */
export function withParams(
  pathname: string,
  current: SearchParamsRecord | URLSearchParams,
  changes: Record<string, string | number | null | undefined>,
): string {
  const next = new URLSearchParams();
  const entries = current instanceof URLSearchParams ? [...current.entries()] : Object.entries(current);
  for (const [key, value] of entries) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v) next.set(key, v);
  }
  if (!("page" in changes)) next.delete("page");
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
