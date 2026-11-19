/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import type { BankQuestion } from "@nxtone/interactions-ui/lib/question-bank";

/**
 * DEMO questions for testing the "Questions asked" step rows: every live subtopic (and every topic without
 * subtopics) gets questions at each step; Level 0 has no steps. Level 1 topics stop at 3.2. Not reviewed by the
 * curriculum team. Delete this file and its use in question-bank.ts once real questions are in the Curriculum admin.
 *
 * Each entry is [step, title, source]; theory questions have no source.
 */
type Row = [step: string, title: string, source?: string];

const DEMO: Record<string, Row[]> = {
  // ---------------------------------------------------------------- Level 0 (no steps: step is "")
  "Level 0|Introduction": [
    ["", "What happens when a C++ program is compiled and run?"],
    ["", "What does #include <iostream> do?"],
    ["", "How do you read input with cin and print with cout?"],
    ["", "Print Hello World and your name on two lines"],
  ],
  "Level 0|Data Types": [
    ["", "What is the difference between int, long long and double?"],
    ["", "What happens when an int overflows?"],
    ["", "Why does 7 / 2 give 3 in C++, and how do you get 3.5?"],
    ["", "Read two numbers and print their sum, difference and product"],
  ],
  "Level 0|If else": [
    ["", "How is if / else if / else different from several separate ifs?"],
    ["", "What do the && and || operators do?"],
    ["", "Check whether a number is even or odd"],
    ["", "Find the largest of three numbers"],
    ["", "Check whether a year is a leap year"],
  ],
  "Level 0|Loops": [
    ["", "When would you use a while loop instead of a for loop?"],
    ["", "What do break and continue do?"],
    ["", "Print the numbers from 1 to N"],
    ["", "Find the sum of the first N natural numbers"],
    ["", "Print the multiplication table of N"],
  ],
  "Level 0|Traversal": [
    ["", "How do you visit every element of an array?"],
    ["", "Why do array indices start at 0?"],
    ["", "Find the sum of an array's elements"],
    ["", "Find the largest element in an array"],
    ["", "Count the even numbers in an array"],
  ],
  "Level 0|Time & Space Complexity analysis": [
    ["", "What does Big-O notation describe?"],
    ["", "What is the time complexity of a loop inside a loop?"],
    ["", "Which is faster for large n: O(n log n) or O(n²)?"],
    ["", "What extra space does a solution that copies the input array use?"],
  ],
  "Level 0|Pattern Questions": [
    ["", "How do the outer and inner loops work together to print a pattern?"],
    ["", "Print a square of stars of size N"],
    ["", "Print a right-angled triangle of stars"],
    ["", "Print an inverted right-angled triangle of numbers"],
    ["", "Print a pyramid of stars"],
  ],

  // ---------------------------------------------------------------- Level 1 · Maths
  "Level 1|Maths|Digit Manipulation": [
    ["1.1", "What is digit manipulation?"],
    ["1.1", "How do you extract the last digit of a number?"],
    ["1.1", "How do you remove the last digit of a number?"],
    ["1.1", "How do you count the digits in an integer?"],
    ["1.2", "Why does looping over the digits of n take O(log n) time?"],
    ["1.2", "How do you handle negative numbers when working digit by digit?"],
    ["1.2", "When can reversing a number overflow, and how do you guard against it?"],
    ["2.1", "Add Digits", "LeetCode 258"],
    ["2.1", "Count the Digits That Divide a Number", "LeetCode 2520"],
    ["2.2", "Palindrome Number", "LeetCode 9"],
    ["2.2", "Subtract the Product and Sum of Digits of an Integer", "LeetCode 1281"],
    ["3.1", "Reverse Integer", "LeetCode 7"],
    ["3.1", "Happy Number", "LeetCode 202"],
    ["3.2", "Self Dividing Numbers", "LeetCode 728"],
  ],
  "Level 1|Maths|LCM & GCD": [
    ["1.1", "What are GCD and LCM, and how are they related?"],
    ["1.1", "How does the Euclidean algorithm find the GCD?"],
    ["1.2", "Why does the Euclidean algorithm run in O(log min(a, b))?"],
    ["2.1", "Find Greatest Common Divisor of Array", "LeetCode 1979"],
    ["2.2", "Greatest Common Divisor of Strings", "LeetCode 1071"],
    ["3.1", "Water and Jug Problem", "LeetCode 365"],
    ["3.2", "Number of Subarrays With LCM Equal to K", "LeetCode 2470"],
  ],
  "Level 1|Maths|Prime Numbers": [
    ["1.1", "What makes a number prime?"],
    ["1.1", "How do you check whether n is prime in O(√n)?"],
    ["1.2", "Why does the Sieve of Eratosthenes run in O(n log log n)?"],
    ["2.1", "Prime Number of Set Bits in Binary Representation", "LeetCode 762"],
    ["2.2", "Prime In Diagonal", "LeetCode 2614"],
    ["3.1", "Count Primes", "LeetCode 204"],
    ["3.2", "Closest Prime Numbers in Range", "LeetCode 2523"],
  ],
  "Level 1|Maths|Fast Exponentiation": [
    ["1.1", "What is binary exponentiation?"],
    ["1.1", "How does squaring help compute aⁿ quickly?"],
    ["1.2", "Why is fast exponentiation O(log n)?"],
    ["2.1", "Power of Three", "LeetCode 326"],
    ["2.2", "Power of Four", "LeetCode 342"],
    ["3.1", "Pow(x, n) with binary exponentiation", "LeetCode 50"],
    ["3.2", "Count Good Numbers", "LeetCode 1922"],
  ],

  // ---------------------------------------------------------------- Level 1 · STL
  "Level 1|STL|Set / Unordered Set": [
    ["1.1", "How is a set different from an unordered_set?"],
    ["1.1", "When would you pick a set over a vector?"],
    ["1.2", "What do insert and find cost in a set vs an unordered_set?"],
    ["2.1", "Intersection of Two Arrays", "LeetCode 349"],
    ["2.2", "Unique Number of Occurrences", "LeetCode 1207"],
    ["3.1", "Valid Sudoku", "LeetCode 36"],
    ["3.2", "Find All Duplicates in an Array", "LeetCode 442"],
  ],
  "Level 1|STL|Map / Unordered Map": [
    ["1.1", "What does a map store, and how is it ordered?"],
    ["1.1", "What happens when you read a missing key with []?"],
    ["1.2", "When can an unordered_map be slower than a map?"],
    ["2.2", "First Unique Character in a String", "LeetCode 387"],
    ["3.2", "Top K Frequent Elements", "LeetCode 347"],
  ],
  "Level 1|STL|Stack": [
    ["1.1", "What is a stack, and what does LIFO mean?"],
    ["1.1", "Which operations does std::stack offer?"],
    ["1.2", "What do push, pop and top cost?"],
    ["2.1", "Valid Parentheses", "LeetCode 20"],
    ["2.2", "Backspace String Compare", "LeetCode 844"],
    ["3.1", "Min Stack", "LeetCode 155"],
    ["3.2", "Evaluate Reverse Polish Notation", "LeetCode 150"],
  ],
  "Level 1|STL|Queue": [
    ["1.1", "What is a queue, and what does FIFO mean?"],
    ["1.1", "How is a deque different from a queue?"],
    ["1.2", "How does a circular buffer make every queue operation O(1)?"],
    ["2.1", "Implement Stack using Queues", "LeetCode 225"],
    ["2.2", "Number of Recent Calls", "LeetCode 933"],
    ["3.1", "Design Circular Queue", "LeetCode 622"],
    ["3.2", "Dota2 Senate", "LeetCode 649"],
  ],

  // ---------------------------------------------------------------- Level 1 · Arrays
  "Level 1|Arrays|Array Traversal": [
    ["1.1", "How are array elements stored in memory?"],
    ["1.1", "How is looping by index different from looping by value?"],
    ["1.2", "Why is reading an element by index O(1)?"],
    ["3.2", "Rotate the array left by k in place", "Tweak of 189"],
  ],
  "Level 1|Arrays|Prefix & Suffix sum": [
    ["1.1", "What is a prefix sum array?"],
    ["1.1", "How do you get the sum of a range from prefix sums?"],
    ["1.2", "Why do prefix sums make each range query O(1)?"],
    ["3.2", "Range Sum Query 2D - Immutable", "LeetCode 304"],
  ],
  "Level 1|Arrays|Kadane's Algo": [
    ["1.1", "What problem does Kadane's algorithm solve?"],
    ["1.1", "What does the running sum mean at each index?"],
    ["1.2", "Why is Kadane's algorithm O(n) and not O(n²)?"],
    ["2.1", "Best Time to Buy and Sell Stock", "LeetCode 121"],
    ["2.2", "Maximum Ascending Subarray Sum", "LeetCode 1800"],
  ],
  "Level 1|Arrays|Array Adhoc": [
    ["1.1", "What does 'ad hoc' mean for an array problem?"],
    ["1.1", "How do you dry-run an array problem on a small example?"],
    ["1.2", "How do you tell that an O(n²) brute force is too slow?"],
    ["2.1", "Majority Element", "LeetCode 169"],
    ["2.2", "Plus One", "LeetCode 66"],
    ["3.1", "Next Permutation", "LeetCode 31"],
    ["3.2", "Spiral Matrix", "LeetCode 54"],
  ],
  "Level 1|Arrays|Array + Map / Set": [
    ["1.1", "Why pair an array with a hash map?"],
    ["1.1", "How do you count frequencies with a map?"],
    ["1.2", "How much extra space does a frequency map use?"],
    ["2.2", "Contains Duplicate II", "LeetCode 219"],
    ["3.2", "Subarray Sums Divisible by K", "LeetCode 974"],
  ],

  // ---------------------------------------------------------------- Level 1 · String (no subtopics)
  "Level 1|String": [
    ["1.1", "How is a string stored in C++?"],
    ["1.1", "How do you compare two strings?"],
    ["1.2", "Why can adding to a string in a loop be slow?"],
    ["2.2", "Reverse String", "LeetCode 344"],
    ["3.2", "Longest Palindromic Substring", "LeetCode 5"],
  ],

  // ---------------------------------------------------------------- Level 2
  "Level 2|Recursion - Basics": [
    ["1.1", "What is a base case, and why is it needed?"],
    ["1.1", "How does the call stack change as a function recurses?"],
    ["1.2", "How do you find the time complexity of a recursive function?"],
    ["2.2", "Climbing Stairs", "LeetCode 70"],
    ["3.2", "K-th Symbol in Grammar", "LeetCode 779"],
    ["4.1", "Parsing A Boolean Expression", "LeetCode 1106"],
  ],
  "Level 2|Sorting": [
    ["1.1", "What does it mean for a sort to be stable?"],
    ["1.1", "How does merge sort split and combine?"],
    ["1.2", "Why can't a comparison sort beat O(n log n)?"],
    ["2.1", "Sort Array By Parity", "LeetCode 905"],
    ["2.2", "Relative Sort Array", "LeetCode 1122"],
    ["3.2", "Largest Number", "LeetCode 179"],
    ["4.1", "Count of Smaller Numbers After Self", "LeetCode 315"],
  ],
  "Level 2|Binary Search": [
    ["1.1", "What must be true about an array before you binary search it?"],
    ["1.1", "How do you compute mid without overflowing?"],
    ["1.2", "Why does binary search take O(log n) steps?"],
    ["2.2", "Search Insert Position", "LeetCode 35"],
    ["4.1", "Median of Two Sorted Arrays", "LeetCode 4"],
  ],

  // ---------------------------------------------------------------- Level 3
  "Level 3|Two pointers / Sliding window": [
    ["1.1", "When do two pointers beat nested loops?"],
    ["1.1", "How is a fixed window different from a variable window?"],
    ["1.2", "Why is a sliding window O(n) despite the inner loop?"],
    ["2.2", "Merge Sorted Array", "LeetCode 88"],
    ["3.2", "Container With Most Water", "LeetCode 11"],
  ],
  "Level 3|Greedy Algorithms": [
    ["1.1", "What is a greedy choice?"],
    ["1.1", "How do you test a greedy idea with a counterexample?"],
    ["1.2", "Why does sorting usually set the cost of a greedy solution?"],
    ["2.1", "Assign Cookies", "LeetCode 455"],
    ["2.2", "Lemonade Change", "LeetCode 860"],
    ["3.1", "Jump Game", "LeetCode 55"],
    ["3.2", "Gas Station", "LeetCode 134"],
    ["4.1", "Candy", "LeetCode 135"],
  ],

  // ---------------------------------------------------------------- Level 4
  "Level 4|Bit Manipulation": [
    ["1.1", "What do AND, OR, XOR and NOT do to bits?"],
    ["1.1", "How do you check whether the i-th bit is set?"],
    ["1.2", "Why does n & (n - 1) clear the lowest set bit?"],
    ["2.1", "Number of 1 Bits", "LeetCode 191"],
    ["2.2", "Single Number", "LeetCode 136"],
    ["3.1", "Single Number II", "LeetCode 137"],
    ["3.2", "Subsets using bitmasks", "LeetCode 78"],
    ["4.1", "Minimum One Bit Operations to Make Integers Zero", "LeetCode 1611"],
  ],
  "Level 4|Stack & Queues": [
    ["1.1", "How do you build a queue from two stacks?"],
    ["1.1", "Where are stacks and queues used in real programs?"],
    ["1.2", "Why is a two-stack queue O(1) amortised per operation?"],
    ["2.1", "Implement Queue using Stacks", "LeetCode 232"],
    ["2.2", "Remove All Adjacent Duplicates In String", "LeetCode 1047"],
    ["3.1", "Decode String", "LeetCode 394"],
    ["3.2", "Asteroid Collision", "LeetCode 735"],
    ["4.1", "Basic Calculator", "LeetCode 224"],
  ],
  "Level 4|Stack - Monotonic Stack": [
    ["1.1", "What is a monotonic stack?"],
    ["1.1", "How does a monotonic stack find the next greater element?"],
    ["1.2", "Why is a monotonic stack O(n) overall?"],
    ["2.1", "Next Greater Element I", "LeetCode 496"],
    ["2.2", "Final Prices With a Special Discount in a Shop", "LeetCode 1475"],
    ["3.1", "Daily Temperatures", "LeetCode 739"],
    ["3.2", "Online Stock Span", "LeetCode 901"],
    ["4.1", "Largest Rectangle in Histogram", "LeetCode 84"],
  ],

  // ---------------------------------------------------------------- Level 5
  "Level 5|Heaps / PQ's": [
    ["1.1", "What is a heap, and how is it stored in an array?"],
    ["1.1", "How is a min-heap different from a max-heap?"],
    ["1.2", "Why are push and pop O(log n) on a heap?"],
    ["2.1", "Last Stone Weight", "LeetCode 1046"],
    ["2.2", "Kth Largest Element in a Stream", "LeetCode 703"],
    ["3.1", "Kth Largest Element in an Array", "LeetCode 215"],
    ["3.2", "K Closest Points to Origin", "LeetCode 973"],
    ["4.1", "Find Median from Data Stream", "LeetCode 295"],
  ],
  "Level 5|Linked list": [
    ["1.1", "How is a linked list different from an array?"],
    ["1.1", "How do you insert a node at the head and at the tail?"],
    ["1.2", "Why is reaching the k-th node O(k)?"],
    ["2.1", "Reverse Linked List", "LeetCode 206"],
    ["2.2", "Middle of the Linked List", "LeetCode 876"],
    ["3.1", "Remove Nth Node From End of List", "LeetCode 19"],
    ["3.2", "Reorder List", "LeetCode 143"],
    ["4.1", "Reverse Nodes in k-Group", "LeetCode 25"],
  ],
  "Level 5|Recursion - Advanced": [
    ["1.1", "What is backtracking?"],
    ["1.1", "How do you undo a choice when you backtrack?"],
    ["1.2", "Why do subset and permutation problems take exponential time?"],
    ["2.1", "Binary Watch", "LeetCode 401"],
    ["2.2", "Letter Case Permutation", "LeetCode 784"],
    ["3.1", "Permutations", "LeetCode 46"],
    ["3.2", "Combination Sum", "LeetCode 39"],
    ["4.1", "N-Queens", "LeetCode 51"],
  ],
  "Level 5|AdHoc": [
    ["1.1", "How do you approach a problem that fits no known pattern?"],
    ["1.1", "How do small cases help you find a pattern?"],
    ["1.2", "How do the input limits hint at the expected complexity?"],
    ["2.1", "Fizz Buzz", "LeetCode 412"],
    ["2.2", "Robot Return to Origin", "LeetCode 657"],
    ["3.1", "Rotate Image", "LeetCode 48"],
    ["3.2", "Set Matrix Zeroes", "LeetCode 73"],
    ["4.1", "First Missing Positive", "LeetCode 41"],
  ],

  // ---------------------------------------------------------------- Level 6
  "Level 6|Dynamic Programming": [
    ["1.1", "What are overlapping subproblems and optimal substructure?"],
    ["1.1", "How is memoisation different from tabulation?"],
    ["1.2", "How do you work out a DP solution's time from its states and transitions?"],
    ["2.1", "Min Cost Climbing Stairs", "LeetCode 746"],
    ["2.2", "N-th Tribonacci Number", "LeetCode 1137"],
    ["3.1", "House Robber", "LeetCode 198"],
    ["3.2", "Coin Change", "LeetCode 322"],
    ["4.1", "Edit Distance", "LeetCode 72"],
  ],

  // ---------------------------------------------------------------- Level 7
  "Level 7|Binary Trees": [
    ["1.1", "What are preorder, inorder and postorder traversals?"],
    ["1.1", "How do you find the height of a binary tree?"],
    ["1.2", "Why does a recursive traversal use O(h) extra space?"],
    ["2.1", "Maximum Depth of Binary Tree", "LeetCode 104"],
    ["2.2", "Invert Binary Tree", "LeetCode 226"],
    ["3.1", "Binary Tree Level Order Traversal", "LeetCode 102"],
    ["3.2", "Lowest Common Ancestor of a Binary Tree", "LeetCode 236"],
    ["4.1", "Binary Tree Maximum Path Sum", "LeetCode 124"],
  ],
  "Level 7|Binary Search Trees": [
    ["1.1", "What property makes a binary tree a BST?"],
    ["1.1", "How do you search for a value in a BST?"],
    ["1.2", "Why can a BST operation be O(n) in the worst case?"],
    ["2.1", "Search in a Binary Search Tree", "LeetCode 700"],
    ["2.2", "Range Sum of BST", "LeetCode 938"],
    ["3.1", "Validate Binary Search Tree", "LeetCode 98"],
    ["3.2", "Kth Smallest Element in a BST", "LeetCode 230"],
    ["4.1", "Maximum Sum BST in Binary Tree", "LeetCode 1373"],
  ],
  "Level 7|Graphs": [
    ["1.1", "How do you store a graph as an adjacency list?"],
    ["1.1", "How is BFS different from DFS?"],
    ["1.2", "Why are BFS and DFS O(V + E)?"],
    ["2.1", "Find if Path Exists in Graph", "LeetCode 1971"],
    ["2.2", "Find the Town Judge", "LeetCode 997"],
    ["3.1", "Number of Islands", "LeetCode 200"],
    ["3.2", "Course Schedule", "LeetCode 207"],
    ["4.1", "Word Ladder", "LeetCode 127"],
  ],
  "Level 7|Advanced Graph": [
    ["1.1", "How does Dijkstra's algorithm find shortest paths?"],
    ["1.1", "What is a minimum spanning tree?"],
    ["1.2", "Why does Dijkstra need a priority queue to be fast?"],
    ["2.1", "Find Center of Star Graph", "LeetCode 1791"],
    ["2.2", "Find the center of a star graph given as an adjacency list", "Tweak of 1791"],
    ["3.1", "Network Delay Time", "LeetCode 743"],
    ["3.2", "Min Cost to Connect All Points", "LeetCode 1584"],
    ["4.1", "Critical Connections in a Network", "LeetCode 1192"],
  ],
};

export const DEMO_QUESTION_BANK: Record<string, BankQuestion[]> = Object.fromEntries(
  Object.entries(DEMO).map(([key, rows]) => [key, rows.map(([step, title, source = ""]) => ({ title, step, source }))]),
);
