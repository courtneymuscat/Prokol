// ─── Feature keys ────────────────────────────────────────────────────────────

export const FEATURES = {
  // ── Tier 1 — Tracker (Free) ───────────────────────────────────────────────
  FOOD_LOG:           'food_log',       // manual food entry + macros
  WORKOUT_BASIC:      'workout_basic',  // basic exercise logging
  WEIGHT_BASIC:       'weight_basic',   // weight entry, no chart
  CHECKIN_BASIC:      'checkin_basic',  // sleep + energy only
  CYCLE_BASIC:        'cycle_basic',    // period dates + phase bar only

  // ── Tier 2 — Optimiser ($19.99 AUD/mo) ───────────────────────────────────
  MEAL_BUILDER:        'meal_builder',
  SAVED_MEALS:         'saved_meals',
  WORKOUT_SECTIONS:    'workout_sections',
  EXERCISE_HISTORY:    'exercise_history',
  WEIGHT_TRACKING:     'weight_tracking',    // full chart + history
  DAILY_CHECKIN:       'daily_checkin',      // full: sleep/HRV/RHR/notes
  CYCLE_TRACKER:       'cycle_tracker',      // symptoms, BBT, cervical mucus, moods
  PROGRESS_PHOTOS:     'progress_photos',    // upload & view progress photos
  PROGRESS_COMPARE:    'progress_compare',   // before/after photo comparison

  // ── Tier 3 — Elite ($34.99 AUD/mo) ───────────────────────────────────────
  MEAL_SCANNER:         'meal_scanner',         // AI photo → detect + log foods
  ADVANCED_ANALYTICS:   'advanced_analytics',   // trends: nutrition/training/recovery
  CYCLE_INTELLIGENCE:   'cycle_intelligence',   // predictions + personalised insights
  EXERCISE_VIDEO_UPLOAD: 'exercise_video_upload', // upload form-check videos to exercises

  // ── Coach features ────────────────────────────────────────────────────────
  CLIENT_MANAGEMENT:      'client_management',
  FORM_TEMPLATES:         'form_templates',
  FORM_BUILDER_CUSTOM:    'form_builder_custom',
  COACH_CHECKIN_FEED:     'coach_checkin_feed',
  COACH_CHECKIN_FEEDBACK: 'coach_checkin_feedback',
  COACH_NOTES:            'coach_notes',
  JOTFORM_IMPORT:         'jotform_import',
  EXERCISE_LIBRARY_EDIT:  'exercise_library_edit',
  CUSTOM_PROGRAMS:        'custom_programs',
  TEAM_MANAGEMENT:        'team_management',
} as const

export type Feature = typeof FEATURES[keyof typeof FEATURES]
export type SubscriptionTier = 'tier_1' | 'tier_2' | 'tier_3' | 'coached'
export type UserType = 'individual' | 'coach' | 'business'

// ─── Individual tier → feature mapping ───────────────────────────────────────

const TIER_1_FEATURES: Feature[] = [
  FEATURES.FOOD_LOG,
  FEATURES.WORKOUT_BASIC,
  FEATURES.WEIGHT_BASIC,
  FEATURES.CHECKIN_BASIC,
  FEATURES.CYCLE_BASIC,
]

const TIER_2_FEATURES: Feature[] = [
  ...TIER_1_FEATURES,
  FEATURES.MEAL_BUILDER,
  FEATURES.SAVED_MEALS,
  FEATURES.WORKOUT_SECTIONS,
  FEATURES.EXERCISE_HISTORY,
  FEATURES.WEIGHT_TRACKING,
  FEATURES.DAILY_CHECKIN,
  FEATURES.CYCLE_TRACKER,
  FEATURES.PROGRESS_PHOTOS,
  FEATURES.PROGRESS_COMPARE,
]

const TIER_3_FEATURES: Feature[] = [
  ...TIER_2_FEATURES,
  FEATURES.MEAL_SCANNER,
  FEATURES.ADVANCED_ANALYTICS,
  FEATURES.CYCLE_INTELLIGENCE,
  FEATURES.EXERCISE_VIDEO_UPLOAD,
]

// ─── Coach tier → feature mapping ────────────────────────────────────────────

const COACH_STARTER_FEATURES: Feature[] = [
  FEATURES.CLIENT_MANAGEMENT,
  FEATURES.FORM_TEMPLATES,
  FEATURES.FORM_BUILDER_CUSTOM,
]

