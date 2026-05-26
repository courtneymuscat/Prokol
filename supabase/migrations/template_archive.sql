-- Soft-delete (archive) support for the four coach template types.
--
-- Coaches can now archive a template instead of hard-deleting it — this
-- hides the row from the coach's library while preserving every existing
-- client_* assignment, response, submission, schedule and history row
-- that references it. The hard-delete path (DELETE endpoints) still
-- exists and continues to cascade as before, gated behind a "Delete
-- permanently" confirmation in the UI.
--
-- The list/library API endpoints filter `archived_at IS NULL` so
-- archived rows disappear from the picker. A separate "Archived" view
-- can restore by setting `archived_at = NULL` again.

ALTER TABLE programs            ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE meal_plans          ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE autoflow_templates  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE forms               ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS programs_archived_at_idx           ON programs (coach_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS meal_plans_archived_at_idx         ON meal_plans (coach_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS autoflow_templates_archived_at_idx ON autoflow_templates (coach_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS forms_archived_at_idx              ON forms (coach_id) WHERE archived_at IS NULL;
