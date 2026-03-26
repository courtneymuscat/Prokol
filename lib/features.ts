// ─── Feature keys ────────────────────────────────────────────────────────────

export const FEATURES = {
  // tier_1 — available to everyone
  FOOD_LOG:           'food_log',
  WORKOUT_BASIC:      'workout_basic',

  // tier_2 — Pro
  MEAL_BUILDER:       'meal_builder',
  WEIGHT_TRACKING:    'weight_tracking',
  DAILY_CHECKIN:      'daily_checkin',
  CYCLE_TRACKER:      'cycle_tracker',
  EXERCISE_HISTORY:   'exercise_history',
  WORKOUT_SECTIONS:   'workout_sections',

  // tier_3 — Elite / Coach
  ADVANCED_ANALYTICS: 'advanced_analytics',
  CLIENT_MANAGEMENT:  'client_management',
  CUSTOM_PROGRAMS:    'custom_programs',
  TEAM_MANAGEMENT:    'team_management',
} as const

export type Feature = typeof FEATURES[keyof typeof FEATURES]
export type SubscriptionTier = 'tier_1' | 'tier_2' | 'tier_3' | 'coached'
export type UserType = 'individual' | 'coach' | 'business'

// ─── Tier → feature mapping ───────────────────────────────────────────────────

const TIER_1_FEATURES: Feature[] = [
  FEATURES.FOOD_LOG,
  FEATURES.WORKOUT_BASIC,
]

const TIER_2_FEATURES: Feature[] = [
  ...TIER_1_FEATURES,
  FEATURES.MEAL_BUILDER,
  FEATURES.WEIGHT_TRACKING,
  FEATURES.DAILY_CHECKIN,
  FEATURES.CYCLE_TRACKER,
  FEATURES.EXERCISE_HISTORY,
  FEATURES.WORKOUT_SECTIONS,
]

const TIER_3_FEATURES: Feature[] = [
  ...TIER_2_FEATURES,
  FEATURES.ADVANCED_ANALYTICS,
  FEATURES.CLIENT_MANAGEMENT,
  FEATURES.CUSTOM_PROGRAMS,
  FEATURES.TEAM_MANAGEMENT,
]

export const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  tier_1: TIER_1_FEATURES,
  tier_2: TIER_2_FEATURES,
  tier_3: TIER_3_FEATURES,
  coached: TIER_2_FEATURES, // coached clients get Pro-level access, covered by coach's plan
}

// ─── canAccess helper ─────────────────────────────────────────────────────────

export function canAccess(
  feature: Feature,
  tier: SubscriptionTier | null | undefined,
): boolean {
  if (!tier) return false
  return TIER_FEATURES[tier].includes(feature)
}

// ─── Pricing config (ready for Stripe price IDs) ──────────────────────────────

export type PricingPlan = {
  id: SubscriptionTier
  name: string
  price: number        // monthly USD
  description: string
  features: string[]
  highlighted: boolean
  stripePriceId: string | null   // wire up when Stripe is added
}

export const INDIVIDUAL_PLANS: PricingPlan[] = [
  {
    id: 'tier_1',
    name: 'Free',
    price: 0,
    description: 'Get started with the basics.',
    features: [
      'Daily food log',
      'Basic workout tracking',
      'Up to 7 days history',
    ],
    highlighted: false,
    stripePriceId: null,
  },
  {
    id: 'tier_2',
    name: 'Pro',
    price: 9.99,
    description: 'Everything you need to optimise performance.',
    features: [
      'Everything in Free',
      'Meal builder & saved meals',
      'Weight tracking + chart',
      'Daily check-in (sleep, HRV, RHR, energy)',
      'Cycle tracker',
      'Exercise history & trends',
      'Freestyle workout sections',
    ],
    highlighted: true,
    stripePriceId: null,
  },
  {
    id: 'tier_3',
    name: 'Elite',
    price: 19.99,
    description: 'Advanced tools for serious athletes.',
    features: [
      'Everything in Pro',
      'Advanced analytics & charts',
      'Priority support',
      'Early access to new features',
    ],
    highlighted: false,
    stripePriceId: null,
  },
]

export const COACH_PLANS: PricingPlan[] = [
  {
    id: 'tier_1',
    name: 'Starter',
    price: 29,
    description: 'Start coaching with up to 5 clients.',
    features: [
      'Up to 5 clients',
      'All Pro individual features per client',
      'Client dashboard',
      'Basic progress tracking',
    ],
    highlighted: false,
    stripePriceId: null,
  },
  {
    id: 'tier_2',
    name: 'Growth',
    price: 59,
    description: 'Scale your coaching practice.',
    features: [
      'Up to 20 clients',
      'Custom programs per client',
      'Check-in review & feedback',
      'Client messaging',
    ],
    highlighted: true,
    stripePriceId: null,
  },
  {
    id: 'tier_3',
    name: 'Pro',
    price: 99,
    description: 'Built for coaches running a business.',
    features: [
      'Unlimited clients',
      'Team management',
      'White-label branding',
      'API access',
      'Priority support',
    ],
    highlighted: false,
    stripePriceId: null,
  },
]
