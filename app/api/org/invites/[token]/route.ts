import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try {
    membership = await requireOrgRole(session.user.id, 'admin')
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('org_invites')
    .select('id, org_id')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!invite) return Response.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.org_id !== membership.org_id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  await admin
    .from('org_invites')
    .update({ is_active: false })
    .eq('id', invite.id)

  return Response.json({ success: true })
}
