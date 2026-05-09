-- Org-publish support for services so admins can publish a single set of
-- service offerings (with shared ToS, payment links, etc.) for invited coaches
-- to use, instead of every coach maintaining their own.

ALTER TABLE public.coach_services
ADD COLUMN IF NOT EXISTS org_id uuid null references public.organisations(id) on delete cascade,
ADD COLUMN IF NOT EXISTS is_org_template boolean not null default false,
ADD COLUMN IF NOT EXISTS created_by uuid null references auth.users(id) on delete set null;

CREATE INDEX IF NOT EXISTS coach_services_org_template_idx
  ON public.coach_services (org_id, is_org_template)
  WHERE is_org_template = true;
