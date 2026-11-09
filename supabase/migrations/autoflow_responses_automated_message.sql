alter table public.autoflow_responses add column if not exists automated_message_sent text null;
alter table public.autoflow_responses add column if not exists automated_message_sent_at timestamptz null;
alter table public.autoflow_responses add column if not exists automated_message_severity text null;
