import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { TIER_TO_METER_EVENT } from '@/lib/billing'
import { sendEmail } from '@/lib/email'
import type Stripe from 'stripe'

// planKey (Stripe metadata) → subscription_tier (DB column)
const PLAN_KEY_TO_TIER: Record<string, string> = {
  individual_tier_1: 'individual_free',
  individual_tier_2: 'individual_optimiser',
  individual_tier_3: 'individual_elite',
  // Legacy coach planKeys (kept for any existing checkout sessions in flight)
  coach_starter:     'coach_solo',
  coach_growth:      'coach_pro',
  // Current coach planKeys
  coach_solo:        'coach_solo',
  coach_pro:         'coach_pro',
  coach_business:    'coach_business',
}

const PLAN_KEY_TO_USER_TYPE: Record<string, string> = {
  individual_tier_1: 'individual',
  individual_tier_2: 'individual',
  individual_tier_3: 'individual',
  coach_starter:     'coach',
  coach_growth:      'coach',
  coach_solo:        'coach',
  coach_pro:         'coach',
  coach_business:    'coach',
}

// Overage meter price ID → meter event name
const OVERAGE_PRICE_TO_EVENT: Record<string, string> = {
  'price_1TLdMADCfk3knikLyYyCzBOZ': TIER_TO_METER_EVENT.coach_solo,
  'price_1TLdVnDCfk3knikL5PqNQgqH': TIER_TO_METER_EVENT.coach_pro,
  'price_1TLdalDCfk3knikLPjnHAWQ9': TIER_TO_METER_EVENT.coach_business,
}

// Built at request time so env vars are loaded. Maps flat (non-overage) price ID → tier.
function buildPriceToTierMap(): Record<string, string> {
  const entries: [string | undefined, string][] = [
    [process.env.STRIPE_PRICE_INDIVIDUAL_TIER_2_MONTHLY, 'individual_optimiser'],
    [process.env.STRIPE_PRICE_INDIVIDUAL_TIER_2_ANNUAL,  'individual_optimiser'],
    [process.env.STRIPE_PRICE_INDIVIDUAL_TIER_3_MONTHLY, 'individual_elite'],
    [process.env.STRIPE_PRICE_INDIVIDUAL_TIER_3_ANNUAL,  'individual_elite'],
    // Legacy coach prices
    [process.env.STRIPE_PRICE_COACH_STARTER_MONTHLY,     'coach_solo'],
    [process.env.STRIPE_PRICE_COACH_GROWTH_MONTHLY,      'coach_pro'],
    // Current coach prices
    [process.env.STRIPE_PRICE_COACH_SOLO_MONTHLY,        'coach_solo'],
    [process.env.STRIPE_PRICE_COACH_PRO_MONTHLY,         'coach_pro'],
    [process.env.STRIPE_PRICE_COACH_BUSINESS_MONTHLY,    'coach_business'],
  ]
  const map: Record<string, string> = {}
  for (const [priceId, tier] of entries) {
    if (priceId) map[priceId] = tier
  }
  return map
}

const COACH_TIER_ORDER = ['coach_solo', 'coach_pro', 'coach_business']

function isCoachUpgrade(from: string, to: string): boolean {
  return COACH_TIER_ORDER.indexOf(to) > COACH_TIER_ORDER.indexOf(from)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()

    // ── Checkout completed ─────────────────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const { userId, planKey, userType } = session.metadata ?? {}

      console.log('Webhook checkout.session.completed', { userId, planKey, userType })

      if (userId && planKey) {
        const tier = PLAN_KEY_TO_TIER[planKey] ?? 'individual_free'
        const resolvedUserType = userType ?? PLAN_KEY_TO_USER_TYPE[planKey] ?? 'individual'

        const { error } = await supabase.from('profiles').upsert({
          id: userId,
          subscription_tier: tier,
          user_type: resolvedUserType,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        }, { onConflict: 'id' })

        if (error) console.error('Webhook profile upsert error:', error.message)
        else console.log('Webhook: upserted profile to tier', tier)
      } else {
        console.warn('Webhook: missing userId or planKey in metadata', session.metadata)
      }
    }

    // ── Subscription updated (upgrade / downgrade) ─────────────────────────────
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const priceToTier = buildPriceToTierMap()

      // Identify the flat (non-overage) price to determine current plan tier
      const flatItem = subscription.items.data.find(
        (item) => !OVERAGE_PRICE_TO_EVENT[item.price.id]
      )
      const tier = flatItem ? priceToTier[flatItem.price.id] : undefined

      if (tier) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, subscription_tier')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile && profile.subscription_tier !== tier) {
          const updates: Record<string, unknown> = { subscription_tier: tier }
          // Reset overage counter on coach plan upgrades
          if (isCoachUpgrade(profile.subscription_tier as string, tier)) {
            updates.subscription_seat_count = 0
          }
          await supabase.from('profiles').update(updates).eq('id', profile.id)
          console.log('Webhook: tier updated', profile.subscription_tier, '→', tier)
        }
      }
    }

    // ── Trial ending soon (3 days before) ─────────────────────────────────────
    if (event.type === 'customer.subscription.trial_will_end') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const trialEnd = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile?.email && trialEnd) {
        const trialEndDate = trialEnd.toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        const name = profile.full_name ?? 'there'
        await sendEmail({
          to: profile.email,
          subject: 'Your Prokol trial ends in 3 days',
          html: `
            <p>Hi ${name},</p>
            <p>Your 14-day free trial ends on <strong>${trialEndDate}</strong>.</p>
            <p>You won't be charged if you cancel before then. If you love Prokol, do nothing — your plan continues automatically.</p>
            <p>Questions? Reply to this email.</p>
            <p>— The Prokol team</p>
          `,
        })
      }
    }

    // ── Subscription cancelled ─────────────────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_type')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        await supabase.from('profiles').update({
          subscription_tier: 'individual_free',
          stripe_subscription_id: null,
        }).eq('id', profile.id)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Webhook handler error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
