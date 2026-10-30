-- Autoflow step → training program linking
-- ────────────────────────────────────────────────────────
-- Lets a coach mark an autoflow step as "start this program here". The
-- moment that step becomes due for a real client, it auto-assigns the
-- real program to them (a genuine client_programs row, start_date = the
-- day it actually fired for that client) — the same automation pattern
-- already used for habit (see autoflow_step_protocol_and_habit.sql), and
-- the same "fork a template's content into a real per-client row" pattern
-- already used for manual program assignment
-- (app/api/coach/clients/[clientId]/programs/route.ts).
--
-- ID-only, matching resource_ids/form_id on this same table — the
-- program's name/length are resolved live wherever displayed, not
-- snapshotted, so they can't drift from the template.

alter table autoflow_template_steps
  add column if not exists program_link jsonb;  -- { program_id: string } | null

-- Tracks which real client_programs row (if any) was auto-created for a
-- given client's autoflow step, so it only happens once. Unlike habits,
-- there's no deactivation path here — once a program starts, it runs its
-- own course, same as a manually-assigned one would.
create table if not exists autoflow_step_program_instances (
  id uuid primary key default gen_random_uuid(),
  client_autoflow_id uuid references client_autoflows(id) on delete cascade not null,
  step_number int not null,
  client_program_id uuid references client_programs(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(client_autoflow_id, step_number)
);

alter table autoflow_step_program_instances enable row level security;

create policy "Coach manages step program instances" on autoflow_step_program_instances
  for all using (
    exists (
      select 1 from client_autoflows f
      where f.id = client_autoflow_id and f.coach_id = auth.uid()
    )
  );

create policy "Client reads own step program instances" on autoflow_step_program_instances
  for select using (
    exists (
      select 1 from client_autoflows f
      where f.id = client_autoflow_id and f.client_id = auth.uid()
    )
  );
