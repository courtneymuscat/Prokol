-- Generalises org_signup_links (previously gym-only, free) to also support
-- individual paid signup links Court sells directly, without a gym
-- involved — rather than building a second, near-identical table.
--
-- Court owns every gym she creates, so a gym-link signup already lands in
-- coach_clients under her own coach_id (resolved via organisations.owner_id
-- in lib/coach.ts's acceptOrgSignupLink) — org_id is just a tag, not a
-- different ownership path. The only real deltas for an individual link are
-- (1) no org tag, resolved via a direct coach_id column instead, and (2) an
-- optional price gating enrollment behind a one-time Stripe payment.
--
-- org_signup_link_autoflows (the existing join table) is reused unchanged
-- for both link types.

ALTER TABLE public.org_signup_links
  ALTER COLUMN org_id DROP NOT NULL,
  ADD COLUMN coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN price_cents int,
  ADD COLUMN currency text NOT NULL DEFAULT 'aud';

ALTER TABLE public.org_signup_links
  ADD CONSTRAINT org_signup_links_owner_check CHECK (org_id IS NOT NULL OR coach_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.org_signup_link_purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.org_signup_links(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  amount_cents int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_signup_link_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin manages signup link purchases"
  ON public.org_signup_link_purchases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run in this order if this migration needs to be reverted):
--
-- DROP POLICY IF EXISTS "platform admin manages signup link purchases" ON public.org_signup_link_purchases;
-- DROP TABLE IF EXISTS public.org_signup_link_purchases;
-- ALTER TABLE public.org_signup_links DROP CONSTRAINT IF EXISTS org_signup_links_owner_check;
-- ALTER TABLE public.org_signup_links DROP COLUMN IF EXISTS currency;
-- ALTER TABLE public.org_signup_links DROP COLUMN IF EXISTS price_cents;
-- ALTER TABLE public.org_signup_links DROP COLUMN IF EXISTS coach_id;
-- ALTER TABLE public.org_signup_links ALTER COLUMN org_id SET NOT NULL;
-- ───────────────────────────────────────────────────────────────────────────
