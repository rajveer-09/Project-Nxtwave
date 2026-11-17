/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

-- One Postgres role per service (ARCHITECTURE.md §4.1).
-- Run once per environment with psql as the database owner; passwords are passed
-- as psql variables so they never live in the repo:
--
--   psql "$DATABASE_URL_OWNER" \
--     -v web_pw="…" -v attendance_pw="…" -v contest_pw="…" -v interactions_pw="…" \
--     -f platform/db/setup/service_roles.sql
--
-- Run AFTER the core migration and AFTER module data has been restored into
-- the attendance / logs / contest schemas. Safe to re-run; re-run it after a service
-- creates new tables so the read grants below cover them.

\set ON_ERROR_STOP on

SELECT format('CREATE ROLE web_svc LOGIN PASSWORD %L', :'web_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_svc') \gexec
SELECT format('CREATE ROLE attendance_svc LOGIN PASSWORD %L', :'attendance_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'attendance_svc') \gexec
SELECT format('CREATE ROLE contest_svc LOGIN PASSWORD %L', :'contest_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'contest_svc') \gexec
SELECT format('CREATE ROLE interactions_svc LOGIN PASSWORD %L', :'interactions_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'interactions_svc') \gexec

-- Each service sees its own schema first, then core. Works with Neon's pooled
-- connections because role settings apply per (user, database) server connection.
ALTER ROLE web_svc        SET search_path = logs, core, extensions;
ALTER ROLE attendance_svc SET search_path = attendance, core, extensions;
ALTER ROLE contest_svc    SET search_path = contest, core, extensions;
ALTER ROLE interactions_svc SET search_path = logs, core, extensions;

GRANT USAGE ON SCHEMA extensions TO web_svc, attendance_svc, contest_svc, interactions_svc;
GRANT USAGE ON SCHEMA core TO web_svc, attendance_svc, contest_svc, interactions_svc;

-- core: written by the web app only, read by the services
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO web_svc;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core TO web_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO attendance_svc, contest_svc, interactions_svc;

-- Each service owns its module schema. logs belongs to the interactions service; the web app
-- keeps access there for Tests, Curriculum and Messages.
GRANT ALL ON SCHEMA logs TO interactions_svc;
GRANT ALL ON ALL TABLES IN SCHEMA logs TO interactions_svc;
GRANT ALL ON ALL SEQUENCES IN SCHEMA logs TO interactions_svc;
GRANT ALL ON SCHEMA logs TO web_svc;
GRANT ALL ON ALL TABLES IN SCHEMA logs TO web_svc;
GRANT ALL ON ALL SEQUENCES IN SCHEMA logs TO web_svc;
GRANT ALL ON SCHEMA attendance TO attendance_svc;
GRANT ALL ON ALL TABLES IN SCHEMA attendance TO attendance_svc;
GRANT ALL ON ALL SEQUENCES IN SCHEMA attendance TO attendance_svc;
GRANT ALL ON SCHEMA contest TO contest_svc;
GRANT ALL ON ALL TABLES IN SCHEMA contest TO contest_svc;
GRANT ALL ON ALL SEQUENCES IN SCHEMA contest TO contest_svc;

-- The web app reads the other modules for the Student page and analytics
GRANT USAGE ON SCHEMA attendance, contest TO web_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA attendance, contest TO web_svc;

-- Change log (platform/db/core/migrations/20261118000001): append-only. Rows are written only by
-- core.write_change() and the core triggers, which run as the owner; no app role may edit the log.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON core.change_log FROM web_svc, attendance_svc, contest_svc, interactions_svc;
GRANT SELECT ON core.change_log TO web_svc;
-- The web app changes assignments only through core.assign_staff (history + log in one place).
GRANT EXECUTE ON FUNCTION core.assign_staff(text, text, bigint) TO web_svc;
-- Interactions keeps core in step when it moves a student (trigger in its db/schema.sql); the web
-- app also updates logs.students, which fires the same trigger.
GRANT EXECUTE ON FUNCTION core.sync_instructor_from_logs(text, text) TO interactions_svc, web_svc;
-- Attendance logs class changes on its own student list (modules/attendance/backend migration 000014).
GRANT EXECUTE ON FUNCTION core.write_change(text, text, text, bigint, text, text, text, jsonb) TO attendance_svc;