export const COACH_GROWTH_FEATURES: Feature[] = [
  ...COACH_STARTER_FEATURES,
  FEATURES.COACH_CHECKIN_FEED,
  FEATURES.COACH_CHECKIN_FEEDBACK,
  FEATURES.COACH_NOTES,
  FEATURES.JOTFORM_IMPORT,
  FEATURES.EXERCISE_LIBRARY_EDIT,
  FEATURES.CUSTOM_PROGRAMS,
]

export const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  tier_1: TIER_1_FEATURES,
  tier_2: TIER_2_FEATURES,
  tier_3: TIER_3_FEATURES,
  coached: TIER_2_FEATURES, // coached clients get Optimiser-level access
}

export const COACH_TIER_FEATURES: Record<string, Feature[]> = {
  tier_1: COACH_STARTER_FEATURES,
  tier_2: COACH_GROWTH_FEATURES,
}

// ─── canAccess helper ─────────────────────────────────────────────────────────

export function canAccess(
  feature: Feature,
  tier: SubscriptionTier | null | undefined,
  userType?: UserType | null,
): boolean {
  if (!tier) return false
  if (userType === 'coach') {
    return (COACH_TIER_FEATURES[tier] ?? []).includes(feature)
  }
  return TIER_FEATURES[tier].includes(feature)
}

// ─── Pricing config ───────────────────────────────────────────────────────────

export type PricingPlan = {
  id: SubscriptionTier
  planKey: string           // used to look up Stripe price IDs
  name: string
  tagline: string
  priceMonthly: number      // AUD per month
  priceAnnualMonthly: number // AUD per month when billed annually
  features: string[]
  highlighted: boolean
  clientLimit?: number      // coach plans only
}

export const INDIVIDUAL_PLANS: PricingPlan[] = [
  {
    id: 'tier_1',
    planKey: 'individual_tier_1',
    name: 'Tracker',
    tagline: 'Free forever',
    priceMonthly: 0,
    priceAnnualMonthly: 0,
    features: [
      'Manual food logging + macros',
      'Basic weight entry',
      'Basic workout logging',
      'Period dates + cycle phase bar',
      'Basic daily check-in (sleep + energy)',
      'Personalised TDEE + macro targets (calorie needs calculated from your actual workouts, not just an activity level guess)',
    ],
    highlighted: false,
  },
  {
    id: 'tier_2',
    planKey: 'individual_tier_2',
    name: 'Optimiser',
    tagline: 'Most popular',
    priceMonthly: 19.99,
    priceAnnualMonthly: 17.99,
    features: [
      'Everything in Tracker',
      'Progress photos + before/after comparison',
      'Meal builder + saved meals',
      'Full workout tracking + structured sessions',
      'Weight chart + full history',
      'Full daily check-in (sleep, HRV, RHR, energy, notes)',
      'Advanced cycle tracking (symptoms, BBT, cervical mucus, moods)',
    ],
    highlighted: true,
  },
  {
    id: 'tier_3',
    planKey: 'individual_tier_3',
    name: 'Elite',
    tagline: 'For serious athletes',
    priceMonthly: 34.99,
    priceAnnualMonthly: 31.49,
    features: [
      'Everything in Optimiser',
      'AI meal scanner (photo → auto-log)',
      'Advanced analytics dashboard',
      'Cycle intelligence + predictions',
      'Personalised cycle insights based on your data',
      'Predict period, ovulation & phase windows',
    ],
    highlighted: false,
  },
]

export const COACH_PLANS: PricingPlan[] = [
  {
    id: 'tier_1',
    planKey: 'coach_starter',
    name: 'Starter',
    tagline: 'Begin coaching',
    priceMonthly: 29,
    priceAnnualMonthly: 26,
    clientLimit: 5,
    features: [
      'Up to 5 clients',
      'Client dashboard + profiles',
      'Template forms (onboarding, check-in)',
      'Custom form builder',
      'Client messaging',
      'Client invitations',
    ],
    highlighted: false,
  },
  {
    id: 'tier_2',
    planKey: 'coach_growth',
    name: 'Growth',
    tagline: 'Scale your practice',
    priceMonthly: 69,
    priceAnnualMonthly: 62,
    clientLimit: 20,
    features: [
      'Up to 20 clients',
      'Everything in Starter',
      'Check-in feed + client feedback',
      'Coach notes (private per client)',
      'JotForm integration',
      'Exercise library editing',
      'Full client data: food, weight, workouts',
    ],
    highlighted: true,
  },
]
