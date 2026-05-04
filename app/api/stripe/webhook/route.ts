import { NextRequest, NextResponse } from 'next/server'
import { getStripe, buildPriceToTierMap, OVERAGE_PRICE_IDS, TIER_TO_USER_TYPE } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { TIER_TO_METER_EVENT } from '@/lib/billing'
import { sendEmail } from '@/lib/email'
import type Stripe from 'stripe'

// planKey (Stripe metadata) → subscription_tier (DB column)
const PLAN_KEY_TO_TIER: Record<string, string> = {
  individual_tier_1: 'individual_free',
  individual_tier_2: 'individual_optimiser',
  individual_tier_3: 'individual_elite',
  // Legacy coach planKeys
  coach_starter:     'coach_solo',
  coach_growth:      'coach_pro',
  coach_solo:        'coach_solo',
  // New solo specialisation planKeys
  coach_pt_solo:              'coach_pt_solo',
  coach_nutritionist_solo:    'coach_nutritionist_solo',
  // Pro / business
  coach_pro:         'coach_pro',
  coach_business:    'coach_business',
  // White-label
  wl_starter:        'wl_starter',
  wl_pro:            'wl_pro',
}

const PLAN_KEY_TO_USER_TYPE: Record<string, string> = {
  individual_tier_1:           'individual',
  individual_tier_2:           'individual',
  individual_tier_3:           'individual',
  coach_starter:               'coach',
  coach_growth:                'coach',
  coach_solo:                  'coach',
  coach_pt_solo:               'coach',
  coach_nutritionist_solo:     'coach',
  coach_pro:                   'coach',
  coach_business:              'coach',
  wl_starter:                  'business',
  wl_pro:                      'business',
}

// Overage meter price ID → meter event name
const OVERAGE_PRICE_TO_EVENT: Record<string, string> = {
  'price_1TLdMADCfk3knikLyYyCzBOZ': TIER_TO_METER_EVENT.coach_solo,
  'price_1TNAvnDCfk3knikL3Y1AOjaw': TIER_TO_METER_EVENT.coach_pt_solo,
  'price_1TNB42DCfk3knikLJv971zNr': TIER_TO_METER_EVENT.coach_nutritionist_solo,
  'price_1TLdVnDCfk3knikL5PqNQgqH': TIER_TO_METER_EVENT.coach_pro,
  'price_1TLdalDCfk3knikLPjnHAWQ9': TIER_TO_METER_EVENT.coach_business,
  // White-label overages
  'price_1TMSOZDCfk3knikLeHGk4VbN': 'wl_starter_coach_overage',
  'price_1TMSPhDCfk3knikLI9nqnrkC': 'wl_starter_client_overage',
  'price_1TMSStDCfk3knikL2L7pwjHB': 'wl_pro_coach_overage',
  'price_1TMSTxDCfk3knikLneM05qz8': 'wl_pro_client_overage',
}


const COACH_TIER_ORDER = ['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro']

function isCoachUpgrade(from: string, to: string): boolean {
  return COACH_TIER_ORDER.indexOf(to) > COACH_TIER_ORDER.indexOf(from)
}

