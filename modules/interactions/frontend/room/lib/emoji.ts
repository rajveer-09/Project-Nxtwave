/*

Author : Rajveer Sharma
Date : 21 Nov 2026
@ Nxtwave

*/

/**
 * Emoji aren't allowed in the code room. Matches whole emoji sequences: flags, keycaps (1️⃣),
 * pictographs with their skin tone / presentation selector, and ZWJ families (👨‍👩‍👧), plus any
 * stray modifier left over. ©, ® and ™ stay: they're ordinary text in code and comments.
 */
const EMOJI =
  /\p{Regional_Indicator}|[#*0-9]️?⃣|(?![©®™])\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍(?![©®™])\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*|\p{Emoji_Modifier}|⃣|️/gu;
const ANY_EMOJI = new RegExp(EMOJI.source, "u");

export const hasEmoji = (text: string) => ANY_EMOJI.test(text);
export const stripEmoji = (text: string) => text.replace(EMOJI, "");
