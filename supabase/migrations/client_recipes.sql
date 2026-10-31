-- Client-owned recipes ("My Recipes") — distinct from the coach-authored
-- `recipes`/`recipe_ingredients` tables (coach_id-scoped, not client-
-- facing) and distinct from `meals`/`meal_items` ("Saved Meals", a flat
-- whole-meal log with no reuse-as-ingredient or fractional-serving
-- concept). Same ingredient-rows-with-denormalised-totals shape as the
-- coach recipes table, computed in application code on every save (see
-- app/api/client/my-recipes/route.ts), scoped to the client instead.
--
-- `servings` is optional — when set, the recipe can be logged as "N of
-- servings" in addition to always-available gram-based logging.

create table if not exists public.client_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  instructions text,
  servings int,
  total_grams numeric not null default 0,
  total_calories numeric not null default 0,
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists client_recipes_user_id_idx on public.client_recipes(user_id);

create table if not exists public.client_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.client_recipes(id) on delete cascade,
  food_id uuid,
  food_name text not null,
  grams numeric not null,
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  sort_order int not null default 0
);

create index if not exists client_recipe_ingredients_recipe_id_idx on public.client_recipe_ingredients(recipe_id);

alter table public.client_recipes enable row level security;
alter table public.client_recipe_ingredients enable row level security;

create policy "client manages own recipes"
  on public.client_recipes for all
  using (user_id = auth.uid());

create policy "client manages own recipe ingredients"
  on public.client_recipe_ingredients for all
  using (
    exists (
      select 1 from public.client_recipes
      where id = client_recipe_ingredients.recipe_id and user_id = auth.uid()
    )
  );

-- Marks a `foods` row as mirrored from a client recipe (see
-- app/api/client/my-recipes/route.ts) — lets the recipe be searched and
-- added to any other meal by weight through the existing food-search UI,
-- with no changes needed there. Nullable/additive; existing foods rows
-- are unaffected. Cascades so deleting/resyncing a recipe cleans up its
-- mirrored food automatically.
alter table public.foods
  add column if not exists source_client_recipe_id uuid references public.client_recipes(id) on delete cascade;

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run in this order if this migration needs to be reverted):
--
-- ALTER TABLE public.foods DROP COLUMN IF EXISTS source_client_recipe_id;
-- DROP POLICY IF EXISTS "client manages own recipe ingredients" ON public.client_recipe_ingredients;
-- DROP POLICY IF EXISTS "client manages own recipes" ON public.client_recipes;
-- DROP TABLE IF EXISTS public.client_recipe_ingredients;
-- DROP TABLE IF EXISTS public.client_recipes;
-- ───────────────────────────────────────────────────────────────────────────
