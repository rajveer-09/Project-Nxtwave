-- Author : Rajveer Sharma
-- Date : 18 Nov 2026
-- @ Nxtwave
--
-- NxtOne (the hub web app) saves hall marks itself: instructors, senior instructors and admins mark
-- from its Attendance page with the same rules as PUT /api/admin/attendance (platform/web
-- modules/attendance/db-service.ts). Hub staff are not rows in admins, so updated_by stays NULL and
-- marked_by holds who marked ("Name <email>"). A mark saved by this service (updated_by set) clears it.

ALTER TABLE attendance ADD COLUMN marked_by text;

CREATE OR REPLACE FUNCTION attendance_clear_hub_marker() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.updated_by IS NOT NULL THEN
    NEW.marked_by := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER attendance_clear_hub_marker
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION attendance_clear_hub_marker();

-- The hub's web role (platform/db/setup/service_roles.sql) writes marks only; it has no other write access here.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_svc') THEN
    GRANT INSERT, UPDATE, DELETE ON attendance TO web_svc;
  END IF;
END $$;
