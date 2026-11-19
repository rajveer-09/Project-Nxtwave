/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Code rooms: a shared code editor for an interaction. The instructor starts a room for a student,
-- adds the questions they ask (title + link), and both edit each question's code live. Saving the
-- interaction attaches the room to it and ends the room; the code stays readable afterwards.
-- Live sync is by polling: every change bumps code_rooms.version, and each question's code has its
-- own version so two edits made at the same moment are merged instead of one overwriting the other.

CREATE TABLE core.code_rooms (
  id              text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9]{12}$'),   -- random, unguessable; the room link
  niat_id         text NOT NULL REFERENCES core.students(niat_id),
  created_by      bigint REFERENCES core.staff(id),
  created_by_name text NOT NULL,
  version         bigint NOT NULL DEFAULT 1,                           -- bumped on every change
  active_problem  uuid,                                                -- the question the instructor has open
  interaction_id  text,                                                -- logs.interactions.id once saved
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  closed_by_name  text
);
CREATE INDEX code_rooms_student_idx ON core.code_rooms (niat_id, created_at DESC);
CREATE INDEX code_rooms_interaction_idx ON core.code_rooms (interaction_id) WHERE interaction_id IS NOT NULL;
COMMENT ON TABLE core.code_rooms IS 'Shared code editor rooms opened during interactions';

CREATE TABLE core.code_room_problems (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         text NOT NULL REFERENCES core.code_rooms(id) ON DELETE CASCADE,
  position        int NOT NULL,
  title           text NOT NULL CHECK (btrim(title) <> '' AND length(title) <= 200),
  url             text NOT NULL DEFAULT '' CHECK (length(url) <= 1000),
  language        text NOT NULL DEFAULT 'cpp',
  code            text NOT NULL DEFAULT '' CHECK (length(code) <= 200000),
  version         int NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by_name text
);
CREATE INDEX code_room_problems_room_idx ON core.code_room_problems (room_id, position);

-- The web app writes rooms (platform/db/setup/service_roles.sql grants the same on every run).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_svc') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON core.code_rooms, core.code_room_problems TO web_svc;
  END IF;
END $$;

-- migrate:down
DROP TABLE core.code_room_problems;
DROP TABLE core.code_rooms;
