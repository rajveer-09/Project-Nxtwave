-- Author : Rajveer Sharma
-- Date : 18 Nov 2026
-- @ Nxtwave

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_svc') THEN
    REVOKE INSERT, UPDATE, DELETE ON attendance FROM web_svc;
  END IF;
END $$;
DROP TRIGGER attendance_clear_hub_marker ON attendance;
DROP FUNCTION attendance_clear_hub_marker();
ALTER TABLE attendance DROP COLUMN marked_by;
