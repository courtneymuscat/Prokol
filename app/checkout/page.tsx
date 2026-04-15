import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStripe, getStripePriceId } from '@/lib/stripe'

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string; type?: string }>
}) {
  const { plan, billing = 'monthly', type = 'individual' } = await searchParams

  if (!plan) redirect('/pricing')

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect(`/signup?plan=${plan}&billing=${billing}&type=${type}`)

  const priceId = getStripePriceId(plan, billing as 'monthly' | 'annual')

  if (!priceId) {
    // Stripe not yet configured for this plan — redirect to pricing with notice
    redirect('/pricing?notice=stripe-pending')
  }

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: session.user.email!,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      userId: session.user.id,
      planKey: plan,
      billing,
      userType: type,
    },
    subscription_data: {
      metadata: { userId: session.user.id, planKey: plan, userType: type },
    },
    success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
  })

  redirect(checkoutSession.url!)
}
