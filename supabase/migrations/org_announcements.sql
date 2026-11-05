-- ── Org announcements ────────────────────────────────────────────────────────
-- Simple read-only content feed, one per org (gym). A client's profile already
-- carries org_id the moment they join via that gym's signup link (see
-- lib/coach.ts acceptOrgSignupLink) — so membership here is automatic, there's
-- nothing extra to configure per signup link. Posted by the org owner (the
-- platform admin who owns the gym); archived rather than deleted so nothing
-- client-visible ever just vanishes without a trace.

CREATE TABLE IF NOT EXISTS org_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title       text NOT NULL,
  url         text,
  note        text,
  posted_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS org_announcements_org_idx ON org_announcements (org_id, created_at DESC);

ALTER TABLE org_announcements ENABLE ROW LEVEL SECURITY;

-- Only the org's own owner manages announcements — same posture as signup
-- links (canManageSignupLinks in app/admin/orgs/[orgId]/page.tsx).
CREATE POLICY "Org owner manages announcements" ON org_announcements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM organisations o WHERE o.id = org_id AND o.owner_id = auth.uid())
  );

-- Any client whose profile.org_id matches can read non-archived announcements.
CREATE POLICY "Org members read announcements" ON org_announcements
  FOR SELECT USING (
    archived_at IS NULL
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.org_id = org_announcements.org_id)
  );
