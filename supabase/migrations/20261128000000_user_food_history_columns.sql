-- Make user_food_history actually storable.
--
-- The "recent foods" feature has never worked: every insert names columns
-- this table does not have (name, calories_per_100g, protein_per_100g,
-- carbs_per_100g, fat_per_100g, unit), and the reads order by `logged_at`,
-- which is really `last_used`. The writes are fire-and-forget, so each one
-- failed silently — 138 foods logged, zero history rows, and an empty
-- "recent" list before the client has typed anything.
--
-- Snapshotting name and macros rather than joining food_database on food_id
-- is deliberate: a search result can come from the food database, the
-- client's own custom foods, or an Open Food Facts barcode lookup, and only
-- the first of those has a uuid that food_id can hold. Storing the values
-- means every source can appear in recents.

alter table public.user_food_history
  add column if not exists name              text,
  add column if not exists calories_per_100g numeric,
  add column if not exists protein_per_100g  numeric,
  add column if not exists carbs_per_100g    numeric,
  add column if not exists fat_per_100g      numeric,
  add column if not exists unit              text;

-- Inserts don't set this, so it has to fill itself in.
alter table public.user_food_history
  alter column last_used set default now();

-- The only read this table serves: newest first for one user.
create index if not exists user_food_history_user_recent_idx
  on public.user_food_history (user_id, last_used desc);
