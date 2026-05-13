-- Per-(client_autoflow, step) log of automated_message deliveries.
-- Used by the push-reminders cron to deduplicate messages so a stuck
-- step doesn't get its automated_message resent every hourly tick.
-- Also written by the assign route (day_offset=0 case) and the client
-- step submit route (on_step_complete case) so all three delivery paths
-- share one source of truth.

CREATE TABLE IF NOT EXISTS public.client_autoflow_message_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_autoflow_id uuid REFERENCES public.client_autoflows(id) ON DELETE CASCADE NOT NULL,
  step_number int NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_autoflow_id, step_number)
);

ALTER TABLE public.client_autoflow_message_log ENABLE ROW LEVEL SECURITY;

-- The service role (cron, server routes) is the only writer. No direct
-- client or coach reads are exposed.