const COACH_TIERS = new Set(['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'])

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
        const resolvedUserType =
          TIER_TO_USER_TYPE[tier] ??
          userType ??
          PLAN_KEY_TO_USER_TYPE[planKey] ??
          'individual'

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

    // ── Subscription created (covers portal trial conversions and manual Stripe creations) ──
    if (event.type === 'customer.subscription.created') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const priceToTier = buildPriceToTierMap()

      // Find the flat (non-metered) price to determine tier
      const flatItem = subscription.items.data.find(
        (item) => !OVERAGE_PRICE_IDS.has(item.price.id)
      )
      const tier = flatItem ? priceToTier[flatItem.price.id] : undefined

      if (tier) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, subscription_tier')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          const resolvedUserType = TIER_TO_USER_TYPE[tier]
          const updates: Record<string, unknown> = {
            subscription_tier: tier,
            stripe_subscription_id: subscription.id,
          }
          if (resolvedUserType) updates.user_type = resolvedUserType

          await supabase.from('profiles').update(updates).eq('id', profile.id)
          console.log('Webhook: subscription.created — set tier', tier, 'for', profile.id)
        }
      }
    }

    // ── Subscription updated (upgrade / downgrade / cancel-at-period-end) ──────
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const priceToTier = buildPriceToTierMap()

      const flatItem = subscription.items.data.find(
        (item) => !OVERAGE_PRICE_IDS.has(item.price.id)
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
          if (isCoachUpgrade(profile.subscription_tier as string, tier)) {
            updates.subscription_seat_count = 0
          }
          // Ensure user_type stays consistent with tier
          const resolvedUserType = TIER_TO_USER_TYPE[tier]
          if (resolvedUserType) updates.user_type = resolvedUserType

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
            <p>— The Prokol Health team</p>
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
        .select('id, user_type, subscription_tier, email, full_name')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        const wasCoach = COACH_TIERS.has(profile.subscription_tier as string)

        // Downgrade the account to free individual and clear any payment failure flag
        await supabase.from('profiles').update({
          subscription_tier: 'individual_free',
          user_type: 'individual',
          stripe_subscription_id: null,
          payment_failed_at: null,
        }).eq('id', profile.id)

        console.log('Webhook: subscription cancelled, downgraded', profile.id, 'to individual_free')

        // If the user was a coach, downgrade all their active coached clients to individual_free
        if (wasCoach) {
          const { data: coachClients } = await supabase
            .from('coach_clients')
            .select('client_id')
            .eq('coach_id', profile.id)
            .eq('status', 'active')

          if (coachClients && coachClients.length > 0) {
            const clientIds = coachClients.map((r: { client_id: string }) => r.client_id)

            // Only downgrade clients who are on the 'coached' tier
            // (clients on their own paid plan keep their own subscription)
            await supabase
              .from('profiles')
              .update({
                subscription_tier: 'individual_free',
                user_type: 'individual',
              })
              .in('id', clientIds)
              .eq('subscription_tier', 'coached')

            console.log('Webhook: downgraded', clientIds.length, 'coached clients to individual_free')
          }

          // Send notification email to the coach
          if (profile.email) {
            const name = profile.full_name ?? 'there'
            await sendEmail({
              to: profile.email,
              subject: 'Your Prokol coaching subscription has ended',
              html: `
                <p>Hi ${name},</p>
                <p>Your Prokol coaching subscription has been cancelled. Your account has been moved to the free Tracker plan.</p>
                <p>Your clients who were on the Coached plan have also been moved to the free Tracker plan. Their data has been saved and will be available again if you or they subscribe in the future.</p>
                <p>To reactivate your coaching subscription, visit <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://prokol.app'}/pricing">our pricing page</a>.</p>
                <p>— The Prokol Health team</p>
              `,
            })
          }
        }
      }
    }

    // ── Payment failed ─────────────────────────────────────────────────────────
    // Fires when a renewal charge fails (e.g. expired card). Stripe will retry
    // automatically per the dunning settings; we just send a notification email.
    // Access is NOT removed here — Stripe handles the grace period and will fire
    // customer.subscription.deleted if all retries fail.
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      // Only notify on subscription renewals, not first-time payments (those go through checkout)
      if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_update') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, payment_failed_at')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          // Record the first failure time (don't overwrite on subsequent retries)
          if (!profile.payment_failed_at) {
            await supabase
              .from('profiles')
              .update({ payment_failed_at: new Date().toISOString() })
              .eq('id', profile.id)
          }
        }

        if (profile?.email) {
          const name = profile.full_name ?? 'there'
          const amount = invoice.amount_due
            ? `A$${(invoice.amount_due / 100).toFixed(2)}`
            : 'your subscription fee'

          await sendEmail({
            to: profile.email,
            subject: 'Action required: payment failed for your Prokol subscription',
            html: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
                <p style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px;">Payment failed</p>
                <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
                  Hi ${name}, we couldn&apos;t charge <strong>${amount}</strong> for your Prokol subscription.
                </p>
                <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
                  Please update your payment method to keep your subscription active.
                  Stripe will automatically retry — if the payment continues to fail, your account will be downgraded to the free plan.
                </p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://prokol.io'}/settings"
                   style="display:inline-block;background:#1D9E75;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:10px;margin-bottom:24px;">
                  Update payment method →
                </a>
                <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
                  Questions? Reply to this email and we&apos;ll help you sort it out.
                </p>
              </div>
            `,
          })

          console.log('Webhook: payment_failed email sent to', profile.email)
        }
      }
    }

    // ── Payment succeeded — clear any payment failure flag ────────────────────
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      if (customerId) {
        await supabase
          .from('profiles')
          .update({ payment_failed_at: null })
          .eq('stripe_customer_id', customerId)
          .not('payment_failed_at', 'is', null)
      }
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Webhook handler error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
