-- coach_clients.targets_source / targets_meal_plan_id have been referenced
-- by app/dashboard/page.tsx, app/api/coach/clients/[clientId]/settings/route.ts,
-- app/coach/clients/[clientId]/ClientTabs.tsx and ClientServeGuide.tsx since
-- before this migration existed — the columns were simply never created, so
-- every query selecting them failed silently (error swallowed, falling back
-- to hardcoded defaults). This broke two things system-wide for every
-- coached client: the dashboard's "Daily targets" card always fell back to
-- showing targets regardless of the coach's show_daily_targets toggle (the
-- query that reads coach_clients failed before that toggle was ever read),
-- and the coach's own Food log access selector always displayed "Full
-- access" as selected regardless of the real stored value.
alter table coach_clients
  add column if not exists targets_source text default 'tdee',
  add column if not exists targets_meal_plan_id uuid;

alter table coach_clients
  add constraint coach_clients_targets_source_check
  check (targets_source is null or targets_source in ('tdee', 'meal_plan'));
