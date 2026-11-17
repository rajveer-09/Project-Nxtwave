/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Core schema shared by every module (ARCHITECTURE.md §4.1–4.2).
-- Written by apps/web only; services read it through their own roles.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS attendance;
CREATE SCHEMA IF NOT EXISTS logs;
CREATE SCHEMA IF NOT EXISTS contest;

CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext SCHEMA extensions;

CREATE OR REPLACE FUNCTION core.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Colleges (today: BITS, CDU; stored as "degree" in the old apps)
CREATE TABLE core.colleges (
  code        text PRIMARY KEY CHECK (code = upper(code) AND code <> 'ALL'),
  name        text NOT NULL
);

-- One roster for every module, keyed by NIAT ID
CREATE TABLE core.students (
  niat_id     text PRIMARY KEY CHECK (niat_id ~ '^N[0-9]{2}H[0-9]{2}[AB][0-9]{4}$'),
  full_name   text NOT NULL CHECK (btrim(full_name) <> ''),
  college     text NOT NULL REFERENCES core.colleges(code),
  section     text NOT NULL,
  hall        text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
  joined_on   date,
  dropped_on  date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (dropped_on IS NULL OR status = 'dropped')
);
CREATE INDEX students_name_trgm ON core.students USING gin (full_name extensions.gin_trgm_ops);
CREATE INDEX students_group_idx ON core.students (college, section, hall);
CREATE TRIGGER students_updated_at BEFORE UPDATE ON core.students
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- Staff: the login identity for every module
CREATE TABLE core.staff (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email            extensions.citext NOT NULL UNIQUE,
  name             text NOT NULL,
  instructor_code  text UNIQUE,                 -- 'INS001' … carried over from Interactions
  aliases          text[] NOT NULL DEFAULT '{}',
  password_hash    text,                        -- null = Google sign-in only
  session_version  integer NOT NULL DEFAULT 1,  -- bump to end every session of this person
  active           boolean NOT NULL DEFAULT true,
  left_on          date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON core.staff
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- Role per module (one person can be admin in one module, instructor in another)
CREATE TABLE core.staff_roles (
  staff_id  bigint NOT NULL REFERENCES core.staff(id) ON DELETE CASCADE,
  module    text NOT NULL CHECK (module IN ('platform', 'attendance', 'logs', 'contest')),
  role      text NOT NULL CHECK (role IN ('owner', 'admin', 'senior_instructor', 'instructor', 'viewer')),
  PRIMARY KEY (staff_id, module)
);

-- Instructor / POC / coach assignment with history
CREATE TABLE core.student_assignments (
  niat_id    text NOT NULL REFERENCES core.students(niat_id) ON DELETE CASCADE,
  staff_id   bigint NOT NULL REFERENCES core.staff(id),
  kind       text NOT NULL CHECK (kind IN ('instructor', 'poc', 'coach')),
  from_date  date NOT NULL DEFAULT current_date,
  to_date    date,
  PRIMARY KEY (niat_id, kind, from_date),
  CHECK (to_date IS NULL OR to_date >= from_date)
);
-- At most one current assignment per student and kind
CREATE UNIQUE INDEX student_assignments_current
  ON core.student_assignments (niat_id, kind) WHERE to_date IS NULL;

-- Sessions for the unified login (token stored hashed)
CREATE TABLE core.sessions (
  token_hash       text PRIMARY KEY,
  staff_id         bigint NOT NULL REFERENCES core.staff(id) ON DELETE CASCADE,
  session_version  integer NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  ip               inet,
  user_agent       text
);
CREATE INDEX sessions_staff_idx ON core.sessions (staff_id);

CREATE TABLE core.login_failures (
  id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key  text NOT NULL,                 -- lower(email) or ip
  at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_failures_key_at ON core.login_failures (key, at DESC);

-- Who changed what, across modules
CREATE TABLE core.audit_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at              timestamptz NOT NULL DEFAULT now(),
  actor_staff_id  bigint REFERENCES core.staff(id),
  module          text NOT NULL,
  action          text NOT NULL,
  target          text,
  detail          jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_log_target_idx ON core.audit_log (target, at DESC);

-- One roster import for every module (preview → commit)
CREATE TABLE core.roster_imports (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file_name    text NOT NULL,
  uploaded_by  bigint REFERENCES core.staff(id),
  status       text NOT NULL CHECK (status IN ('previewed', 'committed', 'discarded')),
  summary      jsonb NOT NULL DEFAULT '{}',
  rows         jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO core.colleges (code, name) VALUES
  ('BITS', 'BITS Pilani (Hyderabad Campus)'),
  ('CDU', 'Chaitanya (Deemed to be University)');

-- migrate:down
DROP SCHEMA core CASCADE;
-- Module schemas and extensions are left in place: they may hold restored module data.
