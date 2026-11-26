-- Level 0 interaction sheet → Curriculum (core.curriculum_blocks + core.curriculum_questions).
--
-- Every block is one row of the sheet with its columns as written (step, step-wise rating, how many
-- to ask, hints, revisit, suggested time, expectation & when to stop); every question is from the
-- sheet's pool, word for word. Nothing else is added. A question's title is one line (logged
-- interactions keep their questions one per line); when the sheet's text runs over several lines,
-- the full text is its body (shown under "Show full question").
--
-- Also: the 12 "Dummy seed" placeholder questions of Level 0 move to a new BONUS topic (copied there,
-- originals archived, so they can be restored).
--
-- Needs migration 20261127000001_curriculum_blocks. Safe to run again: fixed ids, ON CONFLICT DO NOTHING.
-- The change log records it as an Excel import ("Level 0 interaction sheet") by soumya ranjan sahoo.
-- Run as the web app's database role (web_svc) or the owner:
--   psql "$WEB_DATABASE_URL" -v ON_ERROR_STOP=1 -f platform/db/content/20261127_level0_interaction_sheet.sql

BEGIN;

SELECT set_config('app.source', 'excel', true),
       set_config('app.source_detail', 'Level 0 interaction sheet', true),
       set_config('app.actor_staff_id', COALESCE((SELECT id::text FROM core.staff WHERE lower(name) = 'soumya ranjan sahoo' LIMIT 1), ''), true),
       set_config('app.actor_name', 'soumya ranjan sahoo', true),
       set_config('app.actor_email', COALESCE((SELECT lower(email::text) FROM core.staff WHERE lower(name) = 'soumya ranjan sahoo' LIMIT 1), ''), true),
       set_config('app.actor_role', 'admin', true);

