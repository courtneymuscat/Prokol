-- Per-template coach access control
-- A row means that coach is EXCLUDED from accessing that specific template
-- Absence of a row = coach has access (default open)
-- Admins and owners are never excluded regardless of rows

CREATE TABLE IF NOT EXISTS public.org_template_exclusions (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  template_id uuid not null,
  template_table text not null,
  coach_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  constraint org_template_exclusions_pkey primary key (id),
  constraint org_template_exclusions_unique unique (org_id, template_id, template_table, coach_id)
);

ALTER TABLE public.org_template_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins can manage template exclusions"
  ON public.org_template_exclusions FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
    )
  );
