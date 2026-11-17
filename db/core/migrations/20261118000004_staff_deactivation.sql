/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Deactivation and deletion of staff. Admins deactivate (the person can't sign in at once); the
-- deactivated list goes to super admins, who reactivate or delete. Deleting keeps the row (so the
-- change log and assignment history still name the person) but removes sign-in, roles and email.

ALTER TABLE core.staff
  ADD COLUMN deactivated_at       timestamptz,
  ADD COLUMN deactivated_by       bigint,
  ADD COLUMN deactivated_by_name  text,
  ADD COLUMN deleted_at           timestamptz;
CREATE INDEX staff_deactivated_idx ON core.staff (deactivated_at DESC) WHERE NOT active AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION core.log_staff() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM core.write_change('staff', 'added', NULL, NEW.id, NULL, NULL, NEW.name, jsonb_build_object('email', NEW.email::text));
  ELSE
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      PERFORM core.write_change('staff', 'deleted', NULL, NEW.id, NULL, NEW.name, NULL, jsonb_build_object('email', OLD.email::text));
      RETURN NULL;
    END IF;
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

DROP TRIGGER staff_change_log ON core.staff;
CREATE TRIGGER staff_change_log AFTER INSERT OR UPDATE OF active, left_on, name, email, password_hash, deleted_at ON core.staff
  FOR EACH ROW EXECUTE FUNCTION core.log_staff();

-- migrate:down
DROP TRIGGER staff_change_log ON core.staff;
CREATE TRIGGER staff_change_log AFTER INSERT OR UPDATE OF active, left_on, name, email, password_hash ON core.staff
  FOR EACH ROW EXECUTE FUNCTION core.log_staff();
DROP INDEX core.staff_deactivated_idx;
ALTER TABLE core.staff DROP COLUMN deleted_at, DROP COLUMN deactivated_by_name, DROP COLUMN deactivated_by, DROP COLUMN deactivated_at;
