/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Phase 1: success coach role, and an append-only change log that records every change to who
-- teaches whom, to a student's class (college / section / hall / status) and to staff roles,
-- whoever makes it: the web app, an Excel import, a backend service or a direct database edit.
--
-- How a writer says who it is: inside its transaction it sets
--   app.source          ui | excel | interactions-api | attendance-api | contest-api | migration
--   app.source_detail   e.g. the file name of an import
--   app.actor_staff_id, app.actor_name, app.actor_email, app.actor_role
-- with set_config(..., true). Nothing set means a direct database edit: source 'database' and the
-- database user and application name are recorded instead.

ALTER TABLE core.staff_roles DROP CONSTRAINT staff_roles_role_check;
ALTER TABLE core.staff_roles ADD CONSTRAINT staff_roles_role_check
  CHECK (role IN ('owner', 'admin', 'senior_instructor', 'instructor', 'success_coach', 'viewer'));

CREATE TABLE core.change_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at              timestamptz NOT NULL DEFAULT now(),
  txid            bigint NOT NULL DEFAULT txid_current(),  -- rows from one change share it (e.g. end + start of an assignment)
  source          text NOT NULL,
  source_detail   text,
  actor_staff_id  bigint,                                   -- no foreign key: the log outlives staff rows
  actor_name      text,
  actor_email     text,
  actor_role      text,
  entity          text NOT NULL CHECK (entity IN ('student_assignment', 'student', 'attendance_student', 'staff_role')),
  action          text NOT NULL,
  niat_id         text,
  staff_id        bigint,
  field           text,
  old_value       text,
  new_value       text,
  detail          jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX change_log_at_idx ON core.change_log (at DESC);
CREATE INDEX change_log_student_idx ON core.change_log (niat_id, at DESC) WHERE niat_id IS NOT NULL;
CREATE INDEX change_log_staff_idx ON core.change_log (staff_id, at DESC) WHERE staff_id IS NOT NULL;

-- Who is making the change in this transaction (see the header).
CREATE FUNCTION core.change_context(
  OUT source text, OUT source_detail text, OUT actor_staff_id bigint, OUT actor_name text, OUT actor_email text, OUT actor_role text)
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.source', true), ''), 'database'),
         CASE WHEN NULLIF(current_setting('app.source', true), '') IS NULL
              THEN session_user || COALESCE(' · ' || NULLIF(current_setting('application_name', true), ''), '')
              ELSE NULLIF(current_setting('app.source_detail', true), '') END,
         CASE WHEN current_setting('app.actor_staff_id', true) ~ '^[0-9]{1,18}$' THEN current_setting('app.actor_staff_id', true)::bigint END,
         NULLIF(current_setting('app.actor_name', true), ''),
         NULLIF(current_setting('app.actor_email', true), ''),
         NULLIF(current_setting('app.actor_role', true), '')
$$;

