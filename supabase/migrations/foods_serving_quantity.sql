-- Persist "1 piece = X g" (and the matching label) on the food record so
-- coaches don't have to re-enter piece weights every time they add the
-- same food to a meal. serving_quantity is in grams; serving_size is the
-- human label ("1 piece", "1 gel", etc).
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS serving_quantity numeric,
  ADD COLUMN IF NOT EXISTS serving_size     text;

ALTER TABLE public.food_database
  ADD COLUMN IF NOT EXISTS serving_quantity numeric,
  ADD COLUMN IF NOT EXISTS serving_size     text;

-- Recent dropdown also remembers the last serving the coach used so it
-- can prefill piece mode without a second round-trip.
ALTER TABLE public.user_food_history
  ADD COLUMN IF NOT EXISTS serving_quantity numeric,
  ADD COLUMN IF NOT EXISTS serving_size     text;
