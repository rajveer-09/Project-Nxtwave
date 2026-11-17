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
--     -v web_pw="…" -v attendance_pw="…" -v contest_pw="…" \
--     -f db/setup/service_roles.sql
--
-- Run AFTER the core migration and AFTER module data has been restored into
-- the attendance / logs / contest schemas.

\set ON_ERROR_STOP on

SELECT format('CREATE ROLE web_svc LOGIN PASSWORD %L', :'web_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_svc') \gexec
SELECT format('CREATE ROLE attendance_svc LOGIN PASSWORD %L', :'attendance_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'attendance_svc') \gexec
SELECT format('CREATE ROLE contest_svc LOGIN PASSWORD %L', :'contest_pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'contest_svc') \gexec

-- Each service sees its own schema first, then core. Works with Neon's pooled
-- connections because role settings apply per (user, database) server connection.
ALTER ROLE web_svc        SET search_path = logs, core, extensions;
ALTER ROLE attendance_svc SET search_path = attendance, core, extensions;
ALTER ROLE contest_svc    SET search_path = contest, core, extensions;

GRANT USAGE ON SCHEMA extensions TO web_svc, attendance_svc, contest_svc;
GRANT USAGE ON SCHEMA core TO web_svc, attendance_svc, contest_svc;

-- core: written by the web app only, read by the services
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO web_svc;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core TO web_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO attendance_svc, contest_svc;

-- Each service owns its module schema
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
