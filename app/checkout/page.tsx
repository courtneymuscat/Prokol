import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStripe, getStripePriceId, getStripeOveragePriceId } from '@/lib/stripe'
import type Stripe from 'stripe'

const COACH_PLANS = ['coach_solo', 'coach_pro', 'coach_business']

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string; type?: string }>
}) {
  const { plan, billing = 'monthly', type = 'individual' } = await searchParams

  if (!plan) redirect('/pricing')

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/checkout?plan=${plan}&billing=${billing}&type=${type}`)}`)
  }

  const priceId = getStripePriceId(plan, billing as 'monthly' | 'annual')

  if (!priceId) {
    // Stripe not yet configured for this plan — redirect to pricing with notice
    redirect('/pricing?notice=stripe-pending')
  }

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const isCoachPlan = COACH_PLANS.includes(plan)

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ]
  const overagePriceId = getStripeOveragePriceId(plan)
  if (overagePriceId) {
    lineItems.push({ price: overagePriceId })
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: session.user.email!,
    line_items: lineItems,
    metadata: {
      userId: session.user.id,
      planKey: plan,
      billing,
      userType: type,
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
      metadata: { userId: session.user.id, planKey: plan, userType: type },
    },
    success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    allow_promotion_codes: true,
    cancel_url: `${baseUrl}/pricing`,
  })

  redirect(checkoutSession.url!)
}
