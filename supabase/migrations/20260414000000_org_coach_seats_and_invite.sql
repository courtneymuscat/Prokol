-- Add coach seat tracking to organisations
ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS coach_seat_limit integer not null default 3,
ADD COLUMN IF NOT EXISTS coach_seat_count integer not null default 0;

-- Org invite tokens table (for email-based coach invites without existing account)
CREATE TABLE IF NOT EXISTS public.org_invites (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role text not null default 'coach',
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone default now() + interval '7 days',
  accepted_at timestamp with time zone null,
  is_active boolean not null default true,
  constraint org_invites_pkey primary key (id)
);

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org owner and admin can manage invites"
  ON public.org_invites FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
    )
  );

CREATE POLICY "anyone can read invite by token"
  ON public.org_invites FOR SELECT
  USING (is_active = true AND expires_at > now());
