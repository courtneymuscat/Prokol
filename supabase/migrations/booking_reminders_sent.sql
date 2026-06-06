-- Tracks which (booking, reminder kind) pairs have already been pushed
-- so the hourly cron doesn't double-send. Reschedules delete the matching
-- row so the new time gets a fresh reminder.

CREATE TABLE IF NOT EXISTS public.booking_reminders_sent (
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  kind text NOT NULL,
  sent_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (booking_id, kind)
);

ALTER TABLE public.booking_reminders_sent ENABLE ROW LEVEL SECURITY;
-- Only the service-role cron writes/reads this; no policies for end users.
