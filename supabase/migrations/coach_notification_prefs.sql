-- Per-client notification preferences for coaches.
--
-- When a client logs an event (food, weight, cycle, workout, habit, progress
-- photo), the server checks (coach_id, client_id) and fires a web-push to the
-- coach iff the matching column is true. Each (coach, client) gets its own
-- row so two coaches sharing a client can tune their own noise independently.
--
-- Defaults reflect signal-to-noise: workout completion + new progress photos
-- are high-signal so they're on by default; food/weight/habit are typically
-- frequent so they're off by default.

CREATE TABLE IF NOT EXISTS coach_notification_prefs (
  coach_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  food       boolean NOT NULL DEFAULT false,
  weight     boolean NOT NULL DEFAULT false,
  cycle      boolean NOT NULL DEFAULT false,
  workout    boolean NOT NULL DEFAULT true,
  habit      boolean NOT NULL DEFAULT false,
  photo      boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, client_id)
);

ALTER TABLE coach_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_own_notification_prefs" ON coach_notification_prefs
  FOR ALL USING (coach_id = auth.uid());

CREATE OR REPLACE FUNCTION touch_coach_notification_prefs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coach_notification_prefs_touch ON coach_notification_prefs;
CREATE TRIGGER coach_notification_prefs_touch
  BEFORE UPDATE ON coach_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION touch_coach_notification_prefs_updated_at();
