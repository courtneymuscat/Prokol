-- Mark form submissions that were sent via a "save to file" toggle so the
-- coach's Files tab can highlight them explicitly. The Files tab already
-- shows every form_submission tied to the coach; this column carries the
-- coach's intent forward so we can later distinguish "this is a file"
-- (e.g. a signed waiver, intake form) from "this is just a check-in".
--
-- Safe to apply: column defaults to false, doesn't affect any existing
-- behaviour, and the form-submit API tolerates the column being absent on
-- older databases (gracefully retries without it).

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS save_to_file boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS form_submissions_save_to_file_idx
  ON form_submissions (coach_id, save_to_file)
  WHERE save_to_file = true;
