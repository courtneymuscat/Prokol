-- Phase 0 of the tab-loading performance work: add indexes on columns that
-- every query against these tables already filters by (RLS policies filter
-- by these same columns on every single request), but which had no index.
-- Pure DB change — does not alter any query result, only how fast it's
-- computed. CONCURRENTLY avoids locking the tables while building.
--
-- These tables are small today (tens to hundreds of rows), so this isn't
-- what's making things feel slow right now — it's cheap insurance against
-- the sequential scans getting worse as data grows.

create index concurrently if not exists workouts_user_id_idx
  on workouts (user_id);

create index concurrently if not exists workout_exercises_workout_id_idx
  on workout_exercises (workout_id);

create index concurrently if not exists calendar_events_client_id_idx
  on calendar_events (client_id);

create index concurrently if not exists calendar_events_coach_id_idx
  on calendar_events (coach_id);

create index concurrently if not exists weight_logs_user_id_idx
  on weight_logs (user_id);

create index concurrently if not exists food_logs_user_id_log_date_idx
  on food_logs (user_id, log_date);
