-- Client-specific autoflow forks.
--
-- When a coach makes a STRUCTURAL change (duplicate or delete a step) to
-- a client's autoflow from inside that client's file, we fork the
-- template into a private clone owned by the coach and tied to that one
-- client. The client's client_autoflows row is repointed at the clone.
-- From then on, all structural edits land on the clone — the original
-- template, and every other client still on it, stay untouched.
--
-- is_client_only filters these clones out of the coach's main autoflows
-- library so they don't clutter the list. The two FKs are diagnostic:
-- which template was forked, and which client triggered the fork.

ALTER TABLE autoflow_templates
  ADD COLUMN IF NOT EXISTS is_client_only          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forked_from_template_id uuid REFERENCES autoflow_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forked_for_client_id    uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS autoflow_templates_library_idx
  ON autoflow_templates (coach_id)
  WHERE is_client_only = false AND archived_at IS NULL;
