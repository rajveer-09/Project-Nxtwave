/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

/**
 * Sample roadmap question bank until the Curriculum admin (UI-7, logs.questions) exists.
 * Keyed by "Level N|Topic" or "Level N|Topic|Subtopic"; step codes follow the curriculum.
 */
export type BankQuestion = { title: string; step: string; source: string; url?: string };

export const QUESTION_BANK: Record<string, BankQuestion[]> = {
  "Level 1|Arrays|Prefix & Suffix sum": [
    { title: "Running Sum of 1d Array", step: "2.1", source: "LeetCode 1480" },
    { title: "Find Pivot Index", step: "2.1", source: "LeetCode 724" },
    { title: "Pivot index from the right", step: "2.2", source: "Tweak of 724" },
    { title: "Subarray Sum Equals K", step: "3.1", source: "LeetCode 560" },
    { title: "Product of Array Except Self", step: "3.1", source: "LeetCode 238" },
  ],
  "Level 1|Arrays|Array Traversal": [
    { title: "Find Numbers with Even Number of Digits", step: "2.1", source: "LeetCode 1295" },
    { title: "Move Zeroes", step: "2.2", source: "LeetCode 283" },
    { title: "Rotate Array", step: "3.1", source: "LeetCode 189" },
  ],
  "Level 1|Arrays|Kadane's Algo": [
    { title: "Maximum Subarray", step: "3.1", source: "LeetCode 53" },
    { title: "Maximum Sum Circular Subarray", step: "3.2", source: "LeetCode 918" },
  ],
  "Level 1|Arrays|Array + Map / Set": [
    { title: "Two Sum", step: "2.1", source: "LeetCode 1" },
    { title: "Contains Duplicate", step: "2.1", source: "LeetCode 217" },
    { title: "Longest Consecutive Sequence", step: "3.1", source: "LeetCode 128" },
  ],
  "Level 1|STL|Map / Unordered Map": [
    { title: "Valid Anagram", step: "2.1", source: "LeetCode 242" },
    { title: "Group Anagrams", step: "3.1", source: "LeetCode 49" },
  ],
  "Level 1|String": [
    { title: "Longest Common Prefix", step: "2.1", source: "LeetCode 14" },
    { title: "Reverse Words in a String", step: "3.1", source: "LeetCode 151" },
  ],
  "Level 2|Sorting": [
    { title: "Sort Colors", step: "3.1", source: "LeetCode 75" },
    { title: "Merge Intervals", step: "3.1", source: "LeetCode 56" },
  ],
  "Level 2|Binary Search": [
    { title: "Binary Search", step: "2.1", source: "LeetCode 704" },
    { title: "Search in Rotated Sorted Array", step: "3.1", source: "LeetCode 33" },
    { title: "Koko Eating Bananas", step: "3.2", source: "LeetCode 875" },
  ],
  "Level 2|Recursion - Basics": [
    { title: "Fibonacci Number", step: "2.1", source: "LeetCode 509" },
    { title: "Pow(x, n)", step: "3.1", source: "LeetCode 50" },
  ],
  "Level 3|Two pointers / Sliding window": [
    { title: "Valid Palindrome", step: "2.1", source: "LeetCode 125" },
    { title: "Longest Substring Without Repeating Characters", step: "3.1", source: "LeetCode 3" },
    { title: "Trapping Rain Water", step: "4.1", source: "LeetCode 42" },
  ],
};

/** Bank key for a level/topic/subtopic, e.g. "Level 1|Arrays|Prefix & Suffix sum". */
export const bankKey = (level: string, topic: string, subtopic?: string | null) => (subtopic ? `${level}|${topic}|${subtopic}` : `${level}|${topic}`);

/**
 * Questions for the picked level/topics/subtopics, de-duplicated by title.
 * `bank` is the live question bank from the Curriculum module; QUESTION_BANK is its starting data.
 */
export function questionsFor(
  level: string,
  topics: string[],
  subtopics: string[],
  bank: Record<string, BankQuestion[]> = QUESTION_BANK,
): (BankQuestion & { where: string })[] {
  const QUESTION_BANK_IN_USE = bank;
  const keys = subtopics.length ? subtopics.map((sub) => bankKey(level, topics[0], sub)) : topics.map((t) => bankKey(level, t));
  const seen = new Set<string>();
  const out: (BankQuestion & { where: string })[] = [];
  for (const key of keys) {
    for (const q of QUESTION_BANK_IN_USE[key] ?? []) {
      if (seen.has(q.title)) continue;
      seen.add(q.title);
      out.push({ ...q, where: key.split("|").slice(1).join(" › ") });
    }
  }
  return out;
}
