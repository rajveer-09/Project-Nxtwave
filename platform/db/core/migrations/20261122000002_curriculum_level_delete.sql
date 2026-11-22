/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- The last level of the roadmap can be deleted on the Curriculum page when nothing ever used it
-- (no student at it, no interaction logged at it); its topics, subtopics and questions go with it
-- (modules/interactions/frontend/curriculum/structure.ts, deleteLevel). One change-log entry records
-- it; the app puts what went with it in app.deleted_summary for that transaction.

CREATE FUNCTION core.log_curriculum_level_deleted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $$
BEGIN
  PERFORM core.write_change('curriculum', 'deleted', NULL, NULL, 'level',
    'Level ' || OLD.level || CASE WHEN OLD.title <> '' THEN ' · ' || OLD.title ELSE '' END, NULL,
    jsonb_build_object('place', 'Roadmap', 'item', NULLIF(current_setting('app.deleted_summary', true), '')));
  RETURN OLD;
END $$;

CREATE TRIGGER curriculum_levels_delete_log AFTER DELETE ON core.curriculum_levels
  FOR EACH ROW EXECUTE FUNCTION core.log_curriculum_level_deleted();

-- migrate:down
DROP TRIGGER curriculum_levels_delete_log ON core.curriculum_levels;
DROP FUNCTION core.log_curriculum_level_deleted();
