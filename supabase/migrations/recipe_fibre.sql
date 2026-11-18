-- Extends fibre tracking (see food_log_fibre.sql) into Saved Meals and
-- Recipes/My Recipes. Purely additive (nullable columns, no defaults) so
-- existing rows and every current read/write path are unaffected.
alter table meal_items add column if not exists fibre numeric;
alter table recipes add column if not exists total_fibre numeric;
alter table recipe_ingredients add column if not exists fibre numeric;
alter table client_recipes add column if not exists total_fibre numeric;
alter table client_recipe_ingredients add column if not exists fibre numeric;
