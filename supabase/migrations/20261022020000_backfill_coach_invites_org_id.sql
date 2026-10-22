-- Companion to 20261022010000_backfill_coach_clients_org_id.sql — same bug,
-- same fix, for coach_invites instead of coach_clients. The pending-invites
-- lookup on app/coach/clients/page.tsx filtered by coach_id alone, which
-- would leak a pending (not-yet-accepted) invite into every org the same
-- coach owns. Only one row in production was actually status='pending' at
-- backfill time (the rest are historical accepted/revoked rows, which this
-- still tags correctly for consistency even though they're excluded by the
-- pending-only filter anyway). Same home_org_id-based logic as the
-- coach_clients backfill — see that migration for why the stable
-- home_org_id is used rather than whichever org happens to be active.

UPDATE public.coach_invites ci
SET org_id = p.home_org_id
FROM public.profiles p
WHERE ci.coach_id = p.id
  AND p.home_org_id IS NOT NULL
  AND ci.org_id IS NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK: there is no clean rollback for a backfill. If ever needed,
-- restore from a pre-migration snapshot instead.
-- ───────────────────────────────────────────────────────────────────────────
