-- Gym org-switching: lets the platform admin "enter" any gym she owns as
-- its real owner-coach (reusing the entire existing coach dashboard, not a
-- parallel admin UI), then "exit" cleanly back to her own organisation.
--
-- home_org_id is the org to return to on exit. Only meaningful for an
-- account that acts as more than one organisation — today, only Court's
-- platform-admin account. Left null for every other profile; backfilled
-- below for Court specifically (home_org_id = her current org_id, i.e.
-- COURT), not for every profile with an org_id, since this column has no
-- purpose for an ordinary coach or org member who will never "switch."

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS home_org_id uuid NULL REFERENCES public.organisations(id) ON DELETE SET NULL;

UPDATE public.profiles
SET home_org_id = org_id
WHERE role = 'platform_admin' AND org_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run in this order if this migration needs to be reverted):
--
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS home_org_id;
-- ───────────────────────────────────────────────────────────────────────────
