/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

/**
 * CSV writing with spreadsheet formula-injection protection (same rule NxtRank's
 * export uses): a cell starting with = + - @ or a tab/CR is prefixed with ' so
 * Excel / Sheets treat it as text.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 (Indian names, ₹, etc.) correctly.
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
