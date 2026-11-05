CREATE TABLE IF NOT EXISTS client_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, name)
);

CREATE TABLE IF NOT EXISTS client_tag_assignments (
  tag_id     uuid NOT NULL REFERENCES client_tags(id) ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, client_id)
);

CREATE INDEX IF NOT EXISTS client_tag_assignments_coach_client_idx ON client_tag_assignments (coach_id, client_id);

ALTER TABLE client_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own tags" ON client_tags FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "Coach manages own tag assignments" ON client_tag_assignments FOR ALL USING (coach_id = auth.uid());
