-- Tracks which (coach, kind, ref_id, end_date) "content running out" reminders
-- have already been pushed, so the hourly cron doesn't re-notify the coach
-- every day while a flow/program is sitting at the same runway. Keying on
-- end_date (not just ref_id) means that if the coach extends the flow or
-- program, the end_date moves and a fresh reminder can fire when it later
-- runs low again.

CREATE TABLE IF NOT EXISTS public.coach_content_reminders_sent (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  kind text NOT NULL, -- 'autoflow_ending' | 'program_ending'
  ref_id uuid NOT NULL, -- client_autoflows.id or client_programs.id
  end_date date NOT NULL,
  sent_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(kind, ref_id, end_date)
);

ALTER TABLE public.coach_content_reminders_sent ENABLE ROW LEVEL SECURITY;
-- Only the service-role cron writes/reads this; no policies for end users.
