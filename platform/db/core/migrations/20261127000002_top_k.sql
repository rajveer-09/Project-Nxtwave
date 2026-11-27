/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Top K: the students each instructor counts among their best (NxtRank kept them as Group = "Top K"
-- in its sheet). One row per marked student; whose Top K it is follows the student's instructor
-- (core.student_assignments), so it moves with the student. The student's instructor marks their own
-- students; senior instructors, admins and super admins mark anyone (modules/top-k). No fixed K.
-- source: "nxtrank" for the students copied in once from NxtRank, "nxtone" for marks made here.

CREATE TABLE core.top_k (
  niat_id    text PRIMARY KEY REFERENCES core.students (niat_id) ON DELETE CASCADE,
  marked_by  text NOT NULL DEFAULT '',
  marked_at  timestamptz NOT NULL DEFAULT now(),
  source     text NOT NULL DEFAULT 'nxtone' CHECK (source IN ('nxtone', 'nxtrank'))
);

-- Change log: who marked or unmarked whom (the app says who through app.* settings, common/db/change.ts).
ALTER TABLE core.change_log DROP CONSTRAINT change_log_entity_check;
ALTER TABLE core.change_log ADD CONSTRAINT change_log_entity_check
  CHECK (entity IN ('student_assignment', 'student', 'attendance_student', 'staff_role', 'staff', 'student_account', 'curriculum', 'top_k'));

CREATE FUNCTION core.log_top_k() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM core.write_change('top_k', 'added', NEW.niat_id, NULL, 'Top K', NULL, 'Top K', jsonb_build_object('source', NEW.source));
    RETURN NEW;
  END IF;
  PERFORM core.write_change('top_k', 'removed', OLD.niat_id, NULL, 'Top K', 'Top K', NULL, '{}');
  RETURN OLD;
END $$;
CREATE TRIGGER top_k_change_log AFTER INSERT OR DELETE ON core.top_k
  FOR EACH ROW EXECUTE FUNCTION core.log_top_k();

-- The web app reads and marks Top K (platform/db/setup/service_roles.sql grants the same on every run).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_svc') THEN
    GRANT SELECT, INSERT, DELETE ON core.top_k TO web_svc;
  END IF;
END $$;

-- migrate:down
DROP TRIGGER top_k_change_log ON core.top_k;
DROP FUNCTION core.log_top_k();
DROP TABLE core.top_k;
DELETE FROM core.change_log WHERE entity = 'top_k';
ALTER TABLE core.change_log DROP CONSTRAINT change_log_entity_check;
ALTER TABLE core.change_log ADD CONSTRAINT change_log_entity_check
  CHECK (entity IN ('student_assignment', 'student', 'attendance_student', 'staff_role', 'staff', 'student_account', 'curriculum'));
