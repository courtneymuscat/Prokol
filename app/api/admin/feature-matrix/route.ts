import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/admin'
import {
  FEATURE_GROUPS,
  MATRIX_TIERS,
  defaultEnabled,
  type OverrideMap,
} from '@/lib/feature-matrix'
import type { Feature, SubscriptionTier } from '@/lib/features'
import type { NextRequest } from 'next/server'

// GET — returns the full matrix: default, override, and effective value per cell
export async function GET() {
  await requirePlatformAdmin()

  const admin = createAdminClient()
  const { data: overrideRows } = await admin
    .from('admin_feature_overrides')
    .select('feature, tier, enabled, updated_at, updated_by')

  const overrides: OverrideMap = {}
  for (const row of overrideRows ?? []) {
    if (!overrides[row.feature]) overrides[row.feature] = {}
    overrides[row.feature][row.tier] = row.enabled
  }

  // Build matrix
  const allFeatures = FEATURE_GROUPS.flatMap((g) => g.features)
  const matrix: Record<string, Record<string, { default: boolean; override: boolean | null; effective: boolean }>> = {}

  for (const feature of allFeatures) {
    matrix[feature] = {}
    for (const { key: tier, isCoach } of MATRIX_TIERS) {
      const def = defaultEnabled(feature as Feature, tier as SubscriptionTier, isCoach)
      const override = overrides[feature]?.[tier] ?? null
      matrix[feature][tier] = {
        default: def,
        override,
        effective: override !== null ? override : def,
      }
    }
  }

  return Response.json({ matrix, groups: FEATURE_GROUPS.map((g) => ({ label: g.label, features: g.features })) })
}

// PUT — upsert or delete a single override
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  await requirePlatformAdmin()

  const { feature, tier, enabled } = await req.json() as { feature: string; tier: string; enabled: boolean }
  if (!feature || !tier || typeof enabled !== 'boolean') {
    return Response.json({ error: 'feature, tier, and enabled are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find what the hardcoded default is for this cell
  const tierMeta = MATRIX_TIERS.find((t) => t.key === tier)
  const def = tierMeta
    ? defaultEnabled(feature as Feature, tier as SubscriptionTier, tierMeta.isCoach)
    : false

  if (enabled === def) {
    // Removing override (resetting to default) — delete the row
    await admin
      .from('admin_feature_overrides')
      .delete()
      .eq('feature', feature)
      .eq('tier', tier)
  } else {
    // Upsert the override
    await admin
      .from('admin_feature_overrides')
      .upsert(
        { feature, tier, enabled, updated_at: new Date().toISOString(), updated_by: user.id },
        { onConflict: 'feature,tier' },
      )
  }

  return Response.json({ ok: true })
}
