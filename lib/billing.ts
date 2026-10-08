import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, buildPriceToTierMap, OVERAGE_PRICE_IDS, TIER_TO_USER_TYPE } from '@/lib/stripe'
import type Stripe from 'stripe'

/**
 * Resolve a subscription_tier from a Stripe price (and its parent product).
 *
 * Resolution order:
 *  1. Env-var price-id map (buildPriceToTierMap) — preferred when configured
 *  2. Stripe product metadata.tier — set this on each product in Stripe to
 *     decouple from env vars (e.g. metadata: { tier: "coach_pt_solo" })
 *  3. Stripe product name heuristic — last resort so untagged products still
 *     work (e.g. a product named "Coach Pro" maps to coach_pro)
 *
 * Returns undefined only if all three fail.
 */
export async function resolveTierFromPrice(price: Stripe.Price | null | undefined): Promise<string | undefined> {
  if (!price) return undefined

  const stripe = getStripe()
  const priceToTier = buildPriceToTierMap()

  let tier = priceToTier[price.id]
  if (tier) return tier

  if (!price.product) return undefined
  const productId = typeof price.product === 'string' ? price.product : price.product.id

  try {
    const product = await stripe.products.retrieve(productId)
    const metaTier = product.metadata?.tier as string | undefined
    if (metaTier) return metaTier

    const name = (product.name ?? '').toLowerCase()
    if (name.includes('business')) tier = 'coach_business'
    else if (name.includes('pro')) tier = 'coach_pro'
    else if (name.includes('nutritionist')) tier = 'coach_nutritionist_solo'
    else if (name.includes('personal trainer') || name.includes(' pt')) tier = 'coach_pt_solo'
    else if (name.includes('solo')) tier = 'coach_solo'
    else if (name.includes('elite')) tier = 'individual_elite'
    else if (name.includes('optimiser') || name.includes('optimizer')) tier = 'individual_optimiser'
  } catch {
    // ignore — return undefined
  }
  return tier
}

/**
 * Reconcile a user's profile (subscription_tier, user_type, stripe_*) from
 * Stripe — used as a backstop in case the webhook never fired or failed.
 *
 * Looks up the customer by stripe_customer_id (or by email as a fallback),
 * finds the most recent active/trialing subscription, maps its flat price to
 * a tier, and updates the profile if it diverges. No-op if Stripe has no
 * active subscription for this user.
 *
 * Safe to call on every login / dashboard load — bails out fast when the
 * profile already matches what Stripe says.
 */
