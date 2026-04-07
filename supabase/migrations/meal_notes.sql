-- meal_notes: one note + photo per meal per day per user
create table if not exists public.meal_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  log_date   date not null,
  meal_type  text not null,
  note       text,
  photo_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date, meal_type)
);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger meal_notes_updated_at
  before update on public.meal_notes
  for each row execute function public.set_updated_at();

-- RLS
alter table public.meal_notes enable row level security;

create policy "Users manage own meal notes"
  on public.meal_notes
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
