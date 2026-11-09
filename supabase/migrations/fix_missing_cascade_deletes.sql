-- Fix missing ON DELETE CASCADE on a handful of foreign keys to profiles
-- ────────────────────────────────────────────────────────
-- checkin_forms, checkins, client_serve_targets, form_submissions and
-- onboarding_forms all had a client_id/coach_id FK left on the Postgres
-- default of NO ACTION, unlike every other client/coach-referencing FK in
-- this schema (which already cascades). This meant deleting a test user
-- via the Supabase Admin API or Dashboard failed with an opaque/generic
-- error — Postgres was correctly refusing the delete because these rows
-- would've been orphaned, but nothing surfaced that clearly until
-- deleting directly via the Table Editor on `profiles` itself. Bitten
-- twice in one session cleaning up test accounts (courtneymuscat@icloud.com,
-- court@prokol.io) before being traced to this.

alter table checkin_forms drop constraint checkin_forms_coach_id_fkey;
alter table checkin_forms add constraint checkin_forms_coach_id_fkey
  foreign key (coach_id) references profiles(id) on delete cascade;

alter table checkins drop constraint checkins_client_id_fkey;
alter table checkins add constraint checkins_client_id_fkey
  foreign key (client_id) references profiles(id) on delete cascade;

alter table client_serve_targets drop constraint client_serve_targets_coach_id_fkey;
alter table client_serve_targets add constraint client_serve_targets_coach_id_fkey
  foreign key (coach_id) references profiles(id) on delete cascade;

alter table form_submissions drop constraint form_submissions_client_id_fkey;
alter table form_submissions add constraint form_submissions_client_id_fkey
  foreign key (client_id) references profiles(id) on delete cascade;

alter table form_submissions drop constraint form_submissions_coach_id_fkey;
alter table form_submissions add constraint form_submissions_coach_id_fkey
  foreign key (coach_id) references profiles(id) on delete cascade;

alter table onboarding_forms drop constraint onboarding_forms_coach_id_fkey;
alter table onboarding_forms add constraint onboarding_forms_coach_id_fkey
  foreign key (coach_id) references profiles(id) on delete cascade;

alter table onboarding_responses drop constraint onboarding_responses_client_id_fkey;
alter table onboarding_responses add constraint onboarding_responses_client_id_fkey
  foreign key (client_id) references profiles(id) on delete cascade;
