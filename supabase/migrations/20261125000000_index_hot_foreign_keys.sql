-- Covering indexes for foreign keys on the tables that actually grow with
-- usage — one row per meal logged, message sent, check-in submitted.
--
-- Supabase's performance advisor flagged 116 unindexed foreign keys. Most sit
-- on configuration and admin tables that hold a handful of rows and are never
-- filtered by that column; indexing those only adds write cost and would show
-- up in the advisor's own "unused index" list. These are the subset the app
-- genuinely queries by, or joins through, on every page load.
--
-- Deliberately plain CREATE INDEX rather than CONCURRENTLY: these tables are
-- small today, so the build is effectively instantaneous, and CONCURRENTLY
-- cannot run inside the migration's transaction.

-- Check-ins and autoflow responses — read on every coach review screen
create index if not exists autoflow_responses_client_id_idx            on public.autoflow_responses (client_id);
create index if not exists autoflow_response_flags_client_id_idx       on public.autoflow_response_flags (client_id);
create index if not exists autoflow_step_dismissals_client_id_idx      on public.autoflow_step_dismissals (client_id);
create index if not exists autoflow_step_nutrition_client_id_idx       on public.autoflow_step_nutrition_instances (client_id);
create index if not exists autoflow_step_nutrition_plan_id_idx         on public.autoflow_step_nutrition_instances (client_meal_plan_id);
create index if not exists checkins_client_id_idx                      on public.checkins (client_id);
create index if not exists checkin_answers_checkin_id_idx              on public.checkin_answers (checkin_id);
create index if not exists form_answers_question_id_idx                on public.form_answers (question_id);

-- Messaging — the conversation list resolves by client, unread counts by sender
create index if not exists conversations_client_id_idx                 on public.conversations (client_id);
create index if not exists messages_sender_id_idx                      on public.messages (sender_id);

-- Per-client tracking data — grows every day each client uses the app
create index if not exists habit_logs_client_id_idx                    on public.habit_logs (client_id);
create index if not exists habits_coach_id_idx                         on public.habits (coach_id);
create index if not exists progress_photos_user_id_idx                 on public.progress_photos (user_id);
create index if not exists workout_exercises_exercise_id_idx           on public.workout_exercises (exercise_id);
create index if not exists exercise_sets_workout_exercise_id_idx       on public.exercise_sets (workout_exercise_id);

-- Coach-side client records
create index if not exists client_resource_access_client_id_idx        on public.client_resource_access (client_id);
create index if not exists client_resource_access_coach_id_idx         on public.client_resource_access (coach_id);
create index if not exists client_files_client_id_idx                  on public.client_files (client_id);
create index if not exists client_files_coach_id_idx                   on public.client_files (coach_id);
create index if not exists client_programs_coach_id_idx                on public.client_programs (coach_id);
create index if not exists coach_notes_client_id_idx                   on public.coach_notes (client_id);
