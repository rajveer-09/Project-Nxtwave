/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- First sign-in. Until someone has chosen their own NxtOne password they can sign in with the
-- shared default (FIRST_PASSWORD in platform/web/common/auth/core/password.ts), and the first page
-- they see asks them to choose one. Staff: must_set_password below. Students: an account without a
-- password (core.student_accounts.password_hash NULL), created on their first sign-in, or no
-- account yet. Choosing a password clears the flag and signs out every other session.

ALTER TABLE core.staff ADD COLUMN must_set_password boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN core.staff.must_set_password IS
  'true until the person chooses their own NxtOne password; meanwhile the default first password is accepted';

-- migrate:down
ALTER TABLE core.staff DROP COLUMN must_set_password;
