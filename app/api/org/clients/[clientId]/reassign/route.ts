import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole, getCoachPermissions, getOrgForUser } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const userId = session.user.id
  const admin = createAdminClient()

  // Check permissions: must be owner/admin OR have can_reassign_clients
  let orgId: string
  try {
    const membership = await requireOrgRole(userId, 'admin')
    orgId = membership.org_id
  } catch {
    // Not an admin — check if coach with reassign permission
    const membership = await getOrgForUser(userId)
    if (!membership) return Response.json({ error: 'Not a member of any organisation' }, { status: 403 })

    const perms = await getCoachPermissions(userId, membership.org_id)
    if (!perms.can_reassign_clients) {
      return Response.json({ error: 'Insufficient permissions to reassign clients' }, { status: 403 })
    }
    orgId = membership.org_id
  }

  const { to_coach_id, note } = await req.json() as { to_coach_id: string; note?: string }
  if (!to_coach_id) return Response.json({ error: 'to_coach_id is required' }, { status: 400 })

  // Verify the new coach is an active org member
  const { data: toCoachMember } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('user_id', to_coach_id)
    .eq('is_active', true)
    .single()

  if (!toCoachMember) {
    return Response.json({ error: 'Target coach is not an active member of this organisation' }, { status: 400 })
  }

  // Find the current active coach relationship for this client (within the org)
  const { data: orgMembers } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const orgCoachIds = (orgMembers ?? []).map((m) => m.user_id)

  const { data: currentRel } = await admin
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', clientId)
    .in('coach_id', orgCoachIds)
    .eq('status', 'active')
    .single()

  if (!currentRel) {
    return Response.json({ error: 'Client not found in this organisation' }, { status: 404 })
  }

  const fromCoachId = currentRel.coach_id

  if (fromCoachId === to_coach_id) {
    return Response.json({ error: 'Client is already assigned to that coach' }, { status: 400 })
  }

  // Reassign: archive old relationship, create new one
  await admin
    .from('coach_clients')
    .update({ status: 'archived' })
    .eq('client_id', clientId)
    .eq('coach_id', fromCoachId)

  await admin.from('coach_clients').upsert(
    {
      coach_id: to_coach_id,
      client_id: clientId,
      status: 'active',
      accepted_at: new Date().toISOString(),
    },
    { onConflict: 'coach_id,client_id' },
  )

  // Write audit record
  await admin.from('org_client_assignments').insert({
    org_id: orgId,
    client_id: clientId,
    from_coach_id: fromCoachId,
    to_coach_id,
    assigned_by: userId,
    note: note ?? null,
  })

  return Response.json({ ok: true })
}
