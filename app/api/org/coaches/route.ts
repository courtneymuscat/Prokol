import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole, getCoachPermissions } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function GET() {
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

  // Get all active members of this org
  const { data: members } = await admin
    .from('org_members')
    .select('user_id, role, invited_at, accepted_at, is_active')
    .eq('org_id', membership.org_id)
    .eq('is_active', true)

  if (!members?.length) return Response.json([])

  const memberIds = members.map((m) => m.user_id)

  // Fetch profiles and client counts in parallel
  const [profilesResult, clientCountsResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, full_name, subscription_tier')
      .in('id', memberIds),

    admin
      .from('coach_clients')
      .select('coach_id')
      .in('coach_id', memberIds)
      .eq('status', 'active'),
  ])

  const profileMap = Object.fromEntries(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  )

  const clientCountMap: Record<string, number> = {}
  for (const row of clientCountsResult.data ?? []) {
    clientCountMap[row.coach_id] = (clientCountMap[row.coach_id] ?? 0) + 1
  }

  // Fetch permissions for each coach
  const permissionsMap = Object.fromEntries(
    await Promise.all(
      memberIds.map(async (id) => [
        id,
        await getCoachPermissions(id, membership.org_id),
      ])
    )
  )

  const coaches = members.map((m) => ({
    id: m.user_id,
    role: m.role,
    invited_at: m.invited_at,
    accepted_at: m.accepted_at,
    email: profileMap[m.user_id]?.email ?? null,
    full_name: profileMap[m.user_id]?.full_name ?? null,
    client_count: clientCountMap[m.user_id] ?? 0,
    permissions: permissionsMap[m.user_id],
  }))

  return Response.json(coaches)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try {
    membership = await requireOrgRole(session.user.id, 'admin')
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status: 403 })
  }

  const { email, role = 'coach' } = await req.json() as { email: string; role?: string }
  if (!email?.trim()) return Response.json({ error: 'Email required' }, { status: 400 })
  if (!['admin', 'coach'].includes(role)) {
    return Response.json({ error: 'Role must be admin or coach' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up the invited coach by email
  const { data: invitee } = await admin
    .from('profiles')
    .select('id, user_type')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!invitee) {
    return Response.json({ error: 'No account found for that email address' }, { status: 404 })
  }
  if (invitee.user_type !== 'coach') {
    return Response.json({ error: 'That user is not a coach account' }, { status: 400 })
  }

  // Check not already a member
  const { data: existing } = await admin
    .from('org_members')
    .select('id')
    .eq('org_id', membership.org_id)
    .eq('user_id', invitee.id)
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'Coach is already a member of this organisation' }, { status: 409 })
  }

  // Create the membership (pending — accepted_at null until coach accepts)
  const { data: member, error } = await admin
    .from('org_members')
    .insert({
      org_id: membership.org_id,
      user_id: invitee.id,
      role,
      is_active: false, // becomes active when the coach accepts
    })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Create default permissions record
  await admin.from('org_coach_permissions').insert({
    org_id: membership.org_id,
    coach_id: invitee.id,
    updated_by: session.user.id,
  })

  return Response.json({ member_id: member.id, invited_user_id: invitee.id })
}
