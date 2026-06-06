-- Add 'late_cancel' to the bookings.status CHECK constraint.
-- late_cancel behaves like no_show: the booking stays visible on the
-- calendar and still counts toward the service quota — only 'cancelled'
-- bookings are excluded from quota.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show', 'late_cancel'));
