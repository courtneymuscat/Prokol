import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'

export const COACH_SEAT_OVERAGE_PRICE = process.env.STRIPE_PRICE_COACH_BUSINESS_COACH_OVERAGE

const INCLUDED_SEATS: Record<string, number> = {
  coach_solo:     10,
  coach_pro:      30,
  coach_business: 100,
}

export const TIER_TO_METER_EVENT: Record<string, string> = {
  coach_solo:     'coach_solo_seat_overage',
  coach_pro:      'coach_pro_seat_overage',
  coach_business: 'coach_business_seat_overage',
}

/**
 * Increment the coach's seat count and report an overage meter event to Stripe
 * if they have exceeded their plan's included seats.
 * Called when a new client is added (invite accepted).
 * Non-blocking — errors are logged but do not throw.
 */
export async function reportSeatUsage(coachId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_tier, subscription_seat_count, stripe_customer_id')
    .eq('id', coachId)
    .single()

  if (!profile) return

  const tier = profile.subscription_tier as string
  const seatCount = (profile.subscription_seat_count as number) ?? 0
  const includedSeats = INCLUDED_SEATS[tier] ?? 0
  const meterEvent = TIER_TO_METER_EVENT[tier]

  // Always increment seat count
  await admin
    .from('profiles')
    .update({ subscription_seat_count: seatCount + 1 })
    .eq('id', coachId)

  // Report overage to Stripe only when above the included seat threshold
  if (seatCount >= includedSeats && meterEvent && profile.stripe_customer_id) {
    try {
      const stripe = getStripe()
      await stripe.billing.meterEvents.create({
        event_name: meterEvent,
        payload: {
          stripe_customer_id: profile.stripe_customer_id as string,
          value: '1',
        },
      })
    } catch (err) {
      console.error('Stripe meter event error:', err instanceof Error ? err.message : String(err))
    }
  }
}

/**
 * Reports a coach seat overage meter event to Stripe for the given org.
 * Fired when a coach invite is accepted and the org's seat count exceeds its limit.
 * Non-blocking — errors are logged but do not throw.
 */
export async function reportCoachSeatUsage(orgId: string): Promise<void> {
  const admin = createAdminClient()

  // Get the org owner's stripe_customer_id
  const { data: ownerMembership } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .single()

  if (!ownerMembership) return

  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', ownerMembership.user_id)
    .single()

  if (!ownerProfile?.stripe_customer_id) return

  try {
    const stripe = getStripe()
    await stripe.billing.meterEvents.create({
      event_name: 'coach_business_coach_overage',
      payload: {
        stripe_customer_id: ownerProfile.stripe_customer_id as string,
        value: '1',
      },
    })
  } catch (err) {
    console.error('Stripe coach seat overage error:', err instanceof Error ? err.message : String(err))
  }
}
