alter table public.messages add column if not exists is_automated boolean not null default false;
