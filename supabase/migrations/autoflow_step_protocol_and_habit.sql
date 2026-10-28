-- Autoflow step protocol note + trackable habit
-- ────────────────────────────────────────────────────────
-- Lets a coach attach an optional protocol note and/or a trackable habit
-- to an individual autoflow step (e.g. a course lesson). Both are
-- template-level content. The protocol note is purely informational and
-- simply shows/hides with the step's own due/complete state — no extra
-- row needed, it just rides along in the due-steps response.
--
-- The habit is different: it becomes a REAL per-client `habits` row (so
-- the client can actually check it off day to day, same as any habit the
-- coach adds by hand) the moment its step becomes due, and is deactivated
-- (not deleted — keeps log history for the coach to look back on) the
-- moment the step is completed or superseded by the next one.

alter table autoflow_template_steps
  add column if not exists protocol_section jsonb,  -- { title: string, content: string } | null
  add column if not exists habit jsonb;              -- { name: string, icon: string, unit: string, target: number } | null

-- Tracks which real `habits` row (if any) was auto-created for a given
-- client's autoflow step, so it can be found again (avoid duplicates on
-- every due-steps poll) and deactivated later without touching any habit
-- the coach created by hand for that client.
create table if not exists autoflow_step_habit_instances (
  id uuid primary key default gen_random_uuid(),
  client_autoflow_id uuid references client_autoflows(id) on delete cascade not null,
  step_number int not null,
  habit_id uuid references habits(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(client_autoflow_id, step_number)
);

alter table autoflow_step_habit_instances enable row level security;

create policy "Coach manages step habit instances" on autoflow_step_habit_instances
  for all using (
    exists (
      select 1 from client_autoflows f
      where f.id = client_autoflow_id and f.coach_id = auth.uid()
    )
  );

create policy "Client reads own step habit instances" on autoflow_step_habit_instances
  for select using (
    exists (
      select 1 from client_autoflows f
      where f.id = client_autoflow_id and f.client_id = auth.uid()
    )
  );
