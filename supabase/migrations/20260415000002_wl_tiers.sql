-- Add white-label subscription tiers to profiles constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_subscription_tier_check CHECK (
  subscription_tier = any (array[
    'individual_free'::text,
    'individual_optimiser'::text,
    'individual_elite'::text,
    'coached'::text,
    'coach_solo'::text,
    'coach_pro'::text,
    'coach_business'::text,
    'wl_starter'::text,
    'wl_pro'::text
  ])
);

-- Add seat count tracking columns to organisations for WL billing
ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS coach_seat_count integer not null default 0;

ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS client_seat_count integer not null default 0;
