-- client_goals had only a (coach_id, client_id) composite index, which a
-- btree can't use for a client_id-only lookup (the leftmost column is
-- coach_id) — found while investigating why the client dashboard's Goals
-- panel felt slow to load. The client-facing GET (app/api/client/goals/
-- route.ts) filters by client_id alone.
create index if not exists client_goals_client_id_idx on public.client_goals using btree (client_id);
