import { createClient } from '@/lib/supabase/server'
import { TIER_FEATURES, COACH_TIER_FEATURES, type Feature, type SubscriptionTier, type UserType } from '@/lib/features'
import { getFeatureOverrides } from '@/lib/feature-matrix'

export type Subscription = {
  tier: SubscriptionTier
  userType: UserType
  canAccess: (feature: Feature) => boolean
}

const DEFAULTS: Subscription = {
  tier: 'individual_free',
  userType: 'individual',
  canAccess: () => false,
}

export async function getSubscription(): Promise<Subscription> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DEFAULTS

  const [{ data: profile }, { data: coachRel }] = await Promise.all([
    supabase
      .from('profiles')
      .select('subscription_tier, user_type')
      .eq('id', user.id)
      .single(),
    supabase
      .from('coach_clients')
      .select('id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  const storedTier = (profile?.subscription_tier as SubscriptionTier | null) ?? 'individual_free'
  const userType = (profile?.user_type as UserType | null) ?? 'individual'
  // If the user has an active coach relationship, treat them as coached regardless of stored tier
  const tier: SubscriptionTier = coachRel ? 'coached' : storedTier

  // Hardcoded baseline: coaches get their coach features + full elite individual access
  const baseline: Set<Feature> = new Set(
    userType === 'coach'
      ? [...(COACH_TIER_FEATURES[tier] ?? []), ...TIER_FEATURES['individual_elite']]
      : (TIER_FEATURES[tier] ?? TIER_FEATURES['individual_free']),
  )

  // Apply admin overrides (cached — usually no extra latency)
  try {
    const overrides = await getFeatureOverrides()
    for (const [feature, tierMap] of Object.entries(overrides)) {
      if (tier in tierMap) {
        if (tierMap[tier]) {
          baseline.add(feature as Feature)
        } else {
          baseline.delete(feature as Feature)
        }
      }
    }
  } catch {
    // Override fetch failed — fall back to hardcoded defaults silently
  }

  return {
    tier,
    userType,
    canAccess: (f) => baseline.has(f),
  }
}
