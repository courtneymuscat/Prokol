CREATE TABLE IF NOT EXISTS coach_message_templates (
  coach_id         uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  urgent_template  text NOT NULL,
  urgent_enabled   boolean NOT NULL DEFAULT true,
  normal_template  text NOT NULL,
  lead_template    text NOT NULL,
  category_snippets jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own message templates" ON coach_message_templates FOR ALL USING (coach_id = auth.uid());
