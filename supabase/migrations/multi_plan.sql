-- Allow multiple plans per client-coach pair
ALTER TABLE public.client_plans
  DROP CONSTRAINT IF EXISTS client_plans_client_id_coach_id_key;
