-- Lets a coach hide the Food Cheat Sheet's numeric serve-target
-- information from a client's own app (progress bars on Food Log, the
-- "Daily targets" box on the Cheat Sheet) without deleting the
-- client_serve_targets row itself — the coach's own views (serve guide
-- tab, App Preview, printable cheat sheet) are unaffected either way.
-- Mirrors show_saved_meals/show_meal_builder/show_daily_targets, all of
-- which already live on coach_clients rather than on the content table
-- itself, so the preference survives independently of the targets being
-- removed/recreated.
alter table coach_clients add column if not exists show_serve_targets boolean not null default true;
