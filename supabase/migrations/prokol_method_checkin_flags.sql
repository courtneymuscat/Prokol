-- ── Prokol Method check-ins: review metadata + flags ────────────────────────
-- Supports "The Prokol Method - Check-ins" autoflow: who/when reviewed a
-- check-in (coach_feedback/reviewed_by_coach already existed on
-- autoflow_responses), and a record of computed red/urgent/lead flags that
-- survives even after a flag is cleared (kept for history, per the brief).

ALTER TABLE autoflow_responses
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS autoflow_response_flags (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: the "no check-in submitted for 2 scheduled weeks" rule has no
  -- response to attach to, only the flow + the missed step number.
  response_id         uuid REFERENCES autoflow_responses(id) ON DELETE CASCADE,
  client_autoflow_id  uuid NOT NULL REFERENCES client_autoflows(id) ON DELETE CASCADE,
  step_number         int,
  client_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule_key            text NOT NULL,
  severity            text NOT NULL DEFAULT 'normal' CHECK (severity IN ('normal', 'urgent', 'lead')),
  reason              text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  cleared_at          timestamptz,
  cleared_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  cleared_note        text
);

CREATE INDEX IF NOT EXISTS autoflow_response_flags_response_idx ON autoflow_response_flags (response_id);
CREATE INDEX IF NOT EXISTS autoflow_response_flags_flow_idx ON autoflow_response_flags (client_autoflow_id);
CREATE INDEX IF NOT EXISTS autoflow_response_flags_coach_open_idx ON autoflow_response_flags (coach_id) WHERE cleared_at IS NULL;

ALTER TABLE autoflow_response_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own client flags" ON autoflow_response_flags
  FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "Client reads own flags" ON autoflow_response_flags
  FOR SELECT USING (client_id = auth.uid());
