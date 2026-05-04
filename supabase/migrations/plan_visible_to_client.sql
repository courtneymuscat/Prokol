ALTER TABLE public.client_plans
  ADD COLUMN IF NOT EXISTS is_visible_to_client boolean NOT NULL DEFAULT false;
