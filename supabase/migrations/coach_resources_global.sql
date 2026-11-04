-- ── Platform-wide coach resources ───────────────────────────────────────────
-- A small number of resources (currently just the Prokol app-overview video)
-- need to be visible to every coach on the platform, including ones who sign
-- up in the future — not copied into each coach's own library. Mirrors the
-- `is_global` pattern used elsewhere for platform-wide content: write access
-- stays exactly as owner-scoped as it already is, only read access widens.

ALTER TABLE coach_resources ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Coach manages own resources" ON coach_resources;

CREATE POLICY "Coach reads own or global resources" ON coach_resources
  FOR SELECT USING (coach_id = auth.uid() OR is_global = true);

CREATE POLICY "Coach inserts own resources" ON coach_resources
  FOR INSERT WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coach updates own resources" ON coach_resources
  FOR UPDATE USING (coach_id = auth.uid());

CREATE POLICY "Coach deletes own resources" ON coach_resources
  FOR DELETE USING (coach_id = auth.uid());
