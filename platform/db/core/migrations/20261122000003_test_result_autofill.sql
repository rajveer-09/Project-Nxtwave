/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Weekly test results keep what was filled in automatically when the instructor saved them:
-- attendance this semester and in the week up to the test day, and the student's roadmap progress
-- (modules/tests/autofill.ts). Reports of past tests then show what was true at the time.
ALTER TABLE core.test_results ADD COLUMN auto jsonb CHECK (auto IS NULL OR jsonb_typeof(auto) = 'object');
COMMENT ON COLUMN core.test_results.auto IS
  'Filled in on save: {semester, week: {present, counted, pct}, progress: {level, topic, subtopic, step, percent, ...}, asOf}';

-- migrate:down
ALTER TABLE core.test_results DROP COLUMN auto;