export async function syncProfileFromStripe(userId: string): Promise<{
  changed: boolean
  tier: string | null
  reason?: string
}> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, subscription_tier, user_type, stripe_customer_id, stripe_subscription_id')
    .eq('id', userId)
    .single()

  if (!profile) return { changed: false, tier: null, reason: 'no profile' }

  // Always stamp the synced-at, even on a no-op exit, so the dashboard's
  // hourly skip-window doesn't keep retrying users with no Stripe customer.
  await admin
    .from('profiles')
    .update({ stripe_last_synced_at: new Date().toISOString() })
    .eq('id', userId)

  const stripe = getStripe()

  // Resolve customer id — prefer the stored one, fall back to email lookup
  let customerId = profile.stripe_customer_id as string | null
  if (!customerId && profile.email) {
    try {
      const found = await stripe.customers.list({ email: profile.email as string, limit: 1 })
      customerId = found.data[0]?.id ?? null
    } catch {
      return { changed: false, tier: null, reason: 'stripe customer lookup failed' }
    }
  }

  if (!customerId) return { changed: false, tier: null, reason: 'no stripe customer' }

  // Find an active or trialing subscription for this customer
  let subscription
  try {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    })
    subscription =
      subs.data.find((s) => s.status === 'active' || s.status === 'trialing') ??
      subs.data.find((s) => s.status === 'past_due')
  } catch {
    return { changed: false, tier: null, reason: 'stripe subscription list failed' }
  }

  if (!subscription) return { changed: false, tier: null, reason: 'no active subscription' }

  const flatItem = subscription.items.data.find((item) => !OVERAGE_PRICE_IDS.has(item.price.id))
  const tier = await resolveTierFromPrice(flatItem?.price)

  if (!tier) return { changed: false, tier: null, reason: 'could not resolve tier from price/product' }

  const resolvedUserType = TIER_TO_USER_TYPE[tier]

  const updates: Record<string, unknown> = {}
  if (profile.subscription_tier !== tier) updates.subscription_tier = tier
  if (resolvedUserType && profile.user_type !== resolvedUserType) updates.user_type = resolvedUserType
  if (!profile.stripe_customer_id) updates.stripe_customer_id = customerId
  if (profile.stripe_subscription_id !== subscription.id) updates.stripe_subscription_id = subscription.id

  if (Object.keys(updates).length === 0) {
    return { changed: false, tier, reason: 'already in sync' }
  }

  // Capture supabase-js error explicitly. Previously we awaited without
  // checking `.error`, so a failed update (RLS, missing service-role key,
  // trigger reverting, etc.) silently looked like success — stranding paid
  // users on individual_free with no signal in any log.
  const { error: updateError, data: updatedRows, count } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, user_type, subscription_tier, stripe_customer_id, stripe_subscription_id')
  if (updateError) {
    console.error('syncProfileFromStripe update error:', updateError.message, updateError)
    return { changed: false, tier, reason: `update failed: ${updateError.message}` }
  }
  if (!updatedRows || updatedRows.length === 0) {
    console.error('syncProfileFromStripe update affected 0 rows', { userId, updates, count })
    return { changed: false, tier, reason: 'update affected 0 rows (RLS or stale id?)' }
  }
  return { changed: true, tier }
}

// ─── Individual coach client-seat limits ─────────────────────────────────────

export const INCLUDED_SEATS: Record<string, number> = {
  coach_solo:                5,  // legacy
  coach_pt_solo:             5,
  coach_nutritionist_solo:   5,
  coach_pro:                 15,
  coach_business:            75,
}

export const INCLUDED_COACHES: Record<string, number> = {
  coach_business: 3,
  wl_starter:     5,
  wl_pro:         10,
}

// organisations.coach_seat_limit is the hard cap enforced when inviting a
// coach (see app/api/org/coaches/route.ts, app/api/org/invite/[token]/route.ts)
// — a different mechanism from the metered client-overage billing above.
// Keyed by organisations.white_label_tier ('starter'/'pro'), not the
// profile-level Stripe plan key ('wl_starter'/'wl_pro') used by
// INCLUDED_COACHES, since that's the value white-label approval/reinstate
// actually have on hand. DEFAULT_COACH_SEAT_LIMIT is what an org falls back
// to when white-label is off — matches INCLUDED_COACHES.coach_business.
export const WHITE_LABEL_COACH_SEAT_LIMIT: Record<'starter' | 'pro', number> = {
  starter: INCLUDED_COACHES.wl_starter,
  pro:     INCLUDED_COACHES.wl_pro,
}
export const DEFAULT_COACH_SEAT_LIMIT = INCLUDED_COACHES.coach_business

// AUD per extra client per month (used for display + Stripe meter)
export const CLIENT_OVERAGE_PRICE: Record<string, number> = {
  coach_solo:                4,  // legacy
  coach_pt_solo:             4,
  coach_nutritionist_solo:   4,
  coach_pro:                 3,
  coach_business:            3,
}

// AUD per extra coach per month (business plans only)
export const COACH_OVERAGE_PRICE: Record<string, number> = {
  coach_business: 19,
}

export const TIER_TO_METER_EVENT: Record<string, string> = {
  coach_solo:                'coach_solo_seat_overage',   // legacy
  coach_pt_solo:             'coach_pt_solo_seat_overage',
  coach_nutritionist_solo:   'coach_nutritionist_solo_seat_overage',
  coach_pro:                 'coach_pro_seat_overage',
  coach_business:            'coach_business_seat_overage',
}

