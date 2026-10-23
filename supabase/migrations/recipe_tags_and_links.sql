-- Lets a coach tag a recipe's diet compatibility (can be more than one —
-- e.g. a dish can be both vegan and dairy_free) and, separately from the
-- recipe name, which calorie tier it belongs to (for the Cal Conscious /
-- Balanced / Bigger / Gainer framework). Also lets a coach attach a link
-- (e.g. a product page) to an individual ingredient line.
alter table recipes
  add column if not exists diet_tags text[] not null default '{}'::text[],
  add column if not exists tier_tag text;

alter table recipes
  add constraint recipes_tier_tag_check
  check (tier_tag is null or tier_tag in ('cal_conscious', 'balanced', 'bigger', 'gainer'));

alter table recipe_ingredients
  add column if not exists link text;
