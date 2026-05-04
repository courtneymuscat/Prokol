import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStripe, getStripePriceId, getStripeOveragePriceId } from '@/lib/stripe'
import { INCLUDED_SEATS, CLIENT_OVERAGE_PRICE } from '@/lib/billing'
import type Stripe from 'stripe'

const COACH_PLANS = ['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business']

const PLAN_LABELS: Record<string, string> = {
  coach_solo:                'Coach Solo',
  coach_pt_solo:             'Coach Solo (PT)',
  coach_nutritionist_solo:   'Coach Solo (Nutritionist)',
  coach_pro:                 'Coach Pro',
  coach_business:            'Coach Business',
  individual_optimiser:      'Optimiser',
  individual_elite:          'Elite',
}

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

  const FREE_PLAN_KEYS = ['individual_tier_1', 'individual_free']
  const isPaidPlan = !FREE_PLAN_KEYS.includes(plan)

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ]
  const overagePriceId = getStripeOveragePriceId(plan)
  if (overagePriceId) {
    lineItems.push({ price: overagePriceId })
  }

  // Rename the overage product to something descriptive the first time we see it
  // so that Stripe Checkout shows a clear label instead of the generic product name.
  if (overagePriceId) {
    const includedSeats = INCLUDED_SEATS[plan] ?? 0
    const overageRate = CLIENT_OVERAGE_PRICE[plan] ?? 3
    const planLabel = PLAN_LABELS[plan] ?? plan
    const descriptiveName = `Extra coaching clients — A$${overageRate}/client/month`

    try {
      const overagePrice = await stripe.prices.retrieve(overagePriceId, { expand: ['product'] })
      const product = overagePrice.product as Stripe.Product
      // Only update if the product name doesn't already look customised
      if (product?.active && !product.name.toLowerCase().includes('extra')) {
        await stripe.products.update(product.id, {
          name: descriptiveName,
          description: `Your ${planLabel} plan includes ${includedSeats} clients. Each additional client beyond that limit is charged at A$${overageRate}/month, added automatically to your next invoice.`,
        })
      }
    } catch { /* non-fatal — checkout proceeds regardless */ }
  }

  // Build a clear custom note for the checkout page explaining overage billing
  const includedSeats = INCLUDED_SEATS[plan] ?? 0
  const overageRate = CLIENT_OVERAGE_PRICE[plan] ?? 0
  const hasOverage = !!overagePriceId && includedSeats > 0

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    payment_method_collection: 'always',
    customer_email: session.user.email!,
    line_items: lineItems,
    metadata: {
      userId: session.user.id,
      planKey: plan,
      billing,
      userType: type,
    },
    subscription_data: {
      ...(isPaidPlan && {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
      }),
      metadata: { userId: session.user.id, planKey: plan, userType: type },
    },
    custom_text: hasOverage ? {
      submit: {
        message: `Your plan includes ${includedSeats} clients at no extra cost. If you exceed ${includedSeats} active clients, each additional client is billed at A$${overageRate}/month — automatically added to your next invoice. You won't be charged extra unless you go over your limit.`,
      },
    } : undefined,
    success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    allow_promotion_codes: true,
    cancel_url: `${baseUrl}/pricing`,
  })

  redirect(checkoutSession.url!)
}
