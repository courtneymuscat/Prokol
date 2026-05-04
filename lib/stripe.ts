import Stripe from 'stripe'

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia',
  })
}

// Maps planKey + billing to Stripe price IDs (set in env vars after creating products in Stripe)
export function getStripePriceId(planKey: string, billing: 'monthly' | 'annual'): string | null {
  const key = `STRIPE_PRICE_${planKey.toUpperCase()}_${billing.toUpperCase()}`
  return process.env[key] ?? null
}

export function getStripeOveragePriceId(planKey: string): string | null {
  const key = `STRIPE_PRICE_${planKey.toUpperCase()}_OVERAGE`
  return process.env[key] ?? null
}

// Authoritative map of Stripe flat price IDs → subscription_tier values.
// Built at call time so env vars are available.
export function buildPriceToTierMap(): Record<string, string> {
  const entries: [string | undefined, string][] = [
    [process.env.STRIPE_PRICE_INDIVIDUAL_TIER_2_MONTHLY, 'individual_optimiser'],
    [process.env.STRIPE_PRICE_INDIVIDUAL_TIER_2_ANNUAL,  'individual_optimiser'],
    [process.env.STRIPE_PRICE_INDIVIDUAL_TIER_3_MONTHLY, 'individual_elite'],
    [process.env.STRIPE_PRICE_INDIVIDUAL_TIER_3_ANNUAL,  'individual_elite'],
    [process.env.STRIPE_PRICE_COACH_STARTER_MONTHLY,     'coach_solo'],
    [process.env.STRIPE_PRICE_COACH_GROWTH_MONTHLY,      'coach_pro'],
    [process.env.STRIPE_PRICE_COACH_SOLO_MONTHLY,        'coach_solo'],
    [process.env.STRIPE_PRICE_COACH_PT_SOLO_MONTHLY,             'coach_pt_solo'],
    [process.env.STRIPE_PRICE_COACH_NUTRITIONIST_SOLO_MONTHLY,   'coach_nutritionist_solo'],
    [process.env.STRIPE_PRICE_COACH_PRO_MONTHLY,         'coach_pro'],
    [process.env.STRIPE_PRICE_COACH_BUSINESS_MONTHLY,    'coach_business'],
    [process.env.STRIPE_PRICE_WL_STARTER_MONTHLY,        'wl_starter'],
    [process.env.STRIPE_PRICE_WL_PRO_MONTHLY,            'wl_pro'],
  ]
  const map: Record<string, string> = {}
  for (const [priceId, tier] of entries) {
    if (priceId) map[priceId] = tier
  }
  return map
}

// Overage price IDs — used to identify metered items vs flat items on a subscription.
export const OVERAGE_PRICE_IDS = new Set([
  'price_1TLdMADCfk3knikLyYyCzBOZ',
  'price_1TNAvnDCfk3knikL3Y1AOjaw',
  'price_1TNB42DCfk3knikLJv971zNr',
  'price_1TLdVnDCfk3knikL5PqNQgqH',
  'price_1TLdalDCfk3knikLPjnHAWQ9',
  'price_1TMSOZDCfk3knikLeHGk4VbN',
  'price_1TMSPhDCfk3knikLI9nqnrkC',
  'price_1TMSStDCfk3knikL2L7pwjHB',
  'price_1TMSTxDCfk3knikLneM05qz8',
])

// Tier → user_type mapping shared across webhook and billing routes.
export const TIER_TO_USER_TYPE: Record<string, string> = {
  individual_free:           'individual',
  individual_optimiser:      'individual',
  individual_elite:          'individual',
  coached:                   'individual',
  coach_solo:                'coach',
  coach_pt_solo:             'coach',
  coach_nutritionist_solo:   'coach',
  coach_pro:                 'coach',
  coach_business:            'coach',
  wl_starter:                'business',
  wl_pro:                    'business',
}
