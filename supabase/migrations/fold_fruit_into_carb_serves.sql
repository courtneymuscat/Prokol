-- Fruit used to be tracked as its own serve bucket, but it's measured in
-- the same unit as carbs (20g = 1 serve) and was already summed directly
-- into the same macro total — it added a 4th target number without
-- changing what was actually being counted. Fold it into carbs so the
-- numbers a coach sets, and what a client logs, both work off one
-- consistent "carb serve" bucket.

-- Recategorise any food tagged 'fruit' in a coach's cheat sheet as 'carb'
-- — keeps the food listed, just folds it into the Carbs section instead
-- of its own.
update coach_food_serves
set serve_category = 'carb'
where serve_category = 'fruit';

-- Preserve each client's actual total carb allowance: fold their existing
-- fruit_serves into carb_serves (same 20g-per-serve unit) rather than
-- just dropping it, so nobody's real carb target silently shrinks.
update client_serve_targets
set carb_serves = carb_serves + fruit_serves,
    fruit_serves = 0
where fruit_serves > 0;
