/*

Author : Rajveer Sharma
Date : 21 Nov 2026
@ Nxtwave

*/

/** One choice in a Dropdown (common/components/dropdown.tsx). Usable from server and client code. */
export type DropdownOption = { value: string; label: string; disabled?: boolean };

/** Options from plain strings (value and label the same). */
export const asOptions = (values: readonly string[]): DropdownOption[] => values.map((v) => ({ value: v, label: v }));
