/*

Author : Rajveer Sharma
Date : 21 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- NxtOne roles stand on their own. Until now, someone with no 'platform' row in core.staff_roles
-- signed in with the highest role they had held in the old apps (Interactions, Attendance,
-- Contests), copied in when NxtOne was set up. Everyone in that position now gets that same role as
-- their NxtOne role, so nobody's access changes; from here on only the 'platform' row counts and
-- the other modules' rows are history. Recorded in the change log as source 'migration'.

SELECT set_config('app.source', 'migration', true),
       set_config('app.source_detail', '20261121000001_platform_roles_own', true);

INSERT INTO core.staff_roles (staff_id, module, role)
SELECT s.id, 'platform', borrowed.role
FROM core.staff s
CROSS JOIN LATERAL (
  SELECT r.role FROM core.staff_roles r
  WHERE r.staff_id = s.id AND r.role IN ('owner', 'admin', 'senior_instructor', 'instructor', 'success_coach')
  ORDER BY array_position(ARRAY['owner', 'admin', 'senior_instructor', 'instructor', 'success_coach'], r.role)
  LIMIT 1
) borrowed
WHERE NOT EXISTS (SELECT 1 FROM core.staff_roles p WHERE p.staff_id = s.id AND p.module = 'platform')
ON CONFLICT (staff_id, module) DO NOTHING;

-- migrate:down
-- Nothing to undo automatically: the rows added above can't be told apart from roles set since
-- (the change log lists them, source 'migration'). The app no longer reads other modules' rows.
SELECT 1;
