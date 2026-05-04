import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, getStripePriceId, getStripeOveragePriceId } from '@/lib/stripe'
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    const isCoachPlan = ['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'].includes(planKey)

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      // Attach to existing Stripe customer if available, otherwise pre-fill email
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id as string }
        : user?.email ? { customer_email: user.email } : {}),
      line_items: lineItems,
      metadata: {
        userId: user?.id ?? '',
        planKey,
        billing,
        userType,
      },
      subscription_data: {
        ...(isCoachPlan && {
          trial_period_days: 14,
          trial_settings: {
            end_behavior: {
              missing_payment_method: 'cancel',
            },
          },
        }),
        metadata: {
          userId: user?.id ?? '',
          planKey,
          userType,
        },
      },
      success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      allow_promotion_codes: true,
      cancel_url: `${baseUrl}/pricing`,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Stripe checkout error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
