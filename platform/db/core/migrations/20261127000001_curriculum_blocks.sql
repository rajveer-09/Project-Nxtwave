-- migrate:up
-- Curriculum blocks: the rows of a level's interaction sheet. Each block sits in a topic (or, with
-- topic_id NULL, applies to the whole level, e.g. Level 0's "Step 0 · not applicable" note) and
-- carries the sheet's columns: step, step-wise rating, how many questions to ask from its pool,
-- hints, whether revisiting is mandatory, suggested time and what to expect / when to stop.
-- Questions join a block (block_id), may sit under a heading inside it (pool_group, e.g.
-- "Pick 1 from this ->"), keep the sheet's order (position) and can carry multi-line text (body);
-- the title stays one line because logged interactions store their questions one per line.
-- Only adds: existing questions and topics are unchanged (no block = shown as before).
-- Read by modules/interactions/frontend/curriculum (data.ts, blocks.ts).

CREATE TABLE core.curriculum_blocks (
  id           text PRIMARY KEY DEFAULT 'b-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  level        smallint NOT NULL REFERENCES core.curriculum_levels (level),
  topic_id     text REFERENCES core.curriculum_topics (id),
  position     integer NOT NULL,
  step         text NOT NULL DEFAULT '',   -- the sheet's "Step" (0, 1, 2, …)
  rating_step  text NOT NULL DEFAULT '',   -- "Rating based on interaction (step-wise rating)"
  pool_note    text NOT NULL DEFAULT '',   -- text in the pool column that isn't a question
  ask          text NOT NULL DEFAULT '',   -- how many questions to ask from the pool
  hints        text NOT NULL DEFAULT '',
  revisit      text NOT NULL DEFAULT '',   -- if the student can't answer: revisit mandatory, or proceed?
  minutes      text NOT NULL DEFAULT '',   -- suggested time to solve during the interaction
  expectation  text NOT NULL DEFAULT '',   -- what we expect from the student & when to stop
  archived     boolean NOT NULL DEFAULT false,
  created_by   text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX curriculum_blocks_place_idx ON core.curriculum_blocks (level, topic_id, position);

ALTER TABLE core.curriculum_questions
  ADD COLUMN block_id   text REFERENCES core.curriculum_blocks (id),
  ADD COLUMN pool_group text NOT NULL DEFAULT '',
  ADD COLUMN position   integer,
  ADD COLUMN body       text NOT NULL DEFAULT '';

-- Change log for blocks, like the other curriculum tables (core.log_curriculum covers questions).
CREATE FUNCTION core.log_curriculum_block() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
DECLARE
  place text := 'Level ' || NEW.level || COALESCE(' › ' || (SELECT t.name FROM core.curriculum_topics t WHERE t.id = NEW.topic_id), '');
  label text := COALESCE(NULLIF(btrim(NEW.rating_step), ''), 'Step ' || NULLIF(NEW.step, ''), 'Block');
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM core.write_change('curriculum', 'added', NULL, NULL, 'block', NULL, label, jsonb_build_object('place', place));
  ELSIF OLD.archived IS DISTINCT FROM NEW.archived THEN
    PERFORM core.write_change('curriculum', CASE WHEN NEW.archived THEN 'archived' ELSE 'restored' END, NULL, NULL, 'block', label, label, jsonb_build_object('place', place));
  ELSIF (OLD.step, OLD.rating_step, OLD.pool_note, OLD.ask, OLD.hints, OLD.revisit, OLD.minutes, OLD.expectation)
        IS DISTINCT FROM (NEW.step, NEW.rating_step, NEW.pool_note, NEW.ask, NEW.hints, NEW.revisit, NEW.minutes, NEW.expectation) THEN
    PERFORM core.write_change('curriculum', 'edited', NULL, NULL, 'block rules', NULL, label, jsonb_build_object('place', place));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER curriculum_blocks_change_log AFTER INSERT OR UPDATE ON core.curriculum_blocks
  FOR EACH ROW EXECUTE FUNCTION core.log_curriculum_block();

-- The web app reads and edits blocks (platform/db/setup/service_roles.sql grants the same on every run).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_svc') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON core.curriculum_blocks TO web_svc;
  END IF;
END $$;

-- migrate:down
DROP TRIGGER curriculum_blocks_change_log ON core.curriculum_blocks;
DROP FUNCTION core.log_curriculum_block();
ALTER TABLE core.curriculum_questions DROP COLUMN body, DROP COLUMN position, DROP COLUMN pool_group, DROP COLUMN block_id;
DROP TABLE core.curriculum_blocks;