-- ---------------------------------------------------------------- blocks (the sheet's rows)

INSERT INTO core.curriculum_blocks (id, level, topic_id, position, step, rating_step, pool_note, ask, hints, revisit, minutes, expectation, created_by)
SELECT b.id, 0, t.id, b.position, b.step, b.rating_step, b.pool_note, b.ask, b.hints, b.revisit, b.minutes, b.expectation, 'soumya ranjan sahoo'
FROM (VALUES
  ('b-l0-step0', NULL, 0, '0', 'NOT APPLICABLE',
   $t$Programming Language is not a theory validated topic.
No conceptual or complexity questions are asked. Skip directly to Step 2.$t$,
   '', '', '', '', ''),

  ('b-l0-intro', 'Introduction', 1, '1', '1.0 Introduction', '',
   'as much as you can', '', '', '', ''),

  ('b-l0-datatypes', 'Data Types', 1, '1', '1.1 - Data Types', '',
   'pick any 5', $t$If need, one hint or two hints are given based on student's logic & progress$t$, 'Mandatory to complete this step', '20-25',
   $t$(should answer 4/5)Here student should be able take input & print requied output for all the questions asked.
If student is not solve, students needs to revist "1.1 - Data Types"
and stop the interaction$t$),

  ('b-l0-ifelse', 'If else', 1, '1', '1.2 If else', '',
   'pick any 2', $t$If need, one hint or two hints are given based on student's logic & progress$t$, 'Mandatory to complete this step', '15-20',
   $t$Here sudent should write the correct with proper explanation;
If student is not able to solve, student needs to revist "1.2 - If else Conditions"
and stop the interaction$t$),

  ('b-l0-loops', 'Loops', 1, '1', '1.3 Loops', '',
   'pick any 2', $t$If need, one hint or two hints are given based on student's logic & progress$t$, 'Mandatory to complete this step', '15-20',
   $t$Here sudent should write the correct with proper explanation;
If student is not able to solve, student needs to revist "1.3 Loops"
and stop the interaction$t$),

  ('b-l0-traversal', 'Traversal', 1, '2', 'Traversal', '',
   'pick any 2', 'NO hints are given', 'Mandatory to complete this step', '',
   $t$Here sudent should write the correct with proper explanation;
If student is not able to solve, student needs to revist " Traversal"
and stop the interaction$t$),

  ('b-l0-traversal-arrays', 'Traversal', 2, '2', '', '',
   'pick any 1', 'NO hints are given', 'Mandatory to complete this step', '10-15', ''),

  ('b-l0-complexity-1', 'Time & Space Complexity analysis', 1, '3', 'Time & Space Complexity analysis', '',
   'pick any 1', 'NO hints are given', 'Mandatory to complete this step', '',
   $t$Student should be manually explain the answer using pen & paper;
In case of failing to do so, ask to revist "Time & Space Complexity
analysis" and stop interaction. Also suggest to watch Time & Space Complexity
analysis Video on LaunchPad$t$),

  ('b-l0-complexity-2', 'Time & Space Complexity analysis', 2, '3', '', '',
   'pick any 1', '', '', '', ''),

  ('b-l0-complexity-advanced', 'Time & Space Complexity analysis', 3, '3', 'Time & Space Complexity analysis', '',
   'pick any 1', 'Can encourage student but no hints', 'NOT Mandatory to complete this step', '',
   'Student should be manually explain the answer using pen & paper'),

  ('b-l0-patterns', 'Pattern Questions', 1, '4', 'Pattern Questions', '',
   'pick any 2', $t$If need, one hint or two hints are given based on student's logic & progress$t$, 'Mandatory to complete this step', '',
   $t$Student is expected to explain (pen & paper) and solve questions with atmost one or two hints
In case of failing to do so, ask to revist "Pattern Questions" and stop interaction.$t$)
) AS b(id, topic, position, step, rating_step, pool_note, ask, hints, revisit, minutes, expectation)
LEFT JOIN core.curriculum_topics t ON t.level = 0 AND t.name = b.topic
WHERE b.topic IS NULL OR t.id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- questions (the sheet's pools)

INSERT INTO core.curriculum_questions (id, level, topic, subtopic, step, title, source, url, notes, origin, created_by, block_id, pool_group, position, body)
SELECT q.id, 0, b.topic, NULL, '', q.title, '', q.url, '', 'roadmap', 'soumya ranjan sahoo', q.block, q.grp, q.pos, q.body
FROM (VALUES
  -- 1.0 Introduction
  ('l0-intro-01', 'b-l0-intro', 1, '', 'What is a programming language?', '', ''),
  ('l0-intro-02', 'b-l0-intro', 2, '', 'why do we write #include <iostream>?', '', ''),
  ('l0-intro-03', 'b-l0-intro', 3, '', 'What is the purpose of the main() function?', '', ''),
  ('l0-intro-04', 'b-l0-intro', 4, '', 'What is a header file?', '', ''),
  ('l0-intro-05', 'b-l0-intro', 5, '', 'How do you print output in C++?', '', ''),
  ('l0-intro-06', 'b-l0-intro', 6, '', 'How do you read input in C++?', '', ''),
  ('l0-intro-07', 'b-l0-intro', 7, '', 'What is the difference between cin and cout?', '', ''),
  ('l0-intro-08', 'b-l0-intro', 8, '', 'purpose of semicolon.', '', ''),
  ('l0-intro-09', 'b-l0-intro', 9, '', 'How do you take multiple inputs in one line?', '', ''),
  ('l0-intro-10', 'b-l0-intro', 10, '', 'What does endl do?', '', ''),
  ('l0-intro-11', 'b-l0-intro', 11, '', 'What is the size of int?', '', ''),
  ('l0-intro-12', 'b-l0-intro', 12, '', 'What is the size of char?', '', ''),
  ('l0-intro-13', 'b-l0-intro', 13, '', 'What is the purpose of bool?', '', ''),
  ('l0-intro-14', 'b-l0-intro', 14, '', 'What values can a bool store?', '', ''),
  ('l0-intro-15', 'b-l0-intro', 15, '', 'What is type casting?', '', ''),
  ('l0-intro-16', 'b-l0-intro', 16, '', 'What is the ASCII value of A?', '', ''),
  ('l0-intro-17', 'b-l0-intro', 17, '', 'What is the difference between single quotes and double quotes?', '', ''),
  ('l0-intro-18', 'b-l0-intro', 18, '', 'What is the difference between a variable and a constant?', '', ''),

  -- 1.1 - Data Types
  ('l0-dt-01', 'b-l0-datatypes', 1, '', '1. Big Sum - Read two integers that may be as large as 10^18. Print their sum.', '', ''),
  ('l0-dt-02', 'b-l0-datatypes', 2, '', '2. Float Equality - Read three floating point numbers. Print YES if the sum of the first two equals the third within a tolerance of 1e-6, else NO.', '', ''),
  ('l0-dt-03', 'b-l0-datatypes', 3, '', '3.Shift the Letter - Read a lowercase letter. Print the letter three positions ahead in the alphabet, wrapping around after z.', '', ''),
  ('l0-dt-04', 'b-l0-datatypes', 4, '', '4. Division Trap - Read two integers. Print their integer division result and their true floating point division result on separate lines.', '', ''),
  ('l0-dt-05', 'b-l0-datatypes', 5, '', '5. ASCII Neighbour - Read a single character. Print its ASCII code and the character whose code is one greater.', '', ''),
  ('l0-dt-06', 'b-l0-datatypes', 6, '', '6. Truthy Print - Read an integer. Print 1 if it is non zero and 0 otherwise, without using an if statement.', '', ''),
  ('l0-dt-07', 'b-l0-datatypes', 7, '', '7. Fits in 32 Bits - Read an integer. Print YES if it fits in a 32 bit signed integer, else NO.', '', ''),
  ('l0-dt-08', 'b-l0-datatypes', 8, '', '8. Three Roundings - Read a floating point number. Print its floor, its ceiling and its nearest rounded value on separate lines.', '', ''),
  ('l0-dt-09', 'b-l0-datatypes', 9, '', '9. Triple Product Overflow - Read three integers, each up to 10^6. Print their product.', '', ''),
  ('l0-dt-10', 'b-l0-datatypes', 10, '', '10. Digit Character to Number - Read a single digit character. Print twice its numeric value.', '', ''),
  ('l0-dt-11', 'b-l0-datatypes', 11, '', '11. Mixed Sum - Read one integer and one float. Print their sum correct to two decimal places.', '', ''),
  ('l0-dt-12', 'b-l0-datatypes', 12, '', '12. Negative Remainder - Read two integers where the first may be negative. Print the remainder when the first is divided by the second.', '', ''),
  ('l0-dt-13', 'b-l0-datatypes', 13, '', '13. Long Factorial - Read an integer n where n is at most 20. Print n factorial.', '', ''),
  ('l0-dt-14', 'b-l0-datatypes', 14, '', '14. Average of Three - Read three integers. Print their average correct to two decimal places.', '', ''),
  ('l0-dt-15', 'b-l0-datatypes', 15, '', '15. Char Sum - Read two lowercase letters. Print the sum of their positions in the alphabet.', '', ''),
  ('l0-dt-16', 'b-l0-datatypes', 16, '', '16. Fits in Unsigned Integer Range - Read an integer. Print YES if it fits in a unsigned integer range, else NO.', '', ''),
  ('l0-dt-17', 'b-l0-datatypes', 17, '', '17. Tell me the output --> int a = true, b = true -> tell the output for (a+b);', '', ''),
  ('l0-dt-18', 'b-l0-datatypes', 18, '', '18. Tell me the output --> float a = 6.753, --> if(a==6.753) output --> Yes or No', '', ''),

  -- 1.2 If else (two "Pick 1 from this ->" groups)
  ('l0-if-01', 'b-l0-ifelse', 1, 'Pick 1 from this ->', '1. Given 4 integer values find the largest and smallest value.', '', ''),
  ('l0-if-02', 'b-l0-ifelse', 2, 'Pick 1 from this ->', '2. Given an integer N the task is to print, "FizzBuzz" if N is divisible by 3 and 5, "Fizz" if N is divisible by 3, "Buzz" if N is divisible by 5 else N.', '',
   $t$2. Given an integer N the task is to print,
     "FizzBuzz" if N is divisible by 3 and 5,
     "Fizz" if N is divisible by 3,
     "Buzz" if N is divisible by 5
      else N.$t$),
  ('l0-if-03', 'b-l0-ifelse', 3, 'Pick 1 from this ->', '3. Take three side lengths as input. First, determine if they can form a valid triangle. If they can, classify the triangle as Equilateral, Isosceles, or Scalene.', '',
   $t$3. Take three side lengths as input. First, determine if they can form a valid triangle.
If they can, classify the triangle as Equilateral, Isosceles, or Scalene.$t$),
  ('l0-if-04', 'b-l0-ifelse', 4, 'Pick 1 from this ->', '4. Loan Eligibility Checker', '',
   $t$4. Loan Eligibility Checker
A bank evaluates a loan application using these rules:
- If age < 18, the loan is Rejected (Underage).
- Otherwise, if income < 20000, it is Rejected (Low Income).
- Otherwise, if credit_score < 600, it is Rejected (Poor Credit).
- Otherwise, if credit_score is between 600 and 749 (inclusive), it is Approved at Standard Rate.
- Otherwise (credit_score >= 750), if existing_loans > 2, it is Approved at Standard Rate; else it is Approved at Premium Rate.

Input: age, income, credit_score, existing_loans
Output: the loan decision string$t$),
  ('l0-if-05', 'b-l0-ifelse', 5, 'Pick 1 from this ->', '5. Exam Result with Re-evaluation Rule', '',
   $t$5. Exam Result with Re-evaluation Rule
A college computes results using these rules:
- If total_marks is less than 0 or greater than 300, print Invalid Marks.
- Otherwise, if attendance < 75, print Debarred.
- Otherwise, if total_marks < 105, print Fail.
- Otherwise, if total_marks is between 105 and 179 (inclusive): print Fail (Backlog) if backlog_subjects > 0, else print Pass.
- Otherwise (total_marks >= 180): print Distinction if total_marks >= 270, else print First Class.

Input: total_marks, attendance, backlog_subjects
Output: the result string$t$),
  ('l0-if-06', 'b-l0-ifelse', 6, 'Pick 1 from this ->', 'https://atcoder.jp/contests/abc132/tasks/abc132_a', 'https://atcoder.jp/contests/abc132/tasks/abc132_a', ''),
  ('l0-if-07', 'b-l0-ifelse', 7, 'Pick 1 from this ->', 'https://codeforces.com/problemset/problem/4/A', 'https://codeforces.com/problemset/problem/4/A', ''),
  ('l0-if-08', 'b-l0-ifelse', 8, 'Pick 1 from this ->', 'https://atcoder.jp/contests/abc471/tasks/abc471_a', 'https://atcoder.jp/contests/abc471/tasks/abc471_a', ''),
  ('l0-if-09', 'b-l0-ifelse', 9, 'Pick 1 from this ->', 'https://atcoder.jp/contests/abc467/tasks/abc467_a', 'https://atcoder.jp/contests/abc467/tasks/abc467_a', ''),
  ('l0-if-10', 'b-l0-ifelse', 10, 'Pick 1 from this ->', 'https://atcoder.jp/contests/abc463/tasks/abc463_a', 'https://atcoder.jp/contests/abc463/tasks/abc463_a', ''),
  ('l0-if-11', 'b-l0-ifelse', 11, 'Pick 1 from this ->', 'https://www.codechef.com/problems/FLOW017', 'https://www.codechef.com/problems/FLOW017', ''),
  ('l0-if-12', 'b-l0-ifelse', 12, 'Pick 1 from this ->', 'https://atcoder.jp/contests/abc080/tasks/abc080_a', 'https://atcoder.jp/contests/abc080/tasks/abc080_a', ''),

  -- 1.3 Loops
  ('l0-loop-01', 'b-l0-loops', 1, '', '1. Print 1 to N (or) N to 1', '', ''),
  ('l0-loop-02', 'b-l0-loops', 2, '', '2. Print 10 table', '', ''),
  ('l0-loop-03', 'b-l0-loops', 3, '', '3. Print first K even / odd number with operations as K or 2*K;', '', ''),
  ('l0-loop-04', 'b-l0-loops', 4, '', '4. check if number is prime.', '', ''),
  ('l0-loop-05', 'b-l0-loops', 5, '', '5. Print divisors of N;', '', ''),
  ('l0-loop-06', 'b-l0-loops', 6, '', '6. What is the product from 1 to 20.', '', ''),
  ('l0-loop-07', 'b-l0-loops', 7, '', '7. take input N from user and Print 0 - N even numbers  without using if - else', '', ''),

  -- 2 Traversal
  ('l0-trav-01', 'b-l0-traversal', 1, '', '1. Print 1 to N (or) N to 1', '', ''),
  ('l0-trav-02', 'b-l0-traversal', 2, '', '2. Print 10 table', '', ''),
  ('l0-trav-03', 'b-l0-traversal', 3, '', '3. Print first K even / odd number with operations as K or 2*K;', '', ''),
  ('l0-trav-04', 'b-l0-traversal', 4, '', '4. check if number is prime.', '', ''),
  ('l0-trav-05', 'b-l0-traversal', 5, '', '5. Print divisors of N;', '', ''),

  -- 2 Traversal (Array Traversal)
  ('l0-trav-arr-01', 'b-l0-traversal-arrays', 1, 'Array Traversal:', 'largest element', 'https://learning.ccbp.in/question/5fe9e4d2-b33f-498c-a769-faa9a9ca4475', ''),
  ('l0-trav-arr-02', 'b-l0-traversal-arrays', 2, 'Array Traversal:', 'smallest Element', 'https://learning.ccbp.in/question/cd5045a3-3c6d-464b-84aa-b2a971ead929', ''),
  ('l0-trav-arr-03', 'b-l0-traversal-arrays', 3, 'Array Traversal:', 'search element in an array', 'https://www.codechef.com/practice/course/arrays/ARRAYS/problems/SEARCHINARR', ''),
  ('l0-trav-arr-04', 'b-l0-traversal-arrays', 4, 'Array Traversal:', 'numbers with even digits', 'https://leetcode.com/problems/find-numbers-with-even-number-of-digits/', ''),

  -- 3 Time & Space Complexity analysis (Q1–Q5: pick any 1)
  ('l0-tsc-01', 'b-l0-complexity-1', 1, '', 'Q1 · Ops: how many times does sum = sum + i run for n = 10?', '',
   $t$Q1
sum = 0
for i = 1 to n:
    sum = sum + i
print sum

Ops: how many times does sum = sum + i run for n = 10?

Answer: 10 times (exactly n)

TC: O(n)
SC: O(1)$t$),
  ('l0-tsc-02', 'b-l0-complexity-1', 2, '', 'Q2 · Ops: how many prints for n = 5?', '',
   $t$Q2
for i = 1 to n:
    for j = 1 to n:
        print i, j

Ops: how many prints for n = 5?

Answer: 5 × 5 = 25 (n × n)

TC: O(n²)
SC: O(1)$t$),
  ('l0-tsc-03', 'b-l0-complexity-1', 3, '', 'Q3 · Ops: how many statements run if n = 1000?', '',
   $t$Q3
a = arr[0]
b = arr[n-1]
print a + b

Ops: how many statements run if n = 1000?

Answer: 3, regardless of n

TC: O(1)
SC: O(1)$t$),
  ('l0-tsc-04', 'b-l0-complexity-1', 4, '', 'Q4 · Ops: how many prints for n = 16?', '',
   $t$Q4
i = 1
while i < n:
    print i
    i = i * 2

Ops: how many prints for n = 16?

Answer: i takes the values 1, 2, 4, 8, so 4 prints (about log₂n)

TC: O(log n)
SC: O(1)$t$),
  ('l0-tsc-05', 'b-l0-complexity-1', 5, '', 'Q5 · Ops: how many assignments to result[i] for n = 8?', '',
   $t$Q5
create array result of size n
for i = 0 to n-1:
    result[i] = i * i
return result

Ops: how many assignments to result[i] for n = 8?

Answer: 8 (exactly n)

TC: O(n)
SC: O(n), because the new array grows with n$t$),

  -- 3 Time & Space Complexity analysis (Q6–Q9: pick any 1)
  ('l0-tsc-06', 'b-l0-complexity-2', 1, '', 'Q6 · Ops: how many stars for n = 5?', '',
   $t$Q6
for i = 1 to n:
    for j = 1 to i:
        print "*"

Ops: how many stars for n = 5?

Answer: 1 + 2 + 3 + 4 + 5 = 15, which is n(n+1)/2

TC: O(n²), since the n²/2 drops the constant
SC: O(1)$t$),
  ('l0-tsc-07', 'b-l0-complexity-2', 2, '', 'Q7 · Ops: how many total prints for n = 4?', '',
   $t$Q7
for i = 1 to n:
    print i

for i = 1 to n:
    for j = 1 to n:
        print i * j

Ops: how many total prints for n = 4?

Answer: 4 + 16 = 20, which is n + n²

TC: O(n + n²) = O(n²), since the biggest term wins
SC: O(1)$t$),
  ('l0-tsc-08', 'b-l0-complexity-2', 3, '', 'Q8 · Ops: how many prints for n = 8?', '',
   $t$Q8
for i = 1 to n:
    j = 1
    while j < n:
        print i, j
        j = j * 2

Ops: how many prints for n = 8?

Answer: the inner loop runs for j = 1, 2, 4, so 3 times per outer pass. 8 × 3 = 24, which is n × log n

TC: O(n log n)
SC: O(1)$t$),
  ('l0-tsc-09', 'b-l0-complexity-2', 4, '', 'Q9 · Ops: how many prints for n = 8?', '',
   $t$Q9
i = n
while i >= 1:
    for j = 1 to i:
        print j
    i = i / 2

Ops: how many prints for n = 8?

Answer:

When i = 8, the inner loop prints 8 times
When i = 4, it prints 4 times
When i = 2, it prints 2 times
When i = 1, it prints 1 time

Total: 8 + 4 + 2 + 1 = 15, which is about 2n − 1.

TC: O(n). It looks like O(n log n) because there's a loop inside a halving loop, but the inner loop shrinks each time. The total is n + n/2 + n/4 + ... ≈ 2n, and the constant drops.
SC: O(1)$t$),

  -- 3 Time & Space Complexity analysis (second set: not mandatory)
  ('l0-tsc-adv-01', 'b-l0-complexity-advanced', 1, '', 'Advanced Q1 · Ops: what is the final value of count for n = 16?', '',
   $t$Q1
count = 0
for (i = 1; i <= n; i = i * 2)
    for (j = 1; j <= i; j++)
        count++

Ops: what is the final value of count for n = 16?

What is the time complexity?
(A) O(log n) (B) O(n) (C) O(n log n) (D) O(n²)

Answer: (B)

i takes the values 1, 2, 4, 8, 16, so count = 1 + 2 + 4 + 8 + 16 = 31 (about 2n − 1)
It's a geometric series, dominated by its last term, so it sums to about 2n
TC: O(n)
SC: O(1)$t$),
  ('l0-tsc-adv-02', 'b-l0-complexity-advanced', 2, '', 'Advanced Q2 · Ops: how many prints for n = 4?', '',
   $t$Q2
for (i = 1; i <= n; i++)
    for (j = 1; j <= n; j = j + i)
        print(j)

Ops: how many prints for n = 4?

What is the time complexity?
(A) O(n) (B) O(n log n) (C) O(n²) (D) O(n√n)

Answer: (B)

i = 1 → 4 prints (j = 1, 2, 3, 4)
i = 2 → 2 prints (j = 1, 3)
i = 3 → 2 prints (j = 1, 4)
i = 4 → 1 print (j = 1)
Total = 9
The inner loop runs about n/i times, so the total is n(1 + 1/2 + 1/3 + ... + 1/n) = n · Hₙ ≈ n ln n
TC: O(n log n)
SC: O(1)$t$),
  ('l0-tsc-adv-03', 'b-l0-complexity-advanced', 3, '', 'Advanced Q3 · Ops: how many prints in total for n = 8?', '',
   $t$Q3
function f(n):
    if n <= 1:
        return
    f(n / 2)
    f(n / 2)
    for i = 1 to n:
        print(i)

Ops: how many prints in total for n = 8?

What are the time and space complexity?
(A) O(n), O(1) (B) O(n log n), O(log n) (C) O(n log n), O(n) (D) O(n²), O(log n)

Answer: (B)

Recurrence: T(n) = 2T(n/2) + n
T(8) = 2·T(4) + 8, T(4) = 2·T(2) + 4, T(2) = 2·T(1) + 2 = 2
So T(4) = 8 and T(8) = 16 + 8 = 24 (= n log₂n)
TC: O(n log n)
SC: O(log n). The recursion goes log n levels deep, and only one branch is active at a time.$t$),
  ('l0-tsc-adv-04', 'b-l0-complexity-advanced', 4, '', 'Advanced Q4 · Ops: how many iterations for n = 256?', '',
   $t$Q4
i = n
while (i > 2):
    i = sqrt(i)
    print(i)

Ops: how many iterations for n = 256?

What is the time complexity?
(A) O(log n) (B) O(√n) (C) O(log log n) (D) O(n)

Answer: (C)

256 → 16 → 4 → 2, then the loop stops, so 3 iterations
Taking a square root halves the exponent each time: if n = 2^k, then i = 2^(k/2), 2^(k/4), and so on
It takes about log₂k steps to reach 2, and k = log₂n, so the steps are log log n
TC: O(log log n)
SC: O(1)$t$),
  ('l0-tsc-adv-05', 'b-l0-complexity-advanced', 5, '', 'Advanced Q5 · Ops: how many array cells are created in total for n = 4?', '',
   $t$Q5
function h(n):
    if n <= 0:
        return
    create array A of size n     // all cells initialized
    h(n - 1)

Ops: how many array cells are created in total for n = 4?

What are the time and space complexity?
(A) O(n), O(n) (B) O(n²), O(n) (C) O(n²), O(n²) (D) O(n), O(n²)

Answer: (C)

Arrays of size 4, 3, 2, 1 are created, so 4 + 3 + 2 + 1 = 10 cells (n(n+1)/2)
TC: O(n²)
SC: O(n²). Each array stays alive on the stack until the deeper calls return, so all n arrays exist at the same time.$t$),
  ('l0-tsc-adv-06', 'b-l0-complexity-advanced', 6, '', 'Advanced Q6 · Arrange the following functions in increasing order of growth rate (log means log₂)', '',
   $t$Q6

Arrange the following functions in increasing order of growth rate (log means log₂):

f1 = n log n
f2 = 2ⁿ
f3 = n²
f4 = log n
f5 = √n
f6 = n!
f7 = log(log n)
f8 = n

Which option is correct?
(A) f7, f4, f5, f8, f1, f3, f2, f6
(B) f4, f7, f5, f8, f1, f3, f2, f6
(C) f7, f4, f8, f5, f1, f3, f6, f2
(D) f7, f4, f5, f8, f3, f1, f2, f6

Answer: (A)

Order: log log n < log n < √n < n < n log n < n² < 2ⁿ < n!$t$),
  ('l0-tsc-adv-07', 'b-l0-complexity-advanced', 7, '', 'Advanced Q7 · Arrange in increasing order of growth rate', '',
   $t$Q7

Arrange in increasing order of growth rate:

g1 = n!
g2 = n^(log n)
g3 = (log n)^100
g4 = 2ⁿ
g5 = n^100
g6 = 2^(√n)

Which option is correct?
(A) g3, g5, g2, g6, g4, g1
(B) g3, g5, g6, g2, g4, g1
(C) g5, g3, g2, g6, g4, g1
(D) g3, g2, g5, g6, g4, g1

Answer: (A)

Order: (log n)¹⁰⁰ < n¹⁰⁰ < n^(log n) < 2^(√n) < 2ⁿ < n!$t$),

  -- 4 Pattern Questions
  ('l0-pat-01', 'b-l0-patterns', 1, '', 'Square Star Pattern', 'https://learning.ccbp.in/question/8de97549-78ae-48c8-aba3-ba84c7471a88', ''),
  ('l0-pat-02', 'b-l0-patterns', 2, '', 'Right Triangle with column numbers', 'https://learning.ccbp.in/question/b241d749-c7dd-4ae9-9ebc-5e5674048dc9', ''),
  ('l0-pat-03', 'b-l0-patterns', 3, '', 'Inverted Right angled Number Pattern', 'https://learning.ccbp.in/question/12b1e904-7213-44a0-a475-af791b4794a2', ''),
  ('l0-pat-04', 'b-l0-patterns', 4, '', 'Inverted centered Right Triangle', 'https://learning.ccbp.in/question/39bac20d-b169-41dd-89a5-96c5ef1d22bf', ''),
  ('l0-pat-05', 'b-l0-patterns', 5, '', 'Alternating Binary Triangle Pattern', 'https://learning.ccbp.in/question/eb4001f2-b8c6-4af9-beb6-b85a5869db77', ''),
  ('l0-pat-06', 'b-l0-patterns', 6, '', 'combined Triangle Pattern With Gap', 'https://learning.ccbp.in/question/7f3c9f77-90d2-4a86-b7a8-6699ebbb6f06', ''),
  ('l0-pat-07', 'b-l0-patterns', 7, '', 'Ascending upper case letter Triangle', 'https://learning.ccbp.in/question/6cc87875-d976-4b81-a11e-287c7843e84d', ''),
  ('l0-pat-08', 'b-l0-patterns', 8, '', 'Hour Glass Pattern', 'https://learning.ccbp.in/question/7f2e308e-7250-4ab4-97c0-044fd859d98c', ''),
  ('l0-pat-09', 'b-l0-patterns', 9, '', 'Concentric Square Pattern', 'https://learning.ccbp.in/question/95f75d58-cb05-48a4-811a-3d38545f6174', '')
) AS q(id, block, pos, grp, title, url, body)
JOIN (SELECT b.id, t.name AS topic FROM core.curriculum_blocks b JOIN core.curriculum_topics t ON t.id = b.topic_id) b ON b.id = q.block
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- BONUS (the earlier placeholders)

INSERT INTO core.curriculum_topics (level, name, position, required, created_by)
SELECT 0, 'BONUS', (SELECT COALESCE(max(position), 0) + 1 FROM core.curriculum_topics WHERE level = 0), false, 'soumya ranjan sahoo'
WHERE NOT EXISTS (SELECT 1 FROM core.curriculum_topics WHERE level = 0 AND lower(name) = 'bonus');

INSERT INTO core.curriculum_questions (id, level, topic, subtopic, step, title, source, url, notes, origin, created_by)
SELECT 'bonus-' || q.id, 0, 'BONUS', NULL, '', q.title, q.source, q.url, 'Was in ' || q.topic, 'roadmap', 'soumya ranjan sahoo'
FROM core.curriculum_questions q
WHERE q.level = 0 AND q.created_by = 'Dummy seed' AND q.topic <> 'BONUS'
ON CONFLICT (id) DO NOTHING;

UPDATE core.curriculum_questions SET archived = true
WHERE level = 0 AND created_by = 'Dummy seed' AND topic <> 'BONUS' AND NOT archived;

COMMIT;
