-- Saved workouts library
--
-- Coaches can save any single program day as a reusable workout template
-- and pull it back into a program later. Org owners (or coaches assigned
-- to an org) can additionally publish a saved workout as an org template
-- so other coaches in the same org can use it.
--
-- The `content` jsonb stores the same day shape used inside a program:
--   { name: string, items: PDayItem[] }
-- where each PDayItem is either an exercise or a section (matching the
-- program editor's data model).

CREATE TABLE IF NOT EXISTS coach_saved_workouts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id            uuid REFERENCES organisations(id) ON DELETE SET NULL,
  is_org_template   boolean NOT NULL DEFAULT false,
  -- Mirrors the other org-publishable tables (autoflow_templates, programs,
  -- meal_plans, etc.) which all carry created_by — that column powers the
  -- per-template "who published this" attribution in the org dashboard.
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name              text NOT NULL,
  description       text,
  content           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- For environments that already have the table without created_by:
ALTER TABLE coach_saved_workouts
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS coach_saved_workouts_coach_idx
  ON coach_saved_workouts (coach_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_saved_workouts_org_template_idx
  ON coach_saved_workouts (org_id, created_at DESC)
  WHERE is_org_template = true;

ALTER TABLE coach_saved_workouts ENABLE ROW LEVEL SECURITY;

-- Coach can manage their own saved workouts
CREATE POLICY "coach_manage_own_saved_workouts" ON coach_saved_workouts
  FOR ALL USING (coach_id = auth.uid());

-- NOTE: we intentionally do NOT add an "org members can read templates"
-- RLS policy here. The natural way to write it (EXISTS SELECT FROM
-- org_members WHERE ...) triggers infinite recursion against org_members'
-- own policies, which in turn breaks the post-insert SELECT round-trip
-- on this table. Instead, the API route GET /api/coach/saved-workouts
-- fetches org templates via the service-role admin client, bypassing
-- RLS for that read path. All writes still go through the owner-manage
-- policy above.

-- Touch trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_coach_saved_workouts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coach_saved_workouts_touch ON coach_saved_workouts;
CREATE TRIGGER coach_saved_workouts_touch
  BEFORE UPDATE ON coach_saved_workouts
  FOR EACH ROW EXECUTE FUNCTION touch_coach_saved_workouts_updated_at();
