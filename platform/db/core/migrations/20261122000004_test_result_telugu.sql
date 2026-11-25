/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- The instructor's own Telugu wording of a result's text feedback, keyed by format field id, for the
-- Telugu student report (modules/tests/student-report.ts). Nothing is machine-translated: a field
-- without Telugu text shows the English the instructor wrote, marked as written in English.
ALTER TABLE core.test_results ADD COLUMN values_te jsonb CHECK (values_te IS NULL OR jsonb_typeof(values_te) = 'object');
COMMENT ON COLUMN core.test_results.values_te IS 'Telugu text feedback written by the instructor: {"<field id>": "<text>"}';

-- migrate:down
ALTER TABLE core.test_results DROP COLUMN values_te;
