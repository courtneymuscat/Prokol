-- Court clarified starting macros for a gym signup link should NOT be a
-- flat number she picks in advance — a gym has no coaching staff to set
-- them manually, so each member gets their own targets from the
-- self-service TDEE onboarding flow they complete right after signing up
-- (see lib/coach.ts's acceptOrgSignupLink). These columns were added and
-- immediately superseded within the same work session, never used by any
-- real signup link.

ALTER TABLE public.org_signup_links
DROP COLUMN IF EXISTS target_calories,
DROP COLUMN IF EXISTS target_protein,
DROP COLUMN IF EXISTS target_carbs,
DROP COLUMN IF EXISTS target_fat;

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run in this order if this migration needs to be reverted):
--
-- ALTER TABLE public.org_signup_links
--   ADD COLUMN target_calories int NULL,
--   ADD COLUMN target_protein int NULL,
--   ADD COLUMN target_carbs int NULL,
--   ADD COLUMN target_fat int NULL;
-- ───────────────────────────────────────────────────────────────────────────
