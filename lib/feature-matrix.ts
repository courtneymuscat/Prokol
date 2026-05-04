import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  FEATURES,
  TIER_FEATURES,
  COACH_TIER_FEATURES,
  type Feature,
  type SubscriptionTier,
} from '@/lib/features'

// feature key → tier key → enabled
export type OverrideMap = Record<string, Record<string, boolean>>

export const CACHE_TAG = 'admin-feature-overrides'

export const getFeatureOverrides = unstable_cache(
  async (): Promise<OverrideMap> => {
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from('admin_feature_overrides')
        .select('feature, tier, enabled')
      const map: OverrideMap = {}
      for (const row of data ?? []) {
        if (!map[row.feature]) map[row.feature] = {}
        map[row.feature][row.tier] = row.enabled
      }
      return map
    } catch {
      return {}
    }
  },
  [CACHE_TAG],
  { tags: [CACHE_TAG], revalidate: 300 },
)

// All feature keys in a stable order, grouped by category
export const FEATURE_GROUPS: { label: string; features: Feature[] }[] = [
  {
    label: 'Individual — Free',
    features: [
      FEATURES.FOOD_LOG,
      FEATURES.WORKOUT_BASIC,
      FEATURES.WEIGHT_BASIC,
      FEATURES.CHECKIN_BASIC,
      FEATURES.CYCLE_BASIC,
    ],
  },
  {
    label: 'Individual — Optimiser',
    features: [
      FEATURES.MEAL_BUILDER,
      FEATURES.SAVED_MEALS,
      FEATURES.WORKOUT_SECTIONS,
      FEATURES.EXERCISE_HISTORY,
      FEATURES.WEIGHT_TRACKING,
      FEATURES.DAILY_CHECKIN,
      FEATURES.CYCLE_TRACKER,
      FEATURES.PROGRESS_PHOTOS,
      FEATURES.PROGRESS_COMPARE,
    ],
  },
  {
    label: 'Individual — Elite',
    features: [
      FEATURES.MEAL_SCANNER,
      FEATURES.ADVANCED_ANALYTICS,
      FEATURES.CYCLE_INTELLIGENCE,
      FEATURES.EXERCISE_VIDEO_UPLOAD,
    ],
  },
  {
    label: 'Coach — Base',
    features: [
      FEATURES.CLIENT_MANAGEMENT,
      FEATURES.FORM_TEMPLATES,
      FEATURES.FORM_BUILDER_CUSTOM,
      FEATURES.JOTFORM_IMPORT,
    ],
  },
  {
    label: 'Coach — Specialisation',
    features: [
      FEATURES.PROGRAM_COACH,
      FEATURES.EXERCISE_LIBRARY_EDIT,
      FEATURES.MEAL_PLAN_COACH,
    ],
  },
  {
    label: 'Coach — Pro',
    features: [
      FEATURES.COACH_CHECKIN_FEED,
      FEATURES.COACH_CHECKIN_FEEDBACK,
      FEATURES.COACH_NOTES,
      FEATURES.CUSTOM_BRANDING,
      FEATURES.CUSTOM_PROGRAMS,
    ],
  },
  {
    label: 'Coach — Business',
    features: [
      FEATURES.MULTI_COACH,
      FEATURES.ORG_DASHBOARD,
      FEATURES.ORG_TEMPLATES,
      FEATURES.ORG_PERMISSIONS,
      FEATURES.TEAM_MANAGEMENT,
    ],
  },
  {
    label: 'White-label',
    features: [
      FEATURES.WHITE_LABEL_WEB,
      FEATURES.WHITE_LABEL_APP,
      FEATURES.APP_STORE_LISTING,
    ],
  },
]

// The tiers shown in the matrix (excludes legacy coach_solo)
export const MATRIX_TIERS: { key: SubscriptionTier; label: string; isCoach: boolean }[] = [
  { key: 'individual_free',          label: 'Free',          isCoach: false },
  { key: 'individual_optimiser',     label: 'Optimiser',     isCoach: false },
  { key: 'individual_elite',         label: 'Elite',         isCoach: false },
  { key: 'coached',                  label: 'Coached',       isCoach: false },
  { key: 'coach_pt_solo',            label: 'Solo PT',       isCoach: true  },
  { key: 'coach_nutritionist_solo',  label: 'Solo Nutr.',    isCoach: true  },
  { key: 'coach_pro',                label: 'Pro',           isCoach: true  },
  { key: 'coach_business',           label: 'Business',      isCoach: true  },
  { key: 'wl_starter',              label: 'WL Web',        isCoach: true  },
  { key: 'wl_pro',                  label: 'WL App',        isCoach: true  },
]

/** Returns the hardcoded default value for (feature, tier) from features.ts */
export function defaultEnabled(feature: Feature, tier: SubscriptionTier, isCoach: boolean): boolean {
  const features = isCoach
    ? (COACH_TIER_FEATURES[tier] ?? [])
    : (TIER_FEATURES[tier] ?? [])
  return features.includes(feature)
}

/** Returns the effective value after applying overrides */
export function effectiveEnabled(
  feature: Feature,
  tier: SubscriptionTier,
  isCoach: boolean,
  overrides: OverrideMap,
): boolean {
  const override = overrides[feature]?.[tier]
  if (override !== undefined) return override
  return defaultEnabled(feature, tier, isCoach)
}
