/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

-- migrate:up
-- Hub-only features, written by apps/web only: weekly tests (ARCHITECTURE.md §4.7),
-- messages (§4.6) and the editable question bank with the off-roadmap review (§4.5).
-- They live in core because no old app has them and only the web app writes them.

-- ---------------------------------------------------------------- weekly tests

-- A result format is versioned; each test keeps the version it was created with.
CREATE TABLE core.test_formats (
  id    text PRIMARY KEY,
  name  text NOT NULL
);

CREATE TABLE core.test_format_versions (
  format_id     text NOT NULL REFERENCES core.test_formats(id),
  version       integer NOT NULL CHECK (version > 0),
  pass_mark     integer NOT NULL CHECK (pass_mark >= 0),
  fields        jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'array'),  -- modules/tests/types.ts FormatField[]
  published_by  text NOT NULL,
  published_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (format_id, version)
);

CREATE TABLE core.weekly_tests (
  id          text PRIMARY KEY,
  name        text NOT NULL CHECK (btrim(name) <> ''),
  band        text NOT NULL CHECK (band IN ('L0', 'L1', 'L2', 'L3+')),
  held_on     date NOT NULL,
  due_at      timestamptz NOT NULL,
  format_id   text NOT NULL,
  version     integer NOT NULL,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (format_id, version) REFERENCES core.test_format_versions(format_id, version)
);
CREATE UNIQUE INDEX weekly_tests_name_band ON core.weekly_tests (lower(btrim(name)), band);

-- One result per student per test; values are keyed by the format's field ids.
CREATE TABLE core.test_results (
  test_id     text NOT NULL REFERENCES core.weekly_tests(id) ON DELETE CASCADE,
  niat_id     text NOT NULL REFERENCES core.students(niat_id),
  present     boolean NOT NULL,
  "values"    jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof("values") = 'object'),
  entered_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (test_id, niat_id)
);
CREATE INDEX test_results_student_idx ON core.test_results (niat_id);

-- An instructor's submission locks their rows for that test until an admin unlocks it.
CREATE TABLE core.test_submissions (
  test_id       text NOT NULL REFERENCES core.weekly_tests(id) ON DELETE CASCADE,
  instructor    text NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (test_id, instructor)
);

-- The standard format the Interactions team already uses: MCQ /10, two coding questions /20, pass 20.
INSERT INTO core.test_formats (id, name) VALUES ('standard', 'Standard weekly test');
INSERT INTO core.test_format_versions (format_id, version, pass_mark, published_by, fields) VALUES ('standard', 1, 20, 'Initial setup', '[
  {"id": "f1", "label": "MCQ", "type": "marks", "max": 10, "required": true, "column": true, "help": ""},
  {"id": "f2", "label": "Coding Q1", "type": "marks", "max": 20, "required": true, "column": true, "help": ""},
  {"id": "f3", "label": "Coding Q2", "type": "marks", "max": 20, "required": true, "column": true, "help": "Partial marks allowed for a correct approach"},
  {"id": "f4", "label": "Improvement areas", "type": "multi", "required": false, "column": false, "help": "Pick everything that applies",
   "options": ["Prefix sums", "Hash maps", "Two pointers", "Edge cases", "Time complexity", "Dry run / tracing", "Recursion base cases", "Index boundaries"]},
  {"id": "f5", "label": "What went well", "type": "long", "required": false, "column": false, "help": ""},
  {"id": "f6", "label": "Remarks", "type": "long", "required": true, "column": false, "help": "Specific mistakes you saw"},
  {"id": "f7", "label": "Next step", "type": "single", "required": false, "column": false, "help": "",
   "options": ["None", "Extra practice set", "Discuss in next interaction", "Re-test next week", "Escalate to senior instructor"]},
  {"id": "f8", "label": "Show feedback to student", "type": "yesno", "required": false, "column": false, "help": "Takes effect once student login is on"}
]');

-- ---------------------------------------------------------------- messages

CREATE TABLE core.messages (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_staff_id  bigint REFERENCES core.staff(id),
  sender_name      text NOT NULL,
  subject          text NOT NULL CHECK (btrim(subject) <> ''),
  body             text NOT NULL CHECK (btrim(body) <> ''),
  priority         text NOT NULL CHECK (priority IN ('normal', 'important', 'urgent')),
  require_ack      boolean NOT NULL DEFAULT false,
  also_email       boolean NOT NULL DEFAULT false,
  audience         jsonb NOT NULL,
  audience_label   text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Resolved when the message is sent, so later role changes don't change who got it.
CREATE TABLE core.message_recipients (
  message_id    bigint NOT NULL REFERENCES core.messages(id) ON DELETE CASCADE,
  staff_id      bigint NOT NULL REFERENCES core.staff(id),
  delivered_at  timestamptz,
  read_at       timestamptz,
  acked_at      timestamptz,
  PRIMARY KEY (message_id, staff_id)
);
CREATE INDEX message_recipients_staff_idx ON core.message_recipients (staff_id, message_id DESC);

-- ---------------------------------------------------------------- curriculum

-- The question bank behind the roadmap (levels → topics → subtopics come from the curriculum in code).
-- The questions imported from the Interactions app are added by the web app on first use.
CREATE TABLE core.curriculum_questions (
  id          text PRIMARY KEY,
  level       smallint NOT NULL CHECK (level BETWEEN 0 AND 7),
  topic       text NOT NULL,
  subtopic    text,
  step        text NOT NULL,
  title       text NOT NULL CHECK (btrim(title) <> ''),
  source      text NOT NULL DEFAULT '',
  url         text NOT NULL DEFAULT '' CHECK (url = '' OR url ~* '^https://'),
  notes       text NOT NULL DEFAULT '',
  tweak_of    text REFERENCES core.curriculum_questions(id),
  origin      text NOT NULL CHECK (origin IN ('roadmap', 'promoted')),
  created_by  text NOT NULL,
  archived    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX curriculum_questions_place_idx ON core.curriculum_questions (level, topic, subtopic);

-- Admin decisions on off-roadmap questions, keyed by the normalised question title.
CREATE TABLE core.off_roadmap_decisions (
  key          text PRIMARY KEY,
  status       text NOT NULL CHECK (status IN ('added', 'kept', 'dismissed')),
  decided_by   text NOT NULL,
  decided_at   timestamptz NOT NULL DEFAULT now(),
  question_id  text REFERENCES core.curriculum_questions(id) ON DELETE SET NULL
);

-- migrate:down
DROP TABLE core.off_roadmap_decisions, core.curriculum_questions, core.message_recipients, core.messages,
  core.test_submissions, core.test_results, core.weekly_tests, core.test_format_versions, core.test_formats;
