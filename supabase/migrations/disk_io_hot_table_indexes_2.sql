-- Second pass of the same sweep (disk_io_hot_table_indexes.sql) — these
-- tables had only a primary-key index despite being filtered by
-- client_id/coach_id/form_id/submission_id/program_id in hot paths, and
-- several already showed thousands of sequential scans. All are
-- per-client or per-form/per-submission tables that will grow linearly
-- with real signups.
create index if not exists habits_client_id_idx on public.habits using btree (client_id);
create index if not exists checkin_schedules_client_id_idx on public.checkin_schedules using btree (client_id);
create index if not exists checkin_schedules_coach_id_idx on public.checkin_schedules using btree (coach_id);
create index if not exists client_plans_client_id_idx on public.client_plans using btree (client_id);
create index if not exists client_programs_client_id_idx on public.client_programs using btree (client_id);
create index if not exists client_programs_program_id_idx on public.client_programs using btree (program_id);
create index if not exists form_questions_form_id_idx on public.form_questions using btree (form_id);
create index if not exists form_answers_submission_id_idx on public.form_answers using btree (submission_id);
