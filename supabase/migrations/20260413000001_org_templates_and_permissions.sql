-- Org template sharing: add org_id + is_org_template flag to content tables
-- This lets org owners publish templates visible to all coaches in their org
-- while coaches keep their private templates (org_id null, is_org_template false)

ALTER TABLE public.autoflow_templates
ADD COLUMN IF NOT EXISTS org_id uuid null references public.organisations(id) on delete cascade,
ADD COLUMN IF NOT EXISTS is_org_template boolean not null default false,
ADD COLUMN IF NOT EXISTS created_by uuid null references auth.users(id) on delete set null;

ALTER TABLE public.programs
ADD COLUMN IF NOT EXISTS org_id uuid null references public.organisations(id) on delete cascade,
ADD COLUMN IF NOT EXISTS is_org_template boolean not null default false,
ADD COLUMN IF NOT EXISTS created_by uuid null references auth.users(id) on delete set null;

ALTER TABLE public.meal_plans
ADD COLUMN IF NOT EXISTS org_id uuid null references public.organisations(id) on delete cascade,
ADD COLUMN IF NOT EXISTS is_org_template boolean not null default false,
ADD COLUMN IF NOT EXISTS created_by uuid null references auth.users(id) on delete set null;

ALTER TABLE public.forms
ADD COLUMN IF NOT EXISTS org_id uuid null references public.organisations(id) on delete cascade,
ADD COLUMN IF NOT EXISTS is_org_template boolean not null default false,
ADD COLUMN IF NOT EXISTS created_by uuid null references auth.users(id) on delete set null;

ALTER TABLE public.note_templates
ADD COLUMN IF NOT EXISTS org_id uuid null references public.organisations(id) on delete cascade,
ADD COLUMN IF NOT EXISTS is_org_template boolean not null default false,
ADD COLUMN IF NOT EXISTS created_by uuid null references auth.users(id) on delete set null;

-- Org permissions table: granular toggles per coach
-- Owner sets these; coaches cannot change their own permissions
CREATE TABLE IF NOT EXISTS public.org_coach_permissions (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  can_view_all_clients boolean not null default false,
  can_reassign_clients boolean not null default false,
  can_use_org_templates boolean not null default true,
  can_message_all_clients boolean not null default false,
  can_view_org_analytics boolean not null default false,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamp with time zone default now(),
  constraint org_coach_permissions_pkey primary key (id),
  constraint org_coach_permissions_unique unique (org_id, coach_id)
);

ALTER TABLE public.org_coach_permissions ENABLE ROW LEVEL SECURITY;

-- Coaches can read their own permissions
CREATE POLICY "coaches can view own permissions"
  ON public.org_coach_permissions FOR SELECT
  USING (coach_id = auth.uid());

-- Only org owner and admin can manage permissions
CREATE POLICY "org owner and admin can manage permissions"
  ON public.org_coach_permissions FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
    )
  );

-- Client reassignment log: audit trail of who moved which client
CREATE TABLE IF NOT EXISTS public.org_client_assignments (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  from_coach_id uuid null references auth.users(id) on delete set null,
  to_coach_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamp with time zone default now(),
  note text null,
  constraint org_client_assignments_pkey primary key (id)
);

ALTER TABLE public.org_client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view assignment history"
  ON public.org_client_assignments FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "org owner and admin can assign clients"
  ON public.org_client_assignments FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
    )
  );
