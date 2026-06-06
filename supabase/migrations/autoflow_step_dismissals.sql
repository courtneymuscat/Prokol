-- Client-side dismiss/snooze for autoflow check-in steps
-- ────────────────────────────────────────────────────────
-- Client can dismiss a due step from their dashboard; it stays hidden
-- until snooze_until passes (default: 7 days). Coach can see active snoozes.

CREATE TABLE IF NOT EXISTS public.autoflow_step_dismissals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_autoflow_id uuid REFERENCES public.client_autoflows(id) ON DELETE CASCADE NOT NULL,
  step_number int NOT NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  dismissed_at timestamptz DEFAULT now() NOT NULL,
  snooze_until timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS autoflow_step_dismissals_lookup_idx
  ON public.autoflow_step_dismissals (client_autoflow_id, step_number, snooze_until);

ALTER TABLE public.autoflow_step_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client manages own dismissals" ON public.autoflow_step_dismissals
  FOR ALL USING (auth.uid() = client_id);

CREATE POLICY "Coach reads client dismissals" ON public.autoflow_step_dismissals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_autoflows f
      WHERE f.id = client_autoflow_id AND f.coach_id = auth.uid()
    )
  );
