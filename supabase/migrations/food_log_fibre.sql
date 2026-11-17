-- Adds optional fibre tracking to food logging. Purely additive (nullable
-- columns, no defaults, no constraints) so existing rows and every current
-- read/write path are unaffected until code explicitly starts using them.
alter table food_logs add column if not exists fibre numeric;
alter table foods add column if not exists fibre_per_100g numeric;
alter table user_food_history add column if not exists fibre_per_100g numeric;
