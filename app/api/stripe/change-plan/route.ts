import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, getStripePriceId, getStripeOveragePriceId, getStripeCoachOveragePriceId, TIER_TO_USER_TYPE } from '@/lib/stripe'
import { syncWhiteLabelTierForOwner } from '@/lib/whitelabel'

/**
 * POST /api/stripe/change-plan { planKey: 'coach_pro' | ... }
 *
 * Updates the user's existing Stripe subscription in place: replaces the
 * flat plan price and overage meter price with the ones for the target
 * tier, prorating the change immediately. Stripe fires
 * customer.subscription.updated which the webhook already turns into a
 * profile tier update.
 *
 * Only allows switching between self-serve tiers in the same family
 * (coach tiers ↔ coach tiers, individual paid ↔ individual paid).
 * Cancel + resub-as-different-tier should go through the portal /
 * pricing flow instead.
 */

const SELF_SERVE_COACH_TIERS = new Set([
  'coach_pt_solo',
  'coach_nutritionist_solo',
  'coach_pro',
  'coach_business',
  'wl_starter',
  'wl_pro',
])

const SELF_SERVE_INDIVIDUAL_TIERS = new Set([
  'individual_optimiser',
  'individual_elite',
])

const PLAN_KEY_TO_TIER: Record<string, string> = {
  individual_tier_2: 'individual_optimiser',
  individual_tier_3: 'individual_elite',
  individual_optimiser: 'individual_optimiser',
  individual_elite: 'individual_elite',
  coach_pt_solo: 'coach_pt_solo',
  coach_nutritionist_solo: 'coach_nutritionist_solo',
  coach_pro: 'coach_pro',
  coach_business: 'coach_business',
  wl_starter: 'wl_starter',
  wl_pro: 'wl_pro',
}

const TIER_TO_BILLING_KEY: Record<string, string> = {
  individual_optimiser: 'individual_tier_2',
  individual_elite: 'individual_tier_3',
  coach_pt_solo: 'coach_pt_solo',
  coach_nutritionist_solo: 'coach_nutritionist_solo',
  coach_pro: 'coach_pro',
  coach_business: 'coach_business',
  wl_starter: 'wl_starter',
  wl_pro: 'wl_pro',
}

function isSameFamily(currentTier: string, targetTier: string): boolean {
  const coach = SELF_SERVE_COACH_TIERS
  const indiv = SELF_SERVE_INDIVIDUAL_TIERS
  // Allow legacy coach_solo holders to switch to any new coach tier.
  const currentIsCoach = coach.has(currentTier) || currentTier === 'coach_solo'
  const targetIsCoach = coach.has(targetTier)
  if (currentIsCoach && targetIsCoach) return true
  if (indiv.has(currentTier) && indiv.has(targetTier)) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const { planKey: rawPlanKey } = await req.json() as { planKey?: string }
    if (!rawPlanKey) return NextResponse.json({ error: 'planKey required' }, { status: 400 })

    const targetTier = PLAN_KEY_TO_TIER[rawPlanKey]
    if (!targetTier) return NextResponse.json({ error: `Unknown plan: ${rawPlanKey}` }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({
        error: 'no_subscription',
        message: 'No active subscription found. Subscribe from /pricing first.',
      }, { status: 400 })
    }

    const currentTier = profile.subscription_tier as string
    if (currentTier === targetTier) {
      return NextResponse.json({ error: 'already_on_plan', message: 'You are already on that plan.' }, { status: 400 })
    }
    if (!isSameFamily(currentTier, targetTier)) {
      return NextResponse.json({
        error: 'incompatible_family',
        message: `Can't switch from ${currentTier} to ${targetTier} in place. Cancel and resubscribe via /pricing.`,
      }, { status: 400 })
    }

    // Resolve the new prices. Billing is monthly for coach plans; for
    // individual we use whatever was on the existing subscription (most are
    // monthly today).
    const billingKey = TIER_TO_BILLING_KEY[targetTier]
    const newFlatPriceId = getStripePriceId(billingKey, 'monthly')
    if (!newFlatPriceId) {
      return NextResponse.json({ error: `Price not configured for ${targetTier}` }, { status: 500 })
    }
    const newOveragePriceId = getStripeOveragePriceId(billingKey)
    const newCoachOveragePriceId = getStripeCoachOveragePriceId(billingKey)

    const stripe = getStripe()

    const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id as string)

    // Build the items update: mark every existing item for deletion and
    // append the new flat + new overage. Stripe processes the diff and
    // computes proration based on `proration_behavior: 'create_prorations'`.
    type ItemPatch =
      | { id: string; deleted: true }
      | { price: string; quantity?: number }
    const items: ItemPatch[] = sub.items.data.map((item) => ({ id: item.id, deleted: true }))
    items.push({ price: newFlatPriceId, quantity: 1 })
    if (newOveragePriceId) items.push({ price: newOveragePriceId })
    if (newCoachOveragePriceId) items.push({ price: newCoachOveragePriceId })

    const updated = await stripe.subscriptions.update(profile.stripe_subscription_id as string, {
      items,
      proration_behavior: 'create_prorations',
      metadata: {
        ...sub.metadata,
        planKey: billingKey,
      },
      payment_behavior: 'allow_incomplete',
    })

    // Defensive: update the profile right here too, so by the time the
    // browser reloads /settings the new tier is already visible. The
    // customer.subscription.updated webhook will also fire, but Stripe
    // delivers it asynchronously and we don't want a 1–2s window where the
    // UI still shows the old plan.
    const admin = createAdminClient()
    const resolvedUserType = TIER_TO_USER_TYPE[targetTier]
    const dbUpdates: Record<string, unknown> = { subscription_tier: targetTier }
    if (resolvedUserType) dbUpdates.user_type = resolvedUserType
    const { error: dbErr } = await admin
      .from('profiles')
      .update(dbUpdates)
      .eq('id', user.id)
    if (dbErr) console.error('change-plan defensive profile update error:', dbErr.message)

    // Also synchronous and deliberately not left to the webhook — this
    // route already writes the new tier to the DB above, which typically
    // lands before the webhook for this same change even arrives. The
    // webhook's own version of this check reads profiles.subscription_tier
    // to detect "did the tier change", which would already show the new
    // tier by then and silently skip turning white-label off.
    await syncWhiteLabelTierForOwner(user.id, currentTier, targetTier).catch((err) => {
      console.error('change-plan syncWhiteLabelTierForOwner error:', err instanceof Error ? err.message : err)
    })

    return NextResponse.json({
      ok: true,
      message: `Switched to ${targetTier}. Any prorated charge or credit is on your next invoice.`,
      subscription_id: updated.id,
      new_tier: targetTier,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('change-plan error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