-- The only way rows get into the log. Runs as the owner, so writers need no rights on the table.
CREATE FUNCTION core.write_change(p_entity text, p_action text, p_niat text, p_staff bigint, p_field text,
                                  p_old text, p_new text, p_detail jsonb DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM core.change_context();
  INSERT INTO core.change_log (source, source_detail, actor_staff_id, actor_name, actor_email, actor_role,
                               entity, action, niat_id, staff_id, field, old_value, new_value, detail)
  VALUES (c.source, c.source_detail, c.actor_staff_id, c.actor_name, c.actor_email, c.actor_role,
          p_entity, p_action, p_niat, p_staff, p_field, p_old, p_new, COALESCE(p_detail, '{}'));
END $$;
REVOKE ALL ON FUNCTION core.write_change(text, text, text, bigint, text, text, text, jsonb) FROM PUBLIC;

-- ---------------------------------------------------------------- triggers on core

CREATE FUNCTION core.log_student_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
DECLARE old_name text; new_name text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN SELECT name INTO old_name FROM core.staff WHERE id = OLD.staff_id; END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN SELECT name INTO new_name FROM core.staff WHERE id = NEW.staff_id; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM core.write_change('student_assignment', 'assigned', NEW.niat_id, NEW.staff_id, NEW.kind, NULL, new_name,
                              jsonb_build_object('from_date', NEW.from_date, 'to_date', NEW.to_date));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM core.write_change('student_assignment', 'removed', OLD.niat_id, OLD.staff_id, OLD.kind, old_name, NULL,
                              jsonb_build_object('from_date', OLD.from_date, 'to_date', OLD.to_date));
  ELSIF OLD.staff_id IS DISTINCT FROM NEW.staff_id THEN
    PERFORM core.write_change('student_assignment', 'changed', NEW.niat_id, NEW.staff_id, NEW.kind, old_name, new_name,
                              jsonb_build_object('from_date', NEW.from_date, 'previous_staff_id', OLD.staff_id));
  ELSIF OLD.to_date IS NULL AND NEW.to_date IS NOT NULL THEN
    PERFORM core.write_change('student_assignment', 'ended', NEW.niat_id, NEW.staff_id, NEW.kind, old_name, NULL,
                              jsonb_build_object('from_date', NEW.from_date, 'to_date', NEW.to_date));
  ELSIF OLD.to_date IS DISTINCT FROM NEW.to_date OR OLD.from_date IS DISTINCT FROM NEW.from_date THEN
    PERFORM core.write_change('student_assignment', 'dates_changed', NEW.niat_id, NEW.staff_id, NEW.kind,
                              OLD.from_date || ' → ' || COALESCE(OLD.to_date::text, 'now'), NEW.from_date || ' → ' || COALESCE(NEW.to_date::text, 'now'));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER student_assignments_change_log AFTER INSERT OR UPDATE OR DELETE ON core.student_assignments
  FOR EACH ROW EXECUTE FUNCTION core.log_student_assignment();

CREATE FUNCTION core.log_student() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM core.write_change('student', 'added', NEW.niat_id, NULL, NULL, NULL, NEW.full_name,
                              jsonb_build_object('college', NEW.college, 'section', NEW.section, 'hall', NEW.hall));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM core.write_change('student', 'removed', OLD.niat_id, NULL, NULL, OLD.full_name, NULL,
                              jsonb_build_object('college', OLD.college, 'section', OLD.section, 'hall', OLD.hall));
  ELSE
    IF OLD.college IS DISTINCT FROM NEW.college THEN PERFORM core.write_change('student', 'changed', NEW.niat_id, NULL, 'college', OLD.college, NEW.college); END IF;
    IF OLD.section IS DISTINCT FROM NEW.section THEN PERFORM core.write_change('student', 'changed', NEW.niat_id, NULL, 'section', OLD.section, NEW.section); END IF;
    IF OLD.hall IS DISTINCT FROM NEW.hall THEN PERFORM core.write_change('student', 'changed', NEW.niat_id, NULL, 'hall', OLD.hall, NEW.hall); END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN PERFORM core.write_change('student', 'changed', NEW.niat_id, NULL, 'status', OLD.status, NEW.status); END IF;
    IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN PERFORM core.write_change('student', 'changed', NEW.niat_id, NULL, 'name', OLD.full_name, NEW.full_name); END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER students_change_log AFTER INSERT OR UPDATE OR DELETE ON core.students
  FOR EACH ROW EXECUTE FUNCTION core.log_student();

CREATE FUNCTION core.log_staff_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM core.write_change('staff_role', 'granted', NULL, NEW.staff_id, NEW.module, NULL, NEW.role);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM core.write_change('staff_role', 'revoked', NULL, OLD.staff_id, OLD.module, OLD.role, NULL);
  ELSIF OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM core.write_change('staff_role', 'changed', NULL, NEW.staff_id, NEW.module, OLD.role, NEW.role);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER staff_roles_change_log AFTER INSERT OR UPDATE OR DELETE ON core.staff_roles
  FOR EACH ROW EXECUTE FUNCTION core.log_staff_role();

-- ---------------------------------------------------------------- one place that changes assignments

-- Makes p_staff the student's current assignment of this kind (NULL = no one), keeping history:
-- the current row is ended today and a new one starts today. Changing twice on the same day
-- replaces today's row. Does nothing when it's already so.
CREATE FUNCTION core.assign_staff(p_niat text, p_kind text, p_staff bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
DECLARE cur record; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  p_niat := upper(btrim(p_niat));
  IF p_kind NOT IN ('instructor', 'poc', 'coach') THEN RAISE EXCEPTION 'unknown assignment kind %', p_kind; END IF;
  IF NOT EXISTS (SELECT 1 FROM core.students WHERE niat_id = p_niat) THEN RAISE EXCEPTION 'unknown student %', p_niat; END IF;
  SELECT * INTO cur FROM core.student_assignments WHERE niat_id = p_niat AND kind = p_kind AND to_date IS NULL FOR UPDATE;
  IF FOUND AND cur.staff_id IS NOT DISTINCT FROM p_staff THEN RETURN false; END IF;
  IF NOT FOUND AND p_staff IS NULL THEN RETURN false; END IF;

  IF FOUND AND cur.from_date >= today THEN
    IF p_staff IS NULL THEN
      DELETE FROM core.student_assignments WHERE niat_id = p_niat AND kind = p_kind AND from_date = cur.from_date;
    ELSE
      UPDATE core.student_assignments SET staff_id = p_staff WHERE niat_id = p_niat AND kind = p_kind AND from_date = cur.from_date;
    END IF;
    RETURN true;
  END IF;
  IF FOUND THEN
    UPDATE core.student_assignments SET to_date = today WHERE niat_id = p_niat AND kind = p_kind AND from_date = cur.from_date;
  END IF;
  IF p_staff IS NOT NULL THEN
    INSERT INTO core.student_assignments (niat_id, staff_id, kind, from_date) VALUES (p_niat, p_staff, p_kind, today)
    ON CONFLICT (niat_id, kind, from_date) DO UPDATE SET staff_id = EXCLUDED.staff_id, to_date = NULL;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION core.assign_staff(text, text, bigint) FROM PUBLIC;

-- Called by the trigger on logs.students (modules/interactions/backend/db/schema.sql) when the
-- Interactions service moves a student to another instructor, so core stays the source of truth.
CREATE FUNCTION core.sync_instructor_from_logs(p_niat text, p_instructor_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
DECLARE target bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.students WHERE niat_id = upper(btrim(p_niat))) THEN RETURN; END IF;
  SELECT id INTO target FROM core.staff WHERE instructor_code = p_instructor_code;
  PERFORM core.assign_staff(p_niat, 'instructor', target);
END $$;
REVOKE ALL ON FUNCTION core.sync_instructor_from_logs(text, text) FROM PUBLIC;
-- Grants to the service roles are in platform/db/setup/service_roles.sql.

-- migrate:down
DROP FUNCTION core.sync_instructor_from_logs(text, text);
DROP FUNCTION core.assign_staff(text, text, bigint);
DROP TRIGGER staff_roles_change_log ON core.staff_roles;
DROP TRIGGER students_change_log ON core.students;
DROP TRIGGER student_assignments_change_log ON core.student_assignments;
DROP FUNCTION core.log_staff_role(), core.log_student(), core.log_student_assignment();
DROP FUNCTION core.write_change(text, text, text, bigint, text, text, text, jsonb);
DROP FUNCTION core.change_context();
DROP TABLE core.change_log;
ALTER TABLE core.staff_roles DROP CONSTRAINT staff_roles_role_check;
ALTER TABLE core.staff_roles ADD CONSTRAINT staff_roles_role_check
  CHECK (role IN ('owner', 'admin', 'senior_instructor', 'instructor', 'viewer'));
