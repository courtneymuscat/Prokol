-- Recipe library: a coach builds named, multi-ingredient recipes (each
-- ingredient a flat gram/macro row, same shape as a meal-plan MealFood) with
-- authored "modification notes" teaching a client how to make the dish more
-- or less calorie/macro-dense for their goal. Recipes are assigned into meal
-- plans in a later migration/feature; this migration only covers the library
-- itself.
--
-- org_id is included from day one (not bolted on later) given this session's
-- cross-org-leak sweep: a coach who owns more than one organisation (gym
-- org-switching, see lib/admin.ts enterGymOrg) is still the same coach_id in
-- every one of them, so every list/aggregate query against this table must
-- filter by org_id too, from the very first query written against it.

create table recipes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  org_id uuid references organisations(id) on delete cascade,
  name text not null,
  category text,                             -- 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert'
  instructions text,                         -- cooking steps, single text block
  image_url text,
  total_calories numeric not null default 0, -- denormalised sum of recipe_ingredients, recomputed server-side on every save
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  food_id uuid,              -- optional link into food_database/foods, same as MealFood.food_id
  food_name text not null,
  grams numeric not null,
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  sort_order int not null default 0
);

create table recipe_modifications (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  tag text not null,         -- 'protein_up' | 'protein_down' | 'carbs_up' | 'carbs_down' | 'fat_up' | 'fat_down' | 'calories_up' | 'calories_down' | 'volume_up' | 'general'
  note text not null,
  sort_order int not null default 0
);

create index recipes_coach_id_idx on recipes(coach_id);
create index recipe_ingredients_recipe_id_idx on recipe_ingredients(recipe_id);
create index recipe_modifications_recipe_id_idx on recipe_modifications(recipe_id);

alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_modifications enable row level security;

create policy "recipes_select" on recipes
  for select using (coach_id = auth.uid());
create policy "recipes_insert" on recipes
  for insert with check (coach_id = auth.uid());
create policy "recipes_update" on recipes
  for update using (coach_id = auth.uid());
create policy "recipes_delete" on recipes
  for delete using (coach_id = auth.uid());

create policy "recipe_ingredients_select" on recipe_ingredients
  for select using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.coach_id = auth.uid()));
create policy "recipe_ingredients_insert" on recipe_ingredients
  for insert with check (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.coach_id = auth.uid()));
create policy "recipe_ingredients_update" on recipe_ingredients
  for update using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.coach_id = auth.uid()));
create policy "recipe_ingredients_delete" on recipe_ingredients
  for delete using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.coach_id = auth.uid()));

create policy "recipe_modifications_select" on recipe_modifications
  for select using (exists (select 1 from recipes r where r.id = recipe_modifications.recipe_id and r.coach_id = auth.uid()));
create policy "recipe_modifications_insert" on recipe_modifications
  for insert with check (exists (select 1 from recipes r where r.id = recipe_modifications.recipe_id and r.coach_id = auth.uid()));
create policy "recipe_modifications_update" on recipe_modifications
  for update using (exists (select 1 from recipes r where r.id = recipe_modifications.recipe_id and r.coach_id = auth.uid()));
create policy "recipe_modifications_delete" on recipe_modifications
  for delete using (exists (select 1 from recipes r where r.id = recipe_modifications.recipe_id and r.coach_id = auth.uid()));
