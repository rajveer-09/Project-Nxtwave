/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- The roadmap's structure moves from code into the database, so senior instructors and admins can
-- edit it in NxtOne: levels → topics → subtopics, and the steps (1.1, 1.2, 2.1 …) questions sit at.
-- The rows below are the curriculum the apps shipped with (apps/web/modules/interactions/lib/curriculum.ts).
-- Names are stored as text in the interaction logs, so nothing is ever deleted: an item is archived
-- (hidden from new interactions) and past logs keep what they say. Every change is written to
-- core.change_log (entity 'curriculum').

CREATE TABLE core.curriculum_levels (
  level       smallint PRIMARY KEY CHECK (level BETWEEN 0 AND 15),
  title       text NOT NULL DEFAULT '' CHECK (length(title) <= 80),
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Topics and subtopics are joined with commas in logs.interactions, so their names cannot hold one.
CREATE TABLE core.curriculum_topics (
  id          text PRIMARY KEY DEFAULT 't-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  level       smallint NOT NULL REFERENCES core.curriculum_levels (level),
  name        text NOT NULL CHECK (btrim(name) = name AND name <> '' AND length(name) <= 80 AND position(',' IN name) = 0),
  position    integer NOT NULL,
  max_step    text,                               -- steps stop here (e.g. Level 1 topics stop at 3.2); NULL = every step
  required    boolean NOT NULL DEFAULT true,       -- counts towards completing the level
  archived    boolean NOT NULL DEFAULT false,
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX curriculum_topics_name_idx ON core.curriculum_topics (level, lower(name));

CREATE TABLE core.curriculum_subtopics (
  id          text PRIMARY KEY DEFAULT 's-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  topic_id    text NOT NULL REFERENCES core.curriculum_topics (id),
  name        text NOT NULL CHECK (btrim(name) = name AND name <> '' AND length(name) <= 80 AND position(',' IN name) = 0),
  position    integer NOT NULL,
  archived    boolean NOT NULL DEFAULT false,
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX curriculum_subtopics_name_idx ON core.curriculum_subtopics (topic_id, lower(name));

-- Steps reached in an interaction, the same list for every topic of Level 1 and up (Level 0 has none).
CREATE TABLE core.curriculum_steps (
  code        text PRIMARY KEY CHECK (code ~ '^[1-9][0-9]?\.[1-9][0-9]?$'),
  label       text NOT NULL CHECK (btrim(label) = label AND label <> '' AND length(label) <= 80),
  archived    boolean NOT NULL DEFAULT false,
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE core.curriculum_topics ADD CONSTRAINT curriculum_topics_max_step_fkey FOREIGN KEY (max_step) REFERENCES core.curriculum_steps (code);

-- ---------------------------------------------------------------- the shipped curriculum

INSERT INTO core.curriculum_levels (level, created_by) SELECT n, 'Roadmap at launch' FROM generate_series(0, 7) n;

INSERT INTO core.curriculum_steps (code, label, created_by) VALUES
  ('1.1', 'Theory: concept & prerequisites', 'Roadmap at launch'),
  ('1.2', 'Theory: complexity & reasoning', 'Roadmap at launch'),
  ('2.1', 'Easy standard question', 'Roadmap at launch'),
  ('2.2', 'Easy tweaked question', 'Roadmap at launch'),
  ('3.1', 'Medium standard question', 'Roadmap at launch'),
  ('3.2', 'Medium tweaked question', 'Roadmap at launch'),
  ('4.1', 'Hard standard question', 'Roadmap at launch');

INSERT INTO core.curriculum_topics (id, level, name, position, max_step, required, created_by)
SELECT 't-' || substr(md5(t.level || '|' || t.name), 1, 10), t.level, t.name, t.position, t.max_step, t.required, 'Roadmap at launch'
FROM (VALUES
  (0, 'Introduction', 1, NULL, false), (0, 'Data Types', 2, NULL, false), (0, 'If else', 3, NULL, true), (0, 'Loops', 4, NULL, true),
  (0, 'Traversal', 5, NULL, true), (0, 'Time & Space Complexity analysis', 6, NULL, true), (0, 'Pattern Questions', 7, NULL, true),
  (1, 'Maths', 1, '3.2', true), (1, 'STL', 2, '3.2', true), (1, 'Arrays', 3, '3.2', true), (1, 'String', 4, '3.2', true),
  (2, 'Recursion - Basics', 1, NULL, true), (2, 'Sorting', 2, NULL, true), (2, 'Binary Search', 3, NULL, true),
  (3, 'Two pointers / Sliding window', 1, NULL, true), (3, 'Greedy Algorithms', 2, NULL, true),
  (4, 'Bit Manipulation', 1, NULL, true), (4, 'Stack & Queues', 2, NULL, true), (4, 'Stack - Monotonic Stack', 3, NULL, true),
  (5, 'Heaps / PQ''s', 1, NULL, true), (5, 'Linked list', 2, NULL, true), (5, 'Recursion - Advanced', 3, NULL, true), (5, 'AdHoc', 4, NULL, true),
  (6, 'Dynamic Programming', 1, NULL, true),
  (7, 'Binary Trees', 1, NULL, true), (7, 'Binary Search Trees', 2, NULL, true), (7, 'Graphs', 3, NULL, true), (7, 'Advanced Graph', 4, NULL, true)
) AS t(level, name, position, max_step, required);

INSERT INTO core.curriculum_subtopics (topic_id, name, position, created_by)
SELECT 't-' || substr(md5('1|' || s.topic), 1, 10), s.name, s.position, 'Roadmap at launch'
FROM (VALUES
  ('Maths', 'Digit Manipulation', 1), ('Maths', 'LCM & GCD', 2), ('Maths', 'Prime Numbers', 3), ('Maths', 'Fast Exponentiation', 4),
  ('STL', 'Set / Unordered Set', 1), ('STL', 'Map / Unordered Map', 2), ('STL', 'Stack', 3), ('STL', 'Queue', 4),
  ('Arrays', 'Array Traversal', 1), ('Arrays', 'Prefix & Suffix sum', 2), ('Arrays', 'Kadane''s Algo', 3), ('Arrays', 'Array Adhoc', 4), ('Arrays', 'Array + Map / Set', 5)
) AS s(topic, name, position);

-- Levels above 7 also need the interaction logs to accept them: services/interactions-api/db/schema.sql
-- widens its level checks to 0–15 (it owns the logs tables).

-- ---------------------------------------------------------------- change log

ALTER TABLE core.change_log DROP CONSTRAINT change_log_entity_check;
ALTER TABLE core.change_log ADD CONSTRAINT change_log_entity_check
  CHECK (entity IN ('student_assignment', 'student', 'attendance_student', 'staff_role', 'staff', 'student_account', 'curriculum'));

-- Where an item sits, e.g. "Level 1 › Arrays › Prefix & Suffix sum".
CREATE FUNCTION core.curriculum_path(p_topic text, p_subtopic text DEFAULT NULL) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, core AS $$
  SELECT 'Level ' || t.level || ' › ' || t.name || COALESCE(' › ' || p_subtopic, '') FROM core.curriculum_topics t WHERE t.id = p_topic
$$;

-- One trigger for the four structure tables and the questions. field = what kind of item; old/new
-- values are its name (or label / link); detail holds where it sits.
CREATE FUNCTION core.log_curriculum() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
DECLARE
  kind text := CASE TG_TABLE_NAME WHEN 'curriculum_levels' THEN 'level' WHEN 'curriculum_topics' THEN 'topic'
                 WHEN 'curriculum_subtopics' THEN 'subtopic' WHEN 'curriculum_steps' THEN 'step' ELSE 'question' END;
  o jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  n jsonb := to_jsonb(NEW);
  place text;
  label text;
BEGIN
  place := CASE kind
    WHEN 'level' THEN 'Level ' || (n->>'level')
    WHEN 'topic' THEN 'Level ' || (n->>'level')
    WHEN 'subtopic' THEN core.curriculum_path(n->>'topic_id')
    WHEN 'step' THEN 'Steps'
    ELSE 'Level ' || (n->>'level') || ' › ' || (n->>'topic') || COALESCE(' › ' || (n->>'subtopic'), '') || COALESCE(' · ' || NULLIF(n->>'step', ''), '')
  END;
  label := CASE kind WHEN 'level' THEN 'Level ' || (n->>'level') WHEN 'step' THEN (n->>'code') || ' ' || (n->>'label') WHEN 'question' THEN n->>'title' ELSE n->>'name' END;

  IF TG_OP = 'INSERT' THEN
    PERFORM core.write_change('curriculum', 'added', NULL, NULL, kind, NULL, label, jsonb_build_object('place', place));
    RETURN NEW;
  END IF;
  IF (o->>'archived') IS DISTINCT FROM (n->>'archived') THEN
    PERFORM core.write_change('curriculum', CASE WHEN (n->>'archived')::boolean THEN 'archived' ELSE 'restored' END, NULL, NULL, kind,
                              label, label, jsonb_build_object('place', place));
  END IF;
  IF kind IN ('topic', 'subtopic') AND (o->>'name') IS DISTINCT FROM (n->>'name') THEN
    PERFORM core.write_change('curriculum', 'renamed', NULL, NULL, kind, o->>'name', n->>'name', jsonb_build_object('place', place));
  END IF;
  IF kind = 'level' AND (o->>'title') IS DISTINCT FROM (n->>'title') THEN
    PERFORM core.write_change('curriculum', 'edited', NULL, NULL, 'level title', NULLIF(o->>'title', ''), NULLIF(n->>'title', ''), jsonb_build_object('place', place));
  END IF;
  IF kind = 'step' AND (o->>'label') IS DISTINCT FROM (n->>'label') THEN
    PERFORM core.write_change('curriculum', 'renamed', NULL, NULL, kind, (o->>'code') || ' ' || (o->>'label'), label, jsonb_build_object('place', place));
  END IF;
  IF kind = 'topic' AND ((o->>'max_step') IS DISTINCT FROM (n->>'max_step') OR (o->>'required') IS DISTINCT FROM (n->>'required')) THEN
    PERFORM core.write_change('curriculum', 'edited', NULL, NULL, 'topic settings',
      'steps up to ' || COALESCE(o->>'max_step', 'the last') || CASE WHEN (o->>'required')::boolean THEN ', counts for the level' ELSE ', optional' END,
      'steps up to ' || COALESCE(n->>'max_step', 'the last') || CASE WHEN (n->>'required')::boolean THEN ', counts for the level' ELSE ', optional' END,
      jsonb_build_object('place', place, 'item', n->>'name'));
  END IF;
  IF kind = 'question' THEN
    IF (o->>'title') IS DISTINCT FROM (n->>'title') THEN
      PERFORM core.write_change('curriculum', 'renamed', NULL, NULL, kind, o->>'title', n->>'title', jsonb_build_object('place', place));
    END IF;
    IF (o->>'url') IS DISTINCT FROM (n->>'url') THEN
      PERFORM core.write_change('curriculum', 'edited', NULL, NULL, 'question link', NULLIF(o->>'url', ''), NULLIF(n->>'url', ''), jsonb_build_object('place', place, 'item', n->>'title'));
    END IF;
    IF (o->>'source') IS DISTINCT FROM (n->>'source') OR (o->>'notes') IS DISTINCT FROM (n->>'notes') THEN
      PERFORM core.write_change('curriculum', 'edited', NULL, NULL, 'question details', NULLIF(o->>'source', ''), NULLIF(n->>'source', ''), jsonb_build_object('place', place, 'item', n->>'title'));
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- The launch rows above are not logged (the trigger is created after them).
CREATE TRIGGER curriculum_levels_change_log AFTER INSERT OR UPDATE ON core.curriculum_levels FOR EACH ROW EXECUTE FUNCTION core.log_curriculum();
CREATE TRIGGER curriculum_topics_change_log AFTER INSERT OR UPDATE ON core.curriculum_topics FOR EACH ROW EXECUTE FUNCTION core.log_curriculum();
CREATE TRIGGER curriculum_subtopics_change_log AFTER INSERT OR UPDATE ON core.curriculum_subtopics FOR EACH ROW EXECUTE FUNCTION core.log_curriculum();
CREATE TRIGGER curriculum_steps_change_log AFTER INSERT OR UPDATE ON core.curriculum_steps FOR EACH ROW EXECUTE FUNCTION core.log_curriculum();
-- Questions seeded from the code bank (created_by 'Imported from the Interactions app') are not logged when added.
CREATE TRIGGER curriculum_questions_change_log AFTER INSERT ON core.curriculum_questions FOR EACH ROW
  WHEN (NEW.created_by <> 'Imported from the Interactions app') EXECUTE FUNCTION core.log_curriculum();
CREATE TRIGGER curriculum_questions_edit_log AFTER UPDATE ON core.curriculum_questions FOR EACH ROW
  EXECUTE FUNCTION core.log_curriculum();

-- migrate:down
DROP TRIGGER curriculum_questions_change_log ON core.curriculum_questions;
DROP TRIGGER curriculum_questions_edit_log ON core.curriculum_questions;
DROP TABLE core.curriculum_subtopics, core.curriculum_topics, core.curriculum_steps, core.curriculum_levels;
DROP FUNCTION core.log_curriculum();
DROP FUNCTION core.curriculum_path(text, text);
DELETE FROM core.change_log WHERE entity = 'curriculum';
ALTER TABLE core.change_log DROP CONSTRAINT change_log_entity_check;
ALTER TABLE core.change_log ADD CONSTRAINT change_log_entity_check
  CHECK (entity IN ('student_assignment', 'student', 'attendance_student', 'staff_role', 'staff', 'student_account'));
