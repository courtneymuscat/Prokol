-- Org-publish support for coach_resources so admins can share a resource
-- library (links, PDFs, docs, videos) with all invited coaches.

ALTER TABLE public.coach_resources
ADD COLUMN IF NOT EXISTS org_id uuid null references public.organisations(id) on delete cascade,
ADD COLUMN IF NOT EXISTS is_org_template boolean not null default false,
ADD COLUMN IF NOT EXISTS created_by uuid null references auth.users(id) on delete set null;

CREATE INDEX IF NOT EXISTS coach_resources_org_template_idx
  ON public.coach_resources (org_id, is_org_template)
  WHERE is_org_template = true;
