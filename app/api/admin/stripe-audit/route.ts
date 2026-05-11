import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/stripe-audit
 *
 * Returns the current Stripe env-var configuration with the actual prices
 * + products each one points at. Use this to verify that each plan key
 * resolves to the right Stripe product, and that overage env vars point at
 * the metered overage prices (not the flat plan prices).
 *
 * Auth: any signed-in user with profiles.role = 'admin' OR matching
 * an environment-configured ADMIN_EMAILS list.
 */

const PRICE_ENV_VARS = [
  'STRIPE_PRICE_INDIVIDUAL_TIER_2_MONTHLY',
  'STRIPE_PRICE_INDIVIDUAL_TIER_2_ANNUAL',
  'STRIPE_PRICE_INDIVIDUAL_TIER_3_MONTHLY',
  'STRIPE_PRICE_INDIVIDUAL_TIER_3_ANNUAL',
  'STRIPE_PRICE_COACH_PT_SOLO_MONTHLY',
  'STRIPE_PRICE_COACH_NUTRITIONIST_SOLO_MONTHLY',
  'STRIPE_PRICE_COACH_SOLO_MONTHLY',
  'STRIPE_PRICE_COACH_PRO_MONTHLY',
  'STRIPE_PRICE_COACH_BUSINESS_MONTHLY',
  'STRIPE_PRICE_WL_STARTER_MONTHLY',
  'STRIPE_PRICE_WL_PRO_MONTHLY',
  'STRIPE_PRICE_COACH_PT_SOLO_OVERAGE',
  'STRIPE_PRICE_COACH_NUTRITIONIST_SOLO_OVERAGE',
  'STRIPE_PRICE_COACH_SOLO_OVERAGE',
  'STRIPE_PRICE_COACH_PRO_OVERAGE',
  'STRIPE_PRICE_COACH_BUSINESS_OVERAGE',
  'STRIPE_PRICE_COACH_BUSINESS_COACH_OVERAGE',
  'STRIPE_PRICE_WL_STARTER_COACH_OVERAGE',
  'STRIPE_PRICE_WL_STARTER_CLIENT_OVERAGE',
  'STRIPE_PRICE_WL_PRO_COACH_OVERAGE',
  'STRIPE_PRICE_WL_PRO_CLIENT_OVERAGE',
]

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Admin gate
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, email')
    .eq('id', session.user.id)
    .single()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const isAdmin = profile?.role === 'admin' || adminEmails.includes(profile?.email as string)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const stripe = getStripe()

  const rows = await Promise.all(
    PRICE_ENV_VARS.map(async (envName) => {
      const priceId = process.env[envName]
      if (!priceId) {
        return { env: envName, status: 'missing', priceId: null }
      }
      try {
        const price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
        const product = price.product as { id: string; name: string; metadata: Record<string, string> }
        const amount = price.unit_amount != null ? `${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}` : 'metered'
        const isMetered = price.recurring?.usage_type === 'metered'
        return {
          env: envName,
          status: 'ok' as const,
          priceId,
          amount,
          recurring: price.recurring?.interval ?? null,
          usage_type: price.recurring?.usage_type ?? null,
          product_id: product.id,
          product_name: product.name,
          product_metadata_tier: product.metadata?.tier ?? null,
          // Flag the most common mistake: an env var named *_OVERAGE pointing
          // at a non-metered (flat) price, or vice versa.
          warning: envName.endsWith('_OVERAGE') && !isMetered
            ? 'Env var has _OVERAGE suffix but the price is NOT metered — likely the wrong price id'
            : !envName.endsWith('_OVERAGE') && isMetered
            ? 'Env var is a flat plan but the price IS metered — likely swapped with an overage id'
            : null,
        }
      } catch (err) {
        return {
          env: envName,
          status: 'invalid' as const,
          priceId,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }),
  )

  return NextResponse.json({
    stripe_mode: (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'live' : 'test',
    rows,
  })
}
