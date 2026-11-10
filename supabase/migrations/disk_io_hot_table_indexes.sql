-- Fixes the Supabase "Disk IO Budget" warning's root cause: several
-- heavily-queried tables had no index on the columns they're always
-- filtered by, forcing a sequential scan on every single query. The
-- tables themselves are tiny today, but the query VOLUME against them
-- is enormous (profiles alone had 70,000+ sequential scans against a
-- 17-row table) — and seq scans get linearly more expensive as each
-- table grows with real user signups, so this matters far more at
-- 1000+ users than it does today.
create index if not exists check_ins_user_id_idx on public.check_ins using btree (user_id);
create index if not exists client_autoflows_client_id_idx on public.client_autoflows using btree (client_id);
create index if not exists client_autoflows_coach_id_idx on public.client_autoflows using btree (coach_id);
create index if not exists client_autoflows_template_id_idx on public.client_autoflows using btree (template_id);
create index if not exists client_meal_plans_client_id_idx on public.client_meal_plans using btree (client_id);
create index if not exists client_meal_plans_coach_id_idx on public.client_meal_plans using btree (coach_id);
create index if not exists client_meal_plans_meal_plan_id_idx on public.client_meal_plans using btree (meal_plan_id);
create index if not exists form_submissions_client_id_idx on public.form_submissions using btree (client_id);
create index if not exists form_submissions_form_id_idx on public.form_submissions using btree (form_id);
create index if not exists form_submissions_coach_id_idx on public.form_submissions using btree (coach_id);
create index if not exists profiles_email_idx on public.profiles using btree (email);

-- food_database and exercises search both use ILIKE '%term%' (a leading
-- wildcard), which a plain btree index can never use — Postgres has to
-- scan the whole table every time regardless. pg_trgm's trigram index
-- is the standard fix: it accelerates both '%term%' and 'term%' ILIKE
-- patterns, so one index covers every search variant these two routes
-- actually run (app/api/foods/search/route.ts, app/api/exercises/search/route.ts).
create extension if not exists pg_trgm;
create index if not exists food_database_name_trgm_idx on public.food_database using gin (name gin_trgm_ops);
create index if not exists exercises_name_trgm_idx on public.exercises using gin (name gin_trgm_ops);
