// ─── Feature keys ────────────────────────────────────────────────────────────

export const FEATURES = {
  // ── Tier: individual_free (Free) ──────────────────────────────────────────
  FOOD_LOG:           'food_log',       // manual food entry + macros
  WORKOUT_BASIC:      'workout_basic',  // basic exercise logging
  WEIGHT_BASIC:       'weight_basic',   // weight entry, no chart
  CHECKIN_BASIC:      'checkin_basic',  // sleep + energy only
  CYCLE_BASIC:        'cycle_basic',    // period dates + phase bar only

  // ── Tier: individual_optimiser ($19.99 AUD/mo) ────────────────────────────
  MEAL_BUILDER:        'meal_builder',
  SAVED_MEALS:         'saved_meals',
  WORKOUT_SECTIONS:    'workout_sections',
  EXERCISE_HISTORY:    'exercise_history',
  WEIGHT_TRACKING:     'weight_tracking',    // full chart + history
  DAILY_CHECKIN:       'daily_checkin',      // full: sleep/HRV/RHR/notes
  CYCLE_TRACKER:       'cycle_tracker',      // symptoms, BBT, cervical mucus, moods
  PROGRESS_PHOTOS:     'progress_photos',    // upload & view progress photos
  PROGRESS_COMPARE:    'progress_compare',   // before/after photo comparison

  // ── Tier: individual_elite ($34.99 AUD/mo) ────────────────────────────────
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

  // ── Coach Business features ───────────────────────────────────────────────
  MULTI_COACH:        'multi_coach',
  ORG_DASHBOARD:      'org_dashboard',
  ORG_TEMPLATES:      'org_templates',
  ORG_PERMISSIONS:    'org_permissions',
  CUSTOM_BRANDING:    'custom_branding',

  // ── White-label features ──────────────────────────────────────────────────
  WHITE_LABEL_WEB:    'white_label_web',   // custom domain + full branding on web
  WHITE_LABEL_APP:    'white_label_app',   // white-label mobile app
  APP_STORE_LISTING:  'app_store_listing', // own App Store / Play Store listing
} as const

export type Feature = typeof FEATURES[keyof typeof FEATURES]
export type SubscriptionTier =
  | 'individual_free'
  | 'individual_optimiser'
  | 'individual_elite'
  | 'coached'
  | 'coach_solo'
  | 'coach_pro'
  | 'coach_business'
  | 'wl_starter'
  | 'wl_pro'
export type UserType = 'individual' | 'coach' | 'business'

// ─── Individual tier → feature mapping ───────────────────────────────────────

const INDIVIDUAL_FREE_FEATURES: Feature[] = [
  FEATURES.FOOD_LOG,
  FEATURES.WORKOUT_BASIC,
  FEATURES.WEIGHT_BASIC,
  FEATURES.CHECKIN_BASIC,
  FEATURES.CYCLE_BASIC,
]

const INDIVIDUAL_OPTIMISER_FEATURES: Feature[] = [
  ...INDIVIDUAL_FREE_FEATURES,
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

const INDIVIDUAL_ELITE_FEATURES: Feature[] = [
  ...INDIVIDUAL_OPTIMISER_FEATURES,
  FEATURES.MEAL_SCANNER,
  FEATURES.ADVANCED_ANALYTICS,
  FEATURES.CYCLE_INTELLIGENCE,
  FEATURES.EXERCISE_VIDEO_UPLOAD,
]

// ─── Coach tier → feature mapping ────────────────────────────────────────────

const COACH_SOLO_FEATURES: Feature[] = [
  FEATURES.CLIENT_MANAGEMENT,
  FEATURES.FORM_TEMPLATES,
  FEATURES.FORM_BUILDER_CUSTOM,
]

export const COACH_PRO_FEATURES: Feature[] = [
  ...COACH_SOLO_FEATURES,
  FEATURES.COACH_CHECKIN_FEED,
  FEATURES.COACH_CHECKIN_FEEDBACK,
  FEATURES.COACH_NOTES,
  FEATURES.JOTFORM_IMPORT,
  FEATURES.EXERCISE_LIBRARY_EDIT,
  FEATURES.CUSTOM_PROGRAMS,
]

export const COACH_BUSINESS_FEATURES: Feature[] = [
  ...COACH_PRO_FEATURES,
  FEATURES.MULTI_COACH,
  FEATURES.ORG_DASHBOARD,
  FEATURES.ORG_TEMPLATES,
  FEATURES.ORG_PERMISSIONS,
  FEATURES.CUSTOM_BRANDING,
]

export const WL_STARTER_FEATURES: Feature[] = [
  ...COACH_BUSINESS_FEATURES,
  FEATURES.WHITE_LABEL_WEB,
]

export const WL_PRO_FEATURES: Feature[] = [
  ...WL_STARTER_FEATURES,
  FEATURES.WHITE_LABEL_APP,
  FEATURES.APP_STORE_LISTING,
]

export const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  individual_free:      INDIVIDUAL_FREE_FEATURES,
  individual_optimiser: INDIVIDUAL_OPTIMISER_FEATURES,
  individual_elite:     INDIVIDUAL_ELITE_FEATURES,
  coached:              INDIVIDUAL_ELITE_FEATURES, // coached clients get full Elite-level access
  coach_solo:           COACH_SOLO_FEATURES,
  coach_pro:            COACH_PRO_FEATURES,
  coach_business:       COACH_BUSINESS_FEATURES,
  wl_starter:           WL_STARTER_FEATURES,
  wl_pro:               WL_PRO_FEATURES,
}

