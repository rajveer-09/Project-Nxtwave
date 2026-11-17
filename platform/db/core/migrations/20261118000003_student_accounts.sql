/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Student sign-in (Phase 3). Students sign in with their NIAT ID and a password an admin issues;
-- they choose their own at first sign-in. Kept apart from staff: own table, own sessions, own cookie.

CREATE TABLE core.student_accounts (
  niat_id               text PRIMARY KEY REFERENCES core.students(niat_id) ON DELETE CASCADE,
  password_hash         text,
  must_change_password  boolean NOT NULL DEFAULT true,
  active                boolean NOT NULL DEFAULT true,
  session_version       integer NOT NULL DEFAULT 1,
  last_sign_in_at       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER student_accounts_updated_at BEFORE UPDATE ON core.student_accounts
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TABLE core.student_sessions (
  token_hash       text PRIMARY KEY,
  niat_id          text NOT NULL REFERENCES core.student_accounts(niat_id) ON DELETE CASCADE,
  session_version  integer NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  ip               inet,
  user_agent       text
);
CREATE INDEX student_sessions_student_idx ON core.student_sessions (niat_id);

-- Issuing, resetting, changing a password and switching access on or off are logged like any other change.
ALTER TABLE core.change_log DROP CONSTRAINT change_log_entity_check;
ALTER TABLE core.change_log ADD CONSTRAINT change_log_entity_check
  CHECK (entity IN ('student_assignment', 'student', 'attendance_student', 'staff_role', 'staff', 'student_account'));

CREATE FUNCTION core.log_student_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM core.write_change('student_account', 'created', NEW.niat_id, NULL, 'sign-in', NULL, 'enabled');
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM core.write_change('student_account', 'removed', OLD.niat_id, NULL, 'sign-in', 'enabled', NULL);
  ELSE
    IF OLD.active IS DISTINCT FROM NEW.active THEN
      PERFORM core.write_change('student_account', CASE WHEN NEW.active THEN 'enabled' ELSE 'disabled' END, NEW.niat_id, NULL, 'sign-in',
                                CASE WHEN OLD.active THEN 'enabled' ELSE 'disabled' END, CASE WHEN NEW.active THEN 'enabled' ELSE 'disabled' END);
    END IF;
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
      PERFORM core.write_change('student_account', CASE WHEN NEW.must_change_password THEN 'password_issued' ELSE 'password_changed' END,
                                NEW.niat_id, NULL, 'password', NULL, NULL);
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER student_accounts_change_log AFTER INSERT OR UPDATE OF active, password_hash OR DELETE ON core.student_accounts
  FOR EACH ROW EXECUTE FUNCTION core.log_student_account();

-- migrate:down
DROP TRIGGER student_accounts_change_log ON core.student_accounts;
DROP FUNCTION core.log_student_account();
DROP TABLE core.student_sessions, core.student_accounts;
ALTER TABLE core.change_log DROP CONSTRAINT change_log_entity_check;
ALTER TABLE core.change_log ADD CONSTRAINT change_log_entity_check
  CHECK (entity IN ('student_assignment', 'student', 'attendance_student', 'staff_role', 'staff'));
