import { createAdminClient } from '@/lib/supabase/admin'

/**
 * If a coach was removed from an organisation, their profile gets a
 * coach_grace_until timestamp 3 days in the future. While we're inside that
 * window they keep coach_business access and their clients stay coached.
 * Once the timestamp passes, the next login/dashboard load triggers this
 * helper which downgrades them and their coached clients to individual_free,
 * matching the behaviour of a cancelled Stripe subscription.
 *
 * If they've taken out their own paid Stripe subscription during the grace
 * window, their stripe_subscription_id will be set and we skip the downgrade
 * — the Stripe webhook is the source of truth there.
 */
export async function enforceCoachGrace(userId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, coach_grace_until, subscription_tier, stripe_subscription_id')
    .eq('id', userId)
    .single()

  if (!profile?.coach_grace_until) return
  const expiresAt = new Date(profile.coach_grace_until as string)
  if (expiresAt > new Date()) return // grace still active

  // They took out their own subscription during grace — clear the flag and
  // leave their tier alone.
  if (profile.stripe_subscription_id) {
    await admin
      .from('profiles')
      .update({ coach_grace_until: null })
      .eq('id', userId)
    return
  }

  // Downgrade the coach to free
  await admin
    .from('profiles')
    .update({
      subscription_tier: 'individual_free',
      user_type: 'individual',
      role: 'client',
      coach_grace_until: null,
    })
    .eq('id', userId)

  // Downgrade their currently-coached clients to free (mirror the cancelled
  // subscription behaviour). Clients on their own paid plan are untouched.
  const { data: clients } = await admin
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', userId)
    .eq('status', 'active')

  const clientIds = (clients ?? []).map((r) => r.client_id as string)
  if (clientIds.length > 0) {
    await admin
      .from('profiles')
      .update({ subscription_tier: 'individual_free', user_type: 'individual' })
      .in('id', clientIds)
      .eq('subscription_tier', 'coached')
  }
}
