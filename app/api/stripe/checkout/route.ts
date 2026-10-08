import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, getStripePriceId, getStripeOveragePriceId, getStripeCoachOveragePriceId } from '@/lib/stripe'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const { planKey, billing: billingParam, userType } = await req.json() as {
      planKey: string
      billing: 'monthly' | 'annual'
      userType: 'individual' | 'coach'
    }

    // Coach and white-label plans are always monthly
    const MONTHLY_ONLY_PLANS = new Set(['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'])
    const billing = MONTHLY_ONLY_PLANS.has(planKey) ? 'monthly' : billingParam

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.id) {
      // Refuse rather than create a session with empty metadata.userId — the
      // webhook can't link an empty userId back to a profile, leaving the
      // user paid in Stripe but stuck on individual_free in the app.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const priceId = getStripePriceId(planKey, billing)
    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price not configured for this plan yet.' }, { status: 400 })
    }

    const stripe = getStripe()
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      'http://localhost:3000'
    )

    // If they already have an active subscription, send them to the portal to upgrade/change plan
    // (avoids duplicate subscriptions — Stripe handles proration natively in the portal)
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single()

    if (profile?.stripe_subscription_id) {
      try {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: profile.stripe_customer_id as string,
          return_url: `${baseUrl}/settings`,
        })
        return NextResponse.json({ url: portalSession.url })
      } catch {
        // Fall through to new checkout if portal fails (e.g. test/live mode mismatch)
      }
    }

    // For coach plans include both the flat price and the metered overage price
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId, quantity: 1 },
    ]
    const overagePriceId = getStripeOveragePriceId(planKey)
    if (overagePriceId) {
      lineItems.push({ price: overagePriceId }) // no quantity — metered billing
    }
    // Org-tier plans (coach_business/wl_starter/wl_pro) have a second,
    // separate overage dimension for coach seats. This was never attached
    // to the subscription before — coach-seat overage was being correctly
    // computed and reported to Stripe's meter (see lib/billing.ts
    // reportCoachSeatUsage) but had no corresponding line item to bill
    // against, so none of that usage ever actually generated a charge.
    const coachOveragePriceId = getStripeCoachOveragePriceId(planKey)
    if (coachOveragePriceId) {
      lineItems.push({ price: coachOveragePriceId })
    }

    const isCoachPlan = ['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'].includes(planKey)
    // White-label is a premium add-on almost always chosen by someone who
    // already knows they want it (not evaluating the core product), and a
    // free trial period on a $299-499/mo tier is real revenue risk for
    // little acquisition benefit. Existing subscribers upgrading are routed
    // through the Billing Portal above anyway (no trial there either) — this
    // only matters for a brand-new signup going straight for white-label.
    const isTrialEligible = isCoachPlan && planKey !== 'wl_starter' && planKey !== 'wl_pro'

    const mkSession = (cp: { customer?: string; customer_email?: string }) =>
      stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        ...cp,
        line_items: lineItems,
        metadata: {
          userId: user.id,
          planKey,
          billing,
          userType,
        },
        subscription_data: {
          ...(isTrialEligible && {
            trial_period_days: 14,
            trial_settings: {
              end_behavior: {
                missing_payment_method: 'cancel',
              },
            },
          }),
          metadata: {
            userId: user.id,
            planKey,
            userType,
          },
        },
        success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
        allow_promotion_codes: true,
        cancel_url: `${baseUrl}/pricing`,
      })

    const hasCustomer = !!profile?.stripe_customer_id
    const emailFallback = user.email ? { customer_email: user.email } : {}
    let checkoutSession: Stripe.Checkout.Session
    try {
      checkoutSession = await mkSession(
        hasCustomer ? { customer: profile.stripe_customer_id as string } : emailFallback
      )
    } catch (err) {
      // Stale customer ID from test mode — clear it and retry with just the email
      if (hasCustomer && err instanceof Error && err.message.includes('No such customer')) {
        await supabase.from('profiles').update({ stripe_customer_id: null }).eq('id', user.id)
        checkoutSession = await mkSession(emailFallback)
      } else {
        throw err
      }
    }

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Stripe checkout error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
