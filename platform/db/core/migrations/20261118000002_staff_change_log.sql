/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Staff edits (added, activated / deactivated, renamed, email changed) go to the change log too.

ALTER TABLE core.change_log DROP CONSTRAINT change_log_entity_check;
ALTER TABLE core.change_log ADD CONSTRAINT change_log_entity_check
  CHECK (entity IN ('student_assignment', 'student', 'attendance_student', 'staff_role', 'staff'));

CREATE FUNCTION core.log_staff() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM core.write_change('staff', 'added', NULL, NEW.id, NULL, NULL, NEW.name, jsonb_build_object('email', NEW.email::text));
  ELSE
    IF OLD.active IS DISTINCT FROM NEW.active THEN
      PERFORM core.write_change('staff', CASE WHEN NEW.active THEN 'activated' ELSE 'deactivated' END, NULL, NEW.id, 'active', OLD.active::text, NEW.active::text);
    END IF;
    IF OLD.left_on IS DISTINCT FROM NEW.left_on THEN
      PERFORM core.write_change('staff', 'changed', NULL, NEW.id, 'left_on', OLD.left_on::text, NEW.left_on::text);
    END IF;
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      PERFORM core.write_change('staff', 'changed', NULL, NEW.id, 'name', OLD.name, NEW.name);
    END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      PERFORM core.write_change('staff', 'changed', NULL, NEW.id, 'email', OLD.email::text, NEW.email::text);
    END IF;
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
      PERFORM core.write_change('staff', 'changed', NULL, NEW.id, 'password', NULL, NULL);
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER staff_change_log AFTER INSERT OR UPDATE OF active, left_on, name, email, password_hash ON core.staff
  FOR EACH ROW EXECUTE FUNCTION core.log_staff();

-- migrate:down
DROP TRIGGER staff_change_log ON core.staff;
DROP FUNCTION core.log_staff();
ALTER TABLE core.change_log DROP CONSTRAINT change_log_entity_check;
ALTER TABLE core.change_log ADD CONSTRAINT change_log_entity_check
  CHECK (entity IN ('student_assignment', 'student', 'attendance_student', 'staff_role'));