export const COACH_TIER_FEATURES: Record<string, Feature[]> = {
  coach_solo:     COACH_SOLO_FEATURES,
  coach_pro:      COACH_PRO_FEATURES,
  coach_business: COACH_BUSINESS_FEATURES,
  wl_starter:     WL_STARTER_FEATURES,
  wl_pro:         WL_PRO_FEATURES,
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
  return (TIER_FEATURES[tier] ?? []).includes(feature)
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
  seatLimit?: number        // coach_business only
  includedSeats?: number    // white-label plans — included client seats
  includedCoaches?: number  // white-label plans — included coach seats
}

export const INDIVIDUAL_PLANS: PricingPlan[] = [
  {
    id: 'individual_free',
    planKey: 'individual_tier_1',
    name: 'Tracker',
    tagline: 'Free forever',
    priceMonthly: 0,
    priceAnnualMonthly: 0,
    features: [
      'Manual food logging + macros',
      'Add notes & photos to meals',
      'Basic weight entry',
      'Basic workout logging',
      'Period dates + cycle phase bar',
      'Basic daily check-in (sleep + energy)',
      'Personalised TDEE + macro targets (calorie needs calculated from your actual workouts, not just an activity level guess)',
    ],
    highlighted: false,
  },
  {
    id: 'individual_optimiser',
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
    id: 'individual_elite',
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
      'Upload training videos to exercises for form review',
    ],
    highlighted: false,
  },
]

export const COACH_PLANS: PricingPlan[] = [
  {
    id: 'coach_solo',
    planKey: 'coach_solo',
    name: 'Solo',
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
    id: 'coach_pro',
    planKey: 'coach_pro',
    name: 'Pro',
    tagline: 'Scale your practice',
    priceMonthly: 69,
    priceAnnualMonthly: 62,
    clientLimit: 20,
    features: [
      'Up to 20 clients',
      'Everything in Solo',
      'Check-in feed + client feedback',
      'Coach notes (private per client)',
      'JotForm integration',
      'Exercise library editing',
      'Full client data: food, weight, workouts',
    ],
    highlighted: true,
  },
  {
    id: 'coach_business',
    planKey: 'coach_business',
    name: 'Business',
    tagline: 'For teams & studios',
    priceMonthly: 199,
    priceAnnualMonthly: 179,
    clientLimit: 100,
    seatLimit: 100,
    features: [
      'Up to 100 clients',
      'Everything in Pro',
      'Multi-coach team management',
      'Organisation dashboard',
      'Shared template library',
      'Role-based permissions',
      'Custom branding',
    ],
    highlighted: false,
  },
  {
    id: 'wl_starter',
    planKey: 'wl_starter',
    name: 'Web White-label',
    tagline: 'Your brand, your domain',
    priceMonthly: 299,
    priceAnnualMonthly: 269,
    includedSeats: 200,
    includedCoaches: 5,
    features: [
      'Everything in Business',
      'Up to 5 coaches, 200 clients (metered overages)',
      'Custom domain (e.g. app.yourstudio.com)',
      'Full white-label branding — zero Prokol references',
      'Custom logo, colours & favicon',
      'Branded emails via your support address',
      'DNS setup assistance',
    ],
    highlighted: false,
  },
  {
    id: 'wl_pro',
    planKey: 'wl_pro',
    name: 'App Store White-label',
    tagline: 'Your app in the App Store',
    priceMonthly: 499,
    priceAnnualMonthly: 449,
    includedSeats: 500,
    includedCoaches: 10,
    features: [
      'Everything in Web White-label',
      'Up to 10 coaches, 500 clients (metered overages)',
      'White-label iOS & Android app',
      'Your own App Store & Google Play listing',
      'Push notifications under your brand',
    ],
    highlighted: false,
  },
]
