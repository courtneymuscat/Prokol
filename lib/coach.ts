import { createClient } from '@/lib/supabase/server'

/**
 * Accept a coach invite by token.
 * Called after a user signs up or logs in with an invite token.
 * Safe to call multiple times — does nothing if already accepted.
 */
export async function acceptInvite(token: string, clientId: string): Promise<void> {
  const supabase = await createClient()

  const { data: invite } = await supabase
    .from('coach_invites')
    .select('id, coach_id, status, expires_at')
    .eq('token', token)
    .single()

  if (!invite) return
  if (invite.status !== 'pending') return
  if (new Date(invite.expires_at) < new Date()) return

  // Link client to coach and switch them to coached tier (no individual plan)
  await supabase.from('coach_clients').upsert(
    { coach_id: invite.coach_id, client_id: clientId, accepted_at: new Date().toISOString(), status: 'active' },
    { onConflict: 'coach_id,client_id' }
  )
  await supabase.from('profiles').update({ subscription_tier: 'coached' }).eq('id', clientId)

  // Mark invite accepted
  await supabase.from('coach_invites').update({ status: 'accepted' }).eq('id', invite.id)
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
