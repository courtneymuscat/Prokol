-- The public.foods table holds coach-created custom foods, but the
-- per-100g macro columns the rest of the app reads/writes (search,
-- custom-food insert, history) were never added — every previous attempt
-- to save a custom food has been failing with "column not found".
-- Idempotent ALTERs so reapplying does nothing.
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS calories_per_100g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS protein_per_100g  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carbs_per_100g    numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fat_per_100g      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit              text,
  ADD COLUMN IF NOT EXISTS user_id           uuid;
