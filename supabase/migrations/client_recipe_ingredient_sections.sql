-- Lets a client group a recipe's ingredients into named sections (e.g. a
-- caramel slice's "Base" / "Centre" / "Top") instead of one flat list.
-- Nullable/additive — ingredients with no section render exactly as
-- before.

alter table public.client_recipe_ingredients
  add column if not exists section text;
