import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, stripe_subscription_id, stripe_customer_id')
      .eq('id', user.id)
      .single()

    let next_billing_date: string | null = null

    if (profile?.stripe_subscription_id) {
      try {
        const stripe = getStripe()
        const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
        if (sub.current_period_end) {
          next_billing_date = new Date(sub.current_period_end * 1000).toISOString()
        }
      } catch {
        // Ignore Stripe errors — date just won't show
      }
    }

    return NextResponse.json({
      subscription_tier: profile?.subscription_tier ?? 'individual_free',
      next_billing_date,
      has_stripe_customer: !!profile?.stripe_customer_id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
