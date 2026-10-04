-- Per-coach allowlist for master templates. Deliberately the OPPOSITE
-- polarity of org_template_exclusions (a denylist, default-open — presence
-- of a row there means "excluded"). Here, presence of a row means "has
-- access"; absence means no access. A master template being published to
-- an org (master_template_publications) does not by itself let any coach
-- in that org see or assign it — Court must explicitly grant each coach
-- access via a row in this table. Kept as a separate table rather than
-- reusing org_template_exclusions with inverted meaning, which would be a
-- standing source of confusion.

CREATE TABLE IF NOT EXISTS public.master_template_coach_access (
  id uuid not null default gen_random_uuid(),
  template_id uuid not null,
  template_table text not null,
  org_id uuid not null references public.organisations(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid null references auth.users(id) on delete set null,
  granted_at timestamp with time zone default now(),
  constraint master_template_coach_access_pkey primary key (id),
  constraint master_template_coach_access_unique unique (template_id, template_table, org_id, coach_id)
);

ALTER TABLE public.master_template_coach_access ENABLE ROW LEVEL SECURITY;

-- A coach can see which master templates they personally have been
-- granted — used to double-check their own access, not to browse others'.
CREATE POLICY "coach can view own master template grants"
  ON public.master_template_coach_access FOR SELECT
  USING (coach_id = auth.uid());

-- Only platform admins (Court) can grant/revoke — this is the DB-level
-- enforcement to go with the app-level canPublishMasterTemplate() check in
-- lib/org.ts (which additionally verifies the template belongs to the
-- admin's own org before granting).
CREATE POLICY "platform admin manages master template coach access"
  ON public.master_template_coach_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK:
--
-- DROP POLICY IF EXISTS "platform admin manages master template coach access" ON public.master_template_coach_access;
-- DROP POLICY IF EXISTS "coach can view own master template grants" ON public.master_template_coach_access;
-- DROP TABLE IF EXISTS public.master_template_coach_access;
-- ───────────────────────────────────────────────────────────────────────────