// ─── White-label org client-seat limits ──────────────────────────────────────
// Coach seats for white-label orgs are a hard cap, not metered — see
// WHITE_LABEL_COACH_SEAT_LIMIT and organisations.coach_seat_limit above.
// Clients are metered/billed past the included limit instead, same model
// as an individual coach's own client overage.

type WLClientSeatConfig = {
  included_clients: number
  client_event: string
}

// Keyed by organisations.white_label_tier ('starter'/'pro') — NOT the
// profile-level Stripe plan key ('wl_starter'/'wl_pro'). This used to be
// keyed 'wl_starter'/'wl_pro' and read organisations.subscription_tier,
// which doesn't exist in that value space (that column is constrained to
// legacy 'org_starter'/'org_enterprise' values and is never set to a wl
// tier anywhere) — reportWhiteLabelSeatUsage could never actually fire.
const WL_CLIENT_SEAT_CONFIG: Record<'starter' | 'pro', WLClientSeatConfig> = {
  starter: { included_clients: 200, client_event: 'wl_starter_client_overage' },
  pro:     { included_clients: 500, client_event: 'wl_pro_client_overage' },
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

const COACH_SEAT_OVERAGE_EVENT: Record<string, string> = {
  coach_business: 'coach_business_coach_overage',
  wl_starter:     'wl_starter_coach_overage',
  wl_pro:         'wl_pro_coach_overage',
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
    .select('stripe_customer_id, subscription_tier, org_coach_seat_count')
    .eq('id', ownerMembership.user_id)
    .single()

  if (!ownerProfile?.stripe_customer_id) return

  const tier = ownerProfile.subscription_tier as string
  const includedCoaches = INCLUDED_COACHES[tier] ?? 0
  const coachSeatCount = (ownerProfile.org_coach_seat_count as number) ?? 0

  // Increment coach seat count on the owner profile
  await admin
    .from('profiles')
    .update({ org_coach_seat_count: coachSeatCount + 1 })
    .eq('id', ownerMembership.user_id)

  // Only fire overage event once included seats are exceeded. Event name
  // varies by the owner's actual tier — this used to always report to
  // coach_business_coach_overage even for wl_starter/wl_pro owners, so a
  // white-label org's coach overage silently billed (or rather, didn't
  // bill, since that meter has no price tied to a wl subscription) against
  // the wrong Stripe meter entirely.
  if (coachSeatCount >= includedCoaches) {
    const eventName = COACH_SEAT_OVERAGE_EVENT[tier] ?? COACH_SEAT_OVERAGE_EVENT.coach_business
    try {
      const stripe = getStripe()
      await stripe.billing.meterEvents.create({
        event_name: eventName,
        payload: {
          stripe_customer_id: ownerProfile.stripe_customer_id as string,
          value: '1',
        },
      })
    } catch (err) {
      console.error('Stripe coach seat overage error:', err instanceof Error ? err.message : String(err))
    }
  }
}

// ─── White-label org client-seat reporting ───────────────────────────────────

/**
 * Increment a white-label org's client seat count and report a Stripe meter
 * overage event once it exceeds its plan's included client limit. Coaches
 * are deliberately NOT handled here — organisations.coach_seat_count is
 * already incremented and hard-capped directly in
 * app/api/org/invite/[token]/route.ts; adding a second incrementer here
 * would double-count every coach join.
 */
export async function reportWhiteLabelClientSeatUsage(orgId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organisations')
    .select('client_seat_count, is_white_label, white_label_tier, owner_id')
    .eq('id', orgId)
    .single()

  if (!org?.is_white_label) return

  const tier = org.white_label_tier as 'starter' | 'pro' | null
  const config = tier ? WL_CLIENT_SEAT_CONFIG[tier] : undefined
  if (!config) return

  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', org.owner_id)
    .single()

  const stripeCustomerId = ownerProfile?.stripe_customer_id as string | null
  const currentCount = (org.client_seat_count as number) ?? 0

  await admin
    .from('organisations')
    .update({ client_seat_count: currentCount + 1 })
    .eq('id', orgId)

  if (currentCount >= config.included_clients && stripeCustomerId) {
    await fireMeterEvent(config.client_event, stripeCustomerId)
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
