/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Questions can sit on levels added on the Curriculum page (up to Level 15, as core.curriculum_levels).
ALTER TABLE core.curriculum_questions DROP CONSTRAINT curriculum_questions_level_check;
ALTER TABLE core.curriculum_questions ADD CONSTRAINT curriculum_questions_level_check CHECK (level BETWEEN 0 AND 15);

-- migrate:down
ALTER TABLE core.curriculum_questions DROP CONSTRAINT curriculum_questions_level_check;
ALTER TABLE core.curriculum_questions ADD CONSTRAINT curriculum_questions_level_check CHECK (level BETWEEN 0 AND 7);
