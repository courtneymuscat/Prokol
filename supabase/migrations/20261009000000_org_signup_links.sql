-- Gym partnerships: reusable per-org signup links.
--
-- Unlike coach_invites (single-recipient, single-use — has an `email`
-- column and a status that flips pending -> accepted after one use), an org
-- signup link is shared with an entire gym's membership: anyone who signs
-- up through it, at any time, gets enrolled the same way. Enrollment is
-- computed at signup time (today's date), not link-creation time, so a
-- member who signs up weeks after Court shares the link still starts on
-- the day they actually join.
--
-- A link can carry more than one autoflow (e.g. a nutrition autoflow and a
-- separate check-in autoflow enrolling simultaneously), hence the join
-- table rather than a single autoflow_id column.

CREATE TABLE IF NOT EXISTS public.org_signup_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  protocol_sections jsonb NULL,
  target_calories int NULL,
  target_protein int NULL,
  target_carbs int NULL,
  target_fat int NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_signup_links_org_id_idx ON public.org_signup_links(org_id);

CREATE TABLE IF NOT EXISTS public.org_signup_link_autoflows (
  link_id uuid NOT NULL REFERENCES public.org_signup_links(id) ON DELETE CASCADE,
  autoflow_id uuid NOT NULL REFERENCES public.autoflow_templates(id) ON DELETE CASCADE,
  PRIMARY KEY (link_id, autoflow_id)
);

ALTER TABLE public.org_signup_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_signup_link_autoflows ENABLE ROW LEVEL SECURITY;

-- Application code reads/writes these exclusively via the service-role
-- client (same pattern as coach_invites — the public /org/join/[code]
-- landing page and signup() can't rely on auth.uid() since the visitor
-- isn't authenticated yet), so the only RLS policy needed is platform-admin
-- management, matching master_template_publications' precedent.
CREATE POLICY "platform admin manages signup links"
  ON public.org_signup_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

CREATE POLICY "platform admin manages signup link autoflows"
  ON public.org_signup_link_autoflows FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run in this order if this migration needs to be reverted):
--
-- DROP POLICY IF EXISTS "platform admin manages signup link autoflows" ON public.org_signup_link_autoflows;
-- DROP POLICY IF EXISTS "platform admin manages signup links" ON public.org_signup_links;
-- DROP TABLE IF EXISTS public.org_signup_link_autoflows;
-- DROP TABLE IF EXISTS public.org_signup_links;
-- ───────────────────────────────────────────────────────────────────────────
