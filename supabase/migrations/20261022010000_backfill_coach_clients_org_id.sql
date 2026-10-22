-- Fixes the exact bug Court hit testing her first gym: every org-scoped
-- client query (app/api/org/clients, app/api/org/coaches, app/api/org/archived,
-- app/api/billing/info, the reassign route) filtered coach_clients by
-- coach_id alone, never org_id. That was invisible while she only ever
-- owned one organisation (COURT) — but gym org-switching (lib/admin.ts
-- enterGymOrg) means the SAME coach_id now owns multiple orgs, so every
-- org's client list leaked every other org's clients too.
--
-- The app-level fix (adding .eq('org_id', ...) to those queries, and
-- writing org_id onto coach_clients at accept-time in lib/coach.ts
-- acceptInvite / app/api/coach/invite/route.ts) only covers clients
-- accepted from here on. This backfills every pre-existing coach_clients
-- row that predates that org_id propagation.
--
-- Deliberately uses profiles.home_org_id (the coach's permanent home org —
-- see lib/admin.ts enterGymOrg/exitToHomeOrg) rather than whichever
-- org_members row currently happens to be is_active=true: that flag is a
-- session-switchable pointer for gym org-switching and is NOT a stable
-- signal for "which org did this legacy client always belong to" — using
-- it here would tag a coach's real, years-old clients to whatever gym they
-- happened to be "acting as" at migration time. (Caught and corrected by
-- hand in production before writing this version of the migration.)
-- Only ever touches a profile that actually has home_org_id set, which
-- today is just the platform admin's own account.

UPDATE public.coach_clients cc
SET org_id = p.home_org_id
FROM public.profiles p
WHERE cc.coach_id = p.id
  AND p.home_org_id IS NOT NULL
  AND cc.org_id IS NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK: there is no clean rollback for a backfill (the prior NULL state
-- isn't recoverable from this migration alone). If ever needed, restore
-- from a pre-migration snapshot instead.
-- ───────────────────────────────────────────────────────────────────────────
