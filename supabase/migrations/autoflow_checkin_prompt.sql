-- Allow coach to flag an assigned autoflow so its due steps appear on client dashboard
ALTER TABLE client_autoflows
  ADD COLUMN IF NOT EXISTS show_as_checkin_prompt boolean NOT NULL DEFAULT false;
