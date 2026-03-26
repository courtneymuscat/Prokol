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

// e.g. STRIPE_PRICE_INDIVIDUAL_TIER_2_MONTHLY, STRIPE_PRICE_COACH_STARTER_ANNUAL
