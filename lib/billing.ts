import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'

export const COACH_SEAT_OVERAGE_PRICE = process.env.STRIPE_PRICE_COACH_BUSINESS_COACH_OVERAGE

// ─── Individual coach client-seat limits ─────────────────────────────────────

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

// ─── White-label org seat limits ─────────────────────────────────────────────

type WLSeatConfig = {
  included_coaches: number
  included_clients: number
  coach_event: string
  client_event: string
}

const WL_SEAT_CONFIG: Record<string, WLSeatConfig> = {
  wl_starter: {
    included_coaches: 5,
    included_clients: 200,
    coach_event:  'wl_starter_coach_overage',
    client_event: 'wl_starter_client_overage',
  },
  wl_pro: {
    included_coaches: 10,
    included_clients: 500,
    coach_event:  'wl_pro_coach_overage',
    client_event: 'wl_pro_client_overage',
  },
}

// ─── Individual coach seat reporting ─────────────────────────────────────────

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

// ─── Coach_business org coach seat reporting ──────────────────────────────────

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

// ─── White-label org seat reporting ──────────────────────────────────────────

/**
 * Increment the white-label org's seat count (coach or client) and report a
 * Stripe meter overage event when the org exceeds its plan's included limit.
 *
 * @param orgId  The organisation UUID
 * @param type   'coach' — a new coach joined the org
 *               'client' — a new coached client was added under the org
 *
 * Non-blocking — errors are logged but do not throw.
 */
export async function reportWhiteLabelSeatUsage(
  orgId: string,
  type: 'coach' | 'client',
): Promise<void> {
  const admin = createAdminClient()

  // Fetch org seat counts + subscription tier
  const { data: org } = await admin
    .from('organisations')
    .select('coach_seat_count, client_seat_count, subscription_tier, owner_id')
    .eq('id', orgId)
    .single()

  if (!org) return

  const tier = org.subscription_tier as string
  const config = WL_SEAT_CONFIG[tier]
  if (!config) return // not a WL tier — nothing to do

  // Get org owner's Stripe customer ID
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', org.owner_id)
    .single()

  const stripeCustomerId = ownerProfile?.stripe_customer_id as string | null

  if (type === 'coach') {
    const currentCount = (org.coach_seat_count as number) ?? 0

    await admin
      .from('organisations')
      .update({ coach_seat_count: currentCount + 1 })
      .eq('id', orgId)

    if (currentCount >= config.included_coaches && stripeCustomerId) {
      await fireMeterEvent(config.coach_event, stripeCustomerId)
    }
  } else {
    const currentCount = (org.client_seat_count as number) ?? 0

    await admin
      .from('organisations')
      .update({ client_seat_count: currentCount + 1 })
      .eq('id', orgId)

    if (currentCount >= config.included_clients && stripeCustomerId) {
      await fireMeterEvent(config.client_event, stripeCustomerId)
    }
  }
}

async function fireMeterEvent(eventName: string, stripeCustomerId: string): Promise<void> {
  try {
    const stripe = getStripe()
    await stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: {
        stripe_customer_id: stripeCustomerId,
        value: '1',
      },
    })
  } catch (err) {
    console.error('Stripe WL meter event error:', err instanceof Error ? err.message : String(err))
  }
}
