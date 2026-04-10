-- Add per-client settings to coach_clients
ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS show_daily_targets boolean NOT NULL DEFAULT true;
