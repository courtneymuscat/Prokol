import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, buildPriceToTierMap, OVERAGE_PRICE_IDS, TIER_TO_USER_TYPE } from '@/lib/stripe'
import { INCLUDED_SEATS, INCLUDED_COACHES, CLIENT_OVERAGE_PRICE, COACH_OVERAGE_PRICE } from '@/lib/billing'
import { getOrgForUser } from '@/lib/org'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_tier, stripe_subscription_id, stripe_customer_id, subscription_seat_count')
      .eq('id', user.id)
      .single()

    let tier = profile?.subscription_tier ?? 'individual_free'
    const stripeCustomerId = profile?.stripe_customer_id as string | null
    const stripeSubscriptionId = profile?.stripe_subscription_id as string | null

    let next_billing_date: string | null = null
    let trial_end: string | null = null
    let cancel_at_period_end = false
    let cancels_at: string | null = null
    let valid_stripe_customer = false
    let overage_items: Array<{ label: string; amount: number }> = []

    if (stripeCustomerId) {
      try {
        const stripe = getStripe()
        const priceToTier = buildPriceToTierMap()

        // Validate the customer exists in the current Stripe mode
        await stripe.customers.retrieve(stripeCustomerId)
        valid_stripe_customer = true

        // Find the active subscription — use stored ID first, fall back to listing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let sub: any = null
        if (stripeSubscriptionId) {
          try {
            sub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
          } catch { sub = null }
        }
        if (!sub) {
          const list = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 1 })
          sub = list.data[0] ?? null
        }

        if (sub) {
          // Active trial
          if (sub.status === 'trialing' && sub.trial_end) {
            trial_end = new Date(sub.trial_end * 1000).toISOString()
          }
          const periodEnd = sub.items.data[0]?.current_period_end
          if (periodEnd) next_billing_date = new Date(periodEnd * 1000).toISOString()
          cancel_at_period_end = sub.cancel_at_period_end
          if (cancel_at_period_end && sub.cancel_at) {
            cancels_at = new Date(sub.cancel_at * 1000).toISOString()
          } else if (cancel_at_period_end && periodEnd) {
            cancels_at = new Date(periodEnd * 1000).toISOString()
          }

          // Derive the true tier from Stripe's subscription prices.
          // This self-heals if the webhook ever missed updating the DB profile.
          const flatItem = sub.items.data.find((item: { price: { id: string } }) => !OVERAGE_PRICE_IDS.has(item.price.id))
          const stripeTier = flatItem ? priceToTier[flatItem.price.id] : undefined
          if (stripeTier && stripeTier !== tier) {
            // DB is out of sync — correct it silently
            tier = stripeTier
            const resolvedUserType = TIER_TO_USER_TYPE[stripeTier]
            const updates: Record<string, unknown> = {
              subscription_tier: stripeTier,
              stripe_subscription_id: sub.id,
            }
            if (resolvedUserType) updates.user_type = resolvedUserType
            await admin.from('profiles').update(updates).eq('id', user.id)
          }
        }
      } catch {
        // Customer doesn't exist in this Stripe mode (test/live mismatch or deleted)
        valid_stripe_customer = false
      }
    }

    // If this user is an org member, billing/seat allowances are org-wide —
    // moved ahead of the seat count so both can be computed together below.
    const membership = await getOrgForUser(user.id)

    // Build overage breakdown for coach plans. For an org tier
    // (coach_business/wl_starter/wl_pro) the included-seat allowance is
    // for the whole organisation, so usage must be counted across every
    // coach in the org, not just the logged-in user — this used to only
    // count this user's own coach_clients (undercounting for any org with
    // more than one coach) and hardcoded coachSeatCount to 0 always,
    // regardless of how many coaches were actually in the org.
    let seatCount = 0
    let coachSeatCount = 0
    if (membership) {
      const { data: activeMembers } = await admin
        .from('org_members')
        .select('user_id')
        .eq('org_id', membership.org_id)
        .eq('is_active', true)
      const orgCoachIds = (activeMembers ?? []).map((m) => m.user_id)
      coachSeatCount = orgCoachIds.length

      const { count: orgClientCount } = orgCoachIds.length
        ? await admin
            .from('coach_clients')
            .select('*', { count: 'exact', head: true })
            .in('coach_id', orgCoachIds)
            .eq('status', 'active')
        : { count: 0 }
      seatCount = orgClientCount ?? 0
    } else {
      const { count: activeClientCount } = await admin
        .from('coach_clients')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', user.id)
        .eq('status', 'active')
      seatCount = activeClientCount ?? 0
    }

    const includedClients = INCLUDED_SEATS[tier] ?? 0
    const includedCoaches = INCLUDED_COACHES[tier] ?? 0
    const clientOverageRate = CLIENT_OVERAGE_PRICE[tier] ?? 0
    const coachOverageRate = COACH_OVERAGE_PRICE[tier] ?? 0

    const extraClients = Math.max(0, seatCount - includedClients)
    const extraCoaches = Math.max(0, coachSeatCount - includedCoaches)

    if (extraClients > 0 && clientOverageRate > 0) {
      overage_items.push({
        label: `${extraClients} extra client${extraClients > 1 ? 's' : ''} × $${clientOverageRate}/mo`,
        amount: extraClients * clientOverageRate,
      })
    }
    if (extraCoaches > 0 && coachOverageRate > 0) {
      overage_items.push({
        label: `${extraCoaches} extra coach${extraCoaches > 1 ? 'es' : ''} × $${coachOverageRate}/mo`,
        amount: extraCoaches * coachOverageRate,
      })
    }

    // If this user is a non-owner org member, billing is covered by the org.
    // (membership itself was already fetched above, for the seat counts.)
    let org_managed: { org_name: string; role: string; owner_email: string | null } | null = null
    if (membership && membership.role !== 'owner') {
      const { data: ownerMember } = await admin
        .from('org_members')
        .select('user_id')
        .eq('org_id', membership.org_id)
        .eq('role', 'owner')
        .maybeSingle()
      let ownerEmail: string | null = null
      if (ownerMember?.user_id) {
        const { data: ownerProfile } = await admin
          .from('profiles')
          .select('email')
          .eq('id', ownerMember.user_id)
          .single()
        ownerEmail = ownerProfile?.email ?? null
      }
      org_managed = {
        org_name: membership.org_name,
        role: membership.role,
        owner_email: ownerEmail,
      }
    }

    return NextResponse.json({
      subscription_tier: tier,
      next_billing_date,
      trial_end,
      cancel_at_period_end,
      cancels_at,
      has_stripe_customer: valid_stripe_customer,
      seat_count: seatCount,
      included_seats: includedClients,
      coach_seat_count: coachSeatCount,
      included_coaches: includedCoaches,
      client_overage_rate: clientOverageRate,
      coach_overage_rate: coachOverageRate,
      overage_items,
      org_managed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
