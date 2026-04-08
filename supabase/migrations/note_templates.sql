create table if not exists note_templates (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid references profiles(id) on delete cascade not null,
  name       text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

alter table note_templates enable row level security;

create policy "coach_manage_note_templates" on note_templates
  for all using (coach_id = auth.uid());
