-- Switch booking_services from per-month quotas to total-session quotas.
-- A quota now means "this client gets N sessions of this service, period"
-- (e.g. a 12-pack). Cancellation re-opens a slot for the next pending
-- booking, handled in app code by recomputeQuotaAssignment().
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'booking_services'
      AND column_name  = 'quota_per_month'
  ) THEN
    ALTER TABLE public.booking_services RENAME COLUMN quota_per_month TO quota_total;
  END IF;
END $$;
