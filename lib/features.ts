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

  // ── Coach features (all solo+ plans) ─────────────────────────────────────
  CLIENT_MANAGEMENT:      'client_management',
  FORM_TEMPLATES:         'form_templates',
  FORM_BUILDER_CUSTOM:    'form_builder_custom',
  JOTFORM_IMPORT:         'jotform_import',       // available from solo upward
  COACH_CHECKIN_FEED:     'coach_checkin_feed',
  COACH_CHECKIN_FEEDBACK: 'coach_checkin_feedback',
  COACH_NOTES:            'coach_notes',
  EXERCISE_LIBRARY_EDIT:  'exercise_library_edit',

  // ── Specialisation features ───────────────────────────────────────────────
  PROGRAM_COACH:     'program_coach',    // build + assign training programs (PT plans)
  MEAL_PLAN_COACH:   'meal_plan_coach',  // build + assign meal plans (nutritionist plans)

  // ── Coach Business features ───────────────────────────────────────────────
  CUSTOM_PROGRAMS:        'custom_programs',     // kept for legacy Pro compatibility
  TEAM_MANAGEMENT:        'team_management',
  MULTI_COACH:        'multi_coach',
  ORG_DASHBOARD:      'org_dashboard',
  ORG_TEMPLATES:      'org_templates',
  ORG_PERMISSIONS:    'org_permissions',
  CUSTOM_BRANDING:    'custom_branding',   // Pro and above

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
  | 'coach_solo'           // legacy — existing subscribers only
  | 'coach_pt_solo'        // new PT-specialised solo plan
  | 'coach_nutritionist_solo' // new Nutritionist-specialised solo plan
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

// ─── Coach base features (shared by all solo variants) ───────────────────────

const COACH_BASE_FEATURES: Feature[] = [
  FEATURES.CLIENT_MANAGEMENT,
  FEATURES.FORM_TEMPLATES,
  FEATURES.FORM_BUILDER_CUSTOM,
  FEATURES.JOTFORM_IMPORT,    // available from solo upward
]

// ─── Solo specialisation tiers ───────────────────────────────────────────────

const COACH_PT_SOLO_FEATURES: Feature[] = [
  ...COACH_BASE_FEATURES,
  FEATURES.PROGRAM_COACH,
  FEATURES.EXERCISE_LIBRARY_EDIT,
  FEATURES.COACH_CHECKIN_FEED,
  FEATURES.COACH_CHECKIN_FEEDBACK,
  FEATURES.COACH_NOTES,
]

const COACH_NUTRITIONIST_SOLO_FEATURES: Feature[] = [
  ...COACH_BASE_FEATURES,
  FEATURES.MEAL_PLAN_COACH,
  FEATURES.COACH_CHECKIN_FEED,
  FEATURES.COACH_CHECKIN_FEEDBACK,
  FEATURES.COACH_NOTES,
]

// ─── Legacy coach_solo (existing subscribers) — gets combined solo features ──

const COACH_SOLO_FEATURES: Feature[] = [
  ...COACH_PT_SOLO_FEATURES,
  ...COACH_NUTRITIONIST_SOLO_FEATURES.filter((f) => !COACH_PT_SOLO_FEATURES.includes(f)),
]

// ─── Pro and above ────────────────────────────────────────────────────────────

export const COACH_PRO_FEATURES: Feature[] = [
  ...COACH_SOLO_FEATURES,
  FEATURES.COACH_CHECKIN_FEED,
  FEATURES.COACH_CHECKIN_FEEDBACK,
  FEATURES.COACH_NOTES,
  FEATURES.CUSTOM_PROGRAMS,
  FEATURES.PROGRAM_COACH,
  FEATURES.MEAL_PLAN_COACH,
  FEATURES.CUSTOM_BRANDING,
]

export const COACH_BUSINESS_FEATURES: Feature[] = [
  ...COACH_PRO_FEATURES,
  FEATURES.MULTI_COACH,
  FEATURES.ORG_DASHBOARD,
  FEATURES.ORG_TEMPLATES,
  FEATURES.ORG_PERMISSIONS,
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
  individual_free:           INDIVIDUAL_FREE_FEATURES,
  individual_optimiser:      INDIVIDUAL_OPTIMISER_FEATURES,
  individual_elite:          INDIVIDUAL_ELITE_FEATURES,
  coached:                   INDIVIDUAL_ELITE_FEATURES, // coached clients get full Elite-level access
  coach_solo:                COACH_SOLO_FEATURES,       // legacy
  coach_pt_solo:             COACH_PT_SOLO_FEATURES,
  coach_nutritionist_solo:   COACH_NUTRITIONIST_SOLO_FEATURES,
  coach_pro:                 COACH_PRO_FEATURES,
  coach_business:            COACH_BUSINESS_FEATURES,
  wl_starter:                WL_STARTER_FEATURES,
  wl_pro:                    WL_PRO_FEATURES,
}

