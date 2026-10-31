-- Platform-wide Meal Library: lets Court (platform admin) flag a handful of
-- her own recipes as visible to every coach, every coached client, and
-- (gated behind the Optimiser+ individual tier) every individual user —
-- not just her own clients. Modeled on foods' "globally readable, narrowly
-- owned" RLS shape rather than master_template_publications (org-scoped,
-- wrong fit for reaching literally everyone with no per-org admin step).
--
-- Write access is unchanged everywhere (coach_id = auth.uid() only) — being
-- global grants read access, never edit/delete rights, to anyone but the
-- recipe's actual author.
alter table recipes add column if not exists is_global boolean not null default false;

create index if not exists recipes_is_global_idx on recipes(is_global) where is_global = true;

drop policy if exists "recipes_select" on recipes;
create policy "recipes_select" on recipes
  for select using (coach_id = auth.uid() or is_global = true);

drop policy if exists "recipe_ingredients_select" on recipe_ingredients;
create policy "recipe_ingredients_select" on recipe_ingredients
  for select using (exists (
    select 1 from recipes r where r.id = recipe_ingredients.recipe_id
    and (r.coach_id = auth.uid() or r.is_global = true)
  ));

drop policy if exists "recipe_modifications_select" on recipe_modifications;
create policy "recipe_modifications_select" on recipe_modifications
  for select using (exists (
    select 1 from recipes r where r.id = recipe_modifications.recipe_id
    and (r.coach_id = auth.uid() or r.is_global = true)
  ));
