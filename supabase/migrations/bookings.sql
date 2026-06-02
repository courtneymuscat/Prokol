-- Coach bookings: services, weekly availability, and scheduled bookings.
-- All times are stored as UTC (timestamptz). Each booking snapshots the
-- coach and client IANA timezone strings at booking time so historical
-- bookings remain readable even if profile timezones change later.

-- ── Booking-able services (session types) the coach offers ─────────────────
-- Distinct from public.coach_services, which is the signup/invite payment
-- service catalogue. Booking services are appointment types ("PT Session",
-- "Nutrition Call") with a duration, billing mode, and optional monthly
-- quota included in the client's subscription.
CREATE TABLE IF NOT EXISTS public.booking_services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  duration_minutes int NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  -- subscription = included in client's plan up to quota_per_month
  -- separate     = billed separately each session (payment_link used)
  billing_mode text NOT NULL DEFAULT 'separate'
    CHECK (billing_mode IN ('subscription', 'separate')),
  payment_link text,
  -- Total sessions of this service included in the client's subscription
  -- before extra billing kicks in. NULL = unlimited.
  quota_total int CHECK (quota_total IS NULL OR quota_total >= 0),
  color text DEFAULT '#1D9E75',
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages own booking services"
  ON public.booking_services
  FOR ALL USING (auth.uid() = coach_id);
CREATE POLICY "Clients read their coach's booking services"
  ON public.booking_services
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.coach_clients cc
      WHERE cc.coach_id = booking_services.coach_id
        AND cc.client_id = auth.uid()
        AND cc.status = 'active'
    )
  );
CREATE INDEX IF NOT EXISTS booking_services_coach_idx
  ON public.booking_services (coach_id) WHERE active = true;

-- ── Coach weekly availability (clinic-style) ────────────────────────────────
-- start_time/end_time are interpreted in the coach's profile.timezone.
CREATE TABLE IF NOT EXISTS public.coach_availability (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  label text,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages own availability"
  ON public.coach_availability
  FOR ALL USING (auth.uid() = coach_id);
CREATE POLICY "Clients read their coach's availability"
  ON public.coach_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.coach_clients cc
      WHERE cc.coach_id = coach_availability.coach_id
        AND cc.client_id = auth.uid()
        AND cc.status = 'active'
    )
  );

-- ── Bookings (the actual scheduled appointments) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES public.booking_services(id) ON DELETE SET NULL,
  -- Snapshot of service name + color so cancelled-service rows still render
  service_name text NOT NULL,
  service_color text DEFAULT '#1D9E75',
  -- UTC instant + duration
  start_at timestamptz NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  -- IANA tz snapshots at booking time
  coach_tz text NOT NULL,
  client_tz text NOT NULL,
  -- Lifecycle
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'included', 'waived', 'refunded')),
  -- Recurrence: every row in a recurring set shares a series_id.
  -- recurrence_rule is set on the first row of the series for display
  -- (e.g. "FREQ=WEEKLY;COUNT=12").
  series_id uuid,
  recurrence_rule text,
  -- Details
  location text,
  meeting_url text,
  notes text,             -- visible to client
  coach_notes text,       -- coach-only
  payment_link text,      -- per-booking override of service payment_link
  -- Reminder bookkeeping (set by the reminder cron)
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  -- Cancellation
  cancelled_at timestamptz,
  cancelled_by text CHECK (cancelled_by IS NULL OR cancelled_by IN ('coach','client','system')),
  cancellation_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages own bookings"
  ON public.bookings
  FOR ALL USING (auth.uid() = coach_id);
CREATE POLICY "Client reads own bookings"
  ON public.bookings
  FOR SELECT USING (auth.uid() = client_id);

CREATE INDEX IF NOT EXISTS bookings_coach_start_idx
  ON public.bookings (coach_id, start_at);
CREATE INDEX IF NOT EXISTS bookings_client_start_idx
  ON public.bookings (client_id, start_at);
CREATE INDEX IF NOT EXISTS bookings_series_idx
  ON public.bookings (series_id) WHERE series_id IS NOT NULL;
-- Hot path for the reminder cron — only un-sent confirmed bookings.
CREATE INDEX IF NOT EXISTS bookings_pending_reminders_idx
  ON public.bookings (start_at)
  WHERE status = 'confirmed'
    AND (reminder_24h_sent_at IS NULL OR reminder_1h_sent_at IS NULL);
