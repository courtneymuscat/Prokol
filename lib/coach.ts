import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Accept a coach invite by token.
 * Called after a user signs up or logs in with an invite token.
 * Safe to call multiple times — does nothing if already accepted.
 */
export async function acceptInvite(token: string, clientId: string): Promise<void> {
  // Use admin client for invite lookup — RLS blocks the signing-up user from reading coach_invites
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('coach_invites')
    .select('id, coach_id, status, expires_at, service_id')
    .eq('token', token)
    .single()

  if (!invite) return
  if (invite.status !== 'pending') return
  if (new Date(invite.expires_at) < new Date()) return

  // Link client to coach and switch them to coached tier
  await admin.from('coach_clients').upsert(
    { coach_id: invite.coach_id, client_id: clientId, accepted_at: new Date().toISOString(), status: 'active', service_id: invite.service_id ?? null },
    { onConflict: 'coach_id,client_id' }
  )
  await admin.from('profiles').update({ subscription_tier: 'coached' }).eq('id', clientId)

  // Mark invite accepted
  await admin.from('coach_invites').update({ status: 'accepted' }).eq('id', invite.id)
}

/**
 * Verify the current request is from a coach and return their user id.
 * Returns null if the user is not authenticated or not a coach.
 */
export async function requireCoach(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', session.user.id)
    .single()

  if (profile?.user_type !== 'coach') return null
  return session.user.id
}
