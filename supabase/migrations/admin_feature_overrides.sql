-- Admin-controlled feature flag overrides.
-- Rows here take precedence over the hardcoded defaults in lib/features.ts.
-- Only accessed via service-role client (admin API routes) — RLS is enabled
-- but no policies are created so row-level access is blocked for anon/user roles.

CREATE TABLE IF NOT EXISTS admin_feature_overrides (
  feature    text        NOT NULL,
  tier       text        NOT NULL,
  enabled    boolean     NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (feature, tier)
);

ALTER TABLE admin_feature_overrides ENABLE ROW LEVEL SECURITY;
