import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole } from '@/lib/org'

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

  // Get all coaches in this org
  const { data: orgMembers } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', membership.org_id)
    .eq('is_active', true)

  const coachIds = (orgMembers ?? []).map((m) => m.user_id)
  if (!coachIds.length) return Response.json([])

  // Get all active client relationships across org coaches
  const { data: clientRows } = await admin
    .from('coach_clients')
    .select('client_id, coach_id, accepted_at')
    .in('coach_id', coachIds)
    .eq('status', 'active')

  if (!clientRows?.length) return Response.json([])

  const clientIds = [...new Set(clientRows.map((r) => r.client_id))]

  // Fetch client profiles and coach profiles in parallel
  const [clientProfiles, coachProfiles, lastCheckIns] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, full_name, subscription_tier')
      .in('id', clientIds),

    admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', coachIds),

    admin
      .from('check_ins')
      .select('user_id, created_at')
      .in('user_id', clientIds)
      .order('created_at', { ascending: false }),
  ])

  const clientProfileMap = Object.fromEntries(
    (clientProfiles.data ?? []).map((p) => [p.id, p])
  )
  const coachProfileMap = Object.fromEntries(
    (coachProfiles.data ?? []).map((p) => [p.id, p])
  )

  // Latest check-in per client
  const lastCheckInMap: Record<string, string> = {}
  for (const ci of lastCheckIns.data ?? []) {
    if (!lastCheckInMap[ci.user_id]) lastCheckInMap[ci.user_id] = ci.created_at
  }

  const clients = clientRows.map((row) => ({
    id: row.client_id,
    email: clientProfileMap[row.client_id]?.email ?? null,
    full_name: clientProfileMap[row.client_id]?.full_name ?? null,
    subscription_tier: clientProfileMap[row.client_id]?.subscription_tier ?? 'coached',
    assigned_coach_id: row.coach_id,
    assigned_coach_name: coachProfileMap[row.coach_id]?.full_name ?? coachProfileMap[row.coach_id]?.email ?? null,
    join_date: row.accepted_at,
    last_checkin_at: lastCheckInMap[row.client_id] ?? null,
  }))

  return Response.json(clients)
}
