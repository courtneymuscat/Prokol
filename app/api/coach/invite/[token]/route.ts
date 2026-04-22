import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('coach_invites')
    .select('id, email, coach_id')
    .eq('token', token)
    .single()

  if (!invite || invite.coach_id !== coachId) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Mark invite as revoked
  await admin.from('coach_invites').update({ status: 'revoked' }).eq('token', token)

  // Find the client record associated with this email
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', invite.email)
    .single()

  if (profile?.id) {
    // Remove the pending coach_clients row regardless
    await admin
      .from('coach_clients')
      .delete()
      .eq('coach_id', coachId)
      .eq('client_id', profile.id)
      .eq('status', 'pending_invite')

    // If this is a ghost (unconfirmed) user, delete the auth user entirely
    const { data: { user } } = await admin.auth.admin.getUserById(profile.id)
    if (user && !user.email_confirmed_at) {
      await admin.auth.admin.deleteUser(profile.id)
    }
  }

  return Response.json({ ok: true })
}
