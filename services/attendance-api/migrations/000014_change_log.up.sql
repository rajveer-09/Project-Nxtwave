-- Author : Rajveer Sharma
-- Date : 18 Nov 2026
-- @ Nxtwave
--
-- Class changes on the attendance roster (hall, section, degree, status, joining and dropping)
-- go to the hub's change log, core.change_log, through core.write_change(). Who made the change
-- comes from the transaction's app.* settings; without them the database user is recorded.
-- On a database without the hub's core schema (this service's own tests) nothing is logged.

CREATE OR REPLACE FUNCTION log_student_class_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fn constant text := 'core.write_change(text,text,text,bigint,text,text,text,jsonb)';
  stmt constant text := 'SELECT core.write_change($1, $2, $3, NULL, $4, $5, $6, $7)';
BEGIN
  IF to_regprocedure(fn) IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    EXECUTE stmt USING 'attendance_student', 'added', NEW.niat_id, NULL::text, NULL::text, NEW.full_name,
      jsonb_build_object('degree', NEW.degree_code, 'section', NEW.section, 'hall', NEW.hall_no);
  ELSIF TG_OP = 'DELETE' THEN
    EXECUTE stmt USING 'attendance_student', 'removed', OLD.niat_id, NULL::text, OLD.full_name, NULL::text, '{}'::jsonb;
  ELSE
    IF OLD.hall_no IS DISTINCT FROM NEW.hall_no THEN
      EXECUTE stmt USING 'attendance_student', 'changed', NEW.niat_id, 'hall', OLD.hall_no, NEW.hall_no, '{}'::jsonb;
    END IF;
    IF OLD.section IS DISTINCT FROM NEW.section THEN
      EXECUTE stmt USING 'attendance_student', 'changed', NEW.niat_id, 'section', OLD.section, NEW.section, '{}'::jsonb;
    END IF;
    IF OLD.degree_code IS DISTINCT FROM NEW.degree_code THEN
      EXECUTE stmt USING 'attendance_student', 'changed', NEW.niat_id, 'college', OLD.degree_code, NEW.degree_code, '{}'::jsonb;
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      EXECUTE stmt USING 'attendance_student', 'changed', NEW.niat_id, 'status', OLD.status, NEW.status, '{}'::jsonb;
    END IF;
    IF OLD.joined_on IS DISTINCT FROM NEW.joined_on THEN
      EXECUTE stmt USING 'attendance_student', 'changed', NEW.niat_id, 'joined_on', OLD.joined_on::text, NEW.joined_on::text, '{}'::jsonb;
    END IF;
    IF OLD.dropped_on IS DISTINCT FROM NEW.dropped_on THEN
      EXECUTE stmt USING 'attendance_student', 'changed', NEW.niat_id, 'dropped_on', OLD.dropped_on::text, NEW.dropped_on::text, '{}'::jsonb;
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS students_class_change_log ON students;
CREATE TRIGGER students_class_change_log
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION log_student_class_change();
