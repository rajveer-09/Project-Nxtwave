/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Live code rooms over WebSockets: the interactions service (modules/interactions/backend/src/rooms)
-- keeps each open room in memory, sends every edit to the other person at once and saves the code
-- every few seconds, so it reads and updates the room tables. Rooms are still created, attached to
-- interactions and listed by the web app (web_svc).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'interactions_svc') THEN
    GRANT SELECT, UPDATE ON core.code_rooms, core.code_room_problems TO interactions_svc;
  END IF;
END $$;

-- migrate:down
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'interactions_svc') THEN
    REVOKE SELECT, UPDATE ON core.code_rooms, core.code_room_problems FROM interactions_svc;
  END IF;
END $$;
