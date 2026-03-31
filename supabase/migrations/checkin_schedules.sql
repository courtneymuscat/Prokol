-- Scheduled check-in assignments
CREATE TABLE IF NOT EXISTS checkin_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  form_id uuid REFERENCES forms(id) ON DELETE SET NULL,
  title text NOT NULL,
  day_of_week smallint NOT NULL DEFAULT 1, -- 0=Sun,1=Mon,...,6=Sat
  repeat_type text NOT NULL DEFAULT 'weekly', -- 'weekly','biweekly','monthly','once'
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_dow CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT valid_repeat CHECK (repeat_type IN ('weekly','biweekly','monthly','once'))
);

ALTER TABLE checkin_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_checkin_schedules" ON checkin_schedules
  FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "client_view_checkin_schedules" ON checkin_schedules
  FOR SELECT USING (client_id = auth.uid() AND is_active = true);
