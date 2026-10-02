-- Gym partnerships Phase 1 foundation.
-- Adds a tenant-type discriminator to organisations (so a gym can reuse the
-- existing org/staff/RLS/branding system instead of a parallel schema),
-- schema-only billing status + template versioning fields that Phase 3/2
-- will need, and the cross-org master-template publishing table.
--
-- Everything here is additive: new columns are nullable or have safe
-- defaults, no existing column/table/constraint is renamed, dropped, or
-- repurposed. Existing rows (incl. Court's own "COURT" organisation) get
-- tenant_type='coaching_business' and billing_status='active' automatically
-- via the column defaults — no backfill script required.

-- organisations: tenant type + billing status
ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS tenant_type text NOT NULL DEFAULT 'coaching_business',
ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.organisations
ADD CONSTRAINT organisations_tenant_type_check
  CHECK (
    tenant_type = any (array[
      'coaching_business'::text,
      'gym'::text
    ])
  );

ALTER TABLE public.organisations
ADD CONSTRAINT organisations_billing_status_check
  CHECK (
    billing_status = any (array[
      'trial'::text,
      'active'::text,
      'past_due'::text,
      'suspended'::text,
      'cancelled'::text,
      'closed'::text
    ])
  );

-- autoflow_templates: version counter for master-library templates.
-- Bumped whenever Court edits a template that's published to one or more
-- gyms; existing enrolments stay on whatever version they started on
-- (see client_autoflows.enrolled_template_version below). Phase 1 just adds
-- the column — the bump-on-edit and version-pinned-content logic is Phase 2.
ALTER TABLE public.autoflow_templates
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- client_autoflows: freezes the template version live when a member
-- enrolled, independent of later master-library edits. Null for all
-- existing enrolments (they predate this feature and aren't on a
-- master-published template anyway).
ALTER TABLE public.client_autoflows
ADD COLUMN IF NOT EXISTS enrolled_template_version integer NULL;

-- coach_invites: lets an invite optionally carry which gym org the invitee
-- is joining, so gym members use the exact same invite-link signup flow as
-- any other client today. Null preserves today's behaviour for every
-- existing/non-gym invite.
ALTER TABLE public.coach_invites
ADD COLUMN IF NOT EXISTS org_id uuid NULL REFERENCES public.organisations(id) ON DELETE SET NULL;

-- master_template_publications: which gym orgs can see/use which master
-- templates. This is deliberately separate from the existing is_org_template
-- sharing (autoflow_templates.org_id/is_org_template), which continues to
-- work unchanged for any org (including a gym) sharing templates among its
-- own staff. A row here means "this specific template has been published,
-- by Court, into this specific gym" — cross-org power that only Court's
-- organisation holds. No FK on (template_id, template_table) since a
-- template can live in one of several tables, matching the existing
-- org_template_exclusions convention.
CREATE TABLE IF NOT EXISTS public.master_template_publications (
  id uuid not null default gen_random_uuid(),
  template_id uuid not null,
  template_table text not null,
  org_id uuid not null references public.organisations(id) on delete cascade,
  published_by uuid not null references auth.users(id) on delete set null,
  published_at timestamp with time zone default now(),
  constraint master_template_publications_pkey primary key (id),
  constraint master_template_publications_unique unique (template_id, template_table, org_id),
  constraint master_template_publications_table_check check (
    template_table = any (array[
      'autoflow_templates'::text,
      'programs'::text,
      'meal_plans'::text,
      'forms'::text,
      'note_templates'::text
    ])
  )
);

ALTER TABLE public.master_template_publications ENABLE ROW LEVEL SECURITY;

-- The target gym org's members can see what's been published to them.
CREATE POLICY "org members can view publications to their org"
  ON public.master_template_publications FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid() AND org_id IS NOT NULL
    )
  );

-- Only platform admins (Court) can create/modify publications. This is the
-- DB-level enforcement of "Court is the sole umbrella over every
-- organisation" — no org, gym or otherwise, can publish its own templates
-- into another org. The API route adds a second check on top (the
-- template's own org_id must match the acting admin's org) — this policy
-- is defense-in-depth, not the only gate.
CREATE POLICY "platform admin manages publications"
  ON public.master_template_publications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run in this order if this migration needs to be reverted):
--
-- DROP POLICY IF EXISTS "platform admin manages publications" ON public.master_template_publications;
-- DROP POLICY IF EXISTS "org members can view publications to their org" ON public.master_template_publications;
-- DROP TABLE IF EXISTS public.master_template_publications;
-- ALTER TABLE public.coach_invites DROP COLUMN IF EXISTS org_id;
-- ALTER TABLE public.client_autoflows DROP COLUMN IF EXISTS enrolled_template_version;
-- ALTER TABLE public.autoflow_templates DROP COLUMN IF EXISTS version;
-- ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS organisations_billing_status_check;
-- ALTER TABLE public.organisations DROP CONSTRAINT IF EXISTS organisations_tenant_type_check;
-- ALTER TABLE public.organisations DROP COLUMN IF EXISTS billing_status;
-- ALTER TABLE public.organisations DROP COLUMN IF EXISTS tenant_type;
-- ───────────────────────────────────────────────────────────────────────────