export const COACH_TIER_FEATURES: Record<string, Feature[]> = {
  coach_solo:                COACH_SOLO_FEATURES,
  coach_pt_solo:             COACH_PT_SOLO_FEATURES,
  coach_nutritionist_solo:   COACH_NUTRITIONIST_SOLO_FEATURES,
  coach_pro:                 COACH_PRO_FEATURES,
  coach_business:            COACH_BUSINESS_FEATURES,
  wl_starter:                WL_STARTER_FEATURES,
  wl_pro:                    WL_PRO_FEATURES,
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
  priceAnnualMonthly: number // AUD per month when billed annually (0 = no annual option)
  features: string[]
  highlighted: boolean
  includedClients?: number  // clients included in base price before overages
  clientOveragePrice?: number // AUD per additional client per month
  includedCoaches?: number  // coaches included (business plans)
  coachOveragePrice?: number // AUD per additional coach per month
  isMonthlyOnly?: boolean   // no annual billing option
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
      'Personalised TDEE + macro targets',
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

// Solo coach plans — choose your specialisation
export const COACH_SOLO_PLANS: PricingPlan[] = [
  {
    id: 'coach_pt_solo',
    planKey: 'coach_pt_solo',
    name: 'Solo — Personal Trainer',
    tagline: 'Programs & training focus',
    priceMonthly: 49,
    priceAnnualMonthly: 0, // monthly only
    isMonthlyOnly: true,
    includedClients: 5,
    clientOveragePrice: 4,
    features: [
      '5 clients included (+$4/mo per extra client)',
      'Client dashboard + profiles',
      'Custom form builder + template forms',
      'JotForm import (no rebuilding old forms)',
      'Client messaging',
      'Client invitations',
      'Training program builder + assignment',
      'Exercise library management',
      'View client cycle & nutrition data',
    ],
    highlighted: false,
  },
  {
    id: 'coach_nutritionist_solo',
    planKey: 'coach_nutritionist_solo',
    name: 'Solo — Nutritionist',
    tagline: 'Meal plans & nutrition focus',
    priceMonthly: 49,
    priceAnnualMonthly: 0, // monthly only
    isMonthlyOnly: true,
    includedClients: 5,
    clientOveragePrice: 4,
    features: [
      '5 clients included (+$4/mo per extra client)',
      'Client dashboard + profiles',
      'Custom form builder + template forms',
      'JotForm import (no rebuilding old forms)',
      'Client messaging',
      'Client invitations',
      'Meal plan templates + meal plan builder',
      'Assign meal plans to clients',
      'View client workout & cycle data',
    ],
    highlighted: false,
  },
]

export const COACH_PLANS: PricingPlan[] = [
  {
    id: 'coach_pro',
    planKey: 'coach_pro',
    name: 'Pro',
    tagline: 'Scale your practice',
    priceMonthly: 99,
    priceAnnualMonthly: 0, // monthly only
    isMonthlyOnly: true,
    includedClients: 15,
    clientOveragePrice: 3,
    features: [
      '15 clients included (+$3/mo per extra client)',
      'Everything in Solo (PT + Nutritionist)',
      'Check-in feed + client feedback',
      'Coach notes (private per client)',
      'Full client data: food, weight, workouts',
      'Custom branding (logo + colours)',
    ],
    highlighted: true,
  },
  {
    id: 'coach_business',
    planKey: 'coach_business',
    name: 'Business',
    tagline: 'For teams & studios',
    priceMonthly: 249,
    priceAnnualMonthly: 0, // monthly only
    isMonthlyOnly: true,
    includedClients: 75,
    clientOveragePrice: 3,
    includedCoaches: 3,
    coachOveragePrice: 19,
    features: [
      '3 coaches included (+$19/mo per extra coach)',
      '75 clients included (+$3/mo per extra client)',
      'Everything in Pro',
      'Multi-coach team management',
      'Organisation dashboard',
      'Shared template library',
      'Role-based permissions',
    ],
    highlighted: false,
  },
  {
    id: 'wl_starter',
    planKey: 'wl_starter',
    name: 'Web White-label',
    tagline: 'Your brand, your domain',
    priceMonthly: 299,
    priceAnnualMonthly: 0, // monthly only
    isMonthlyOnly: true,
    includedClients: 200,
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
    priceAnnualMonthly: 0, // monthly only
    isMonthlyOnly: true,
    includedClients: 500,
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
