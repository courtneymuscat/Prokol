import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole, getOrgForUser, getCoachPermissions } from '@/lib/org'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Admins always have access; coaches need can_view_all_clients
  let membership
  try {
    membership = await requireOrgRole(session.user.id, 'admin')
  } catch {
    const m = await getOrgForUser(session.user.id)
    if (!m) return Response.json({ error: 'Not a member of any organisation' }, { status: 403 })
    const perms = await getCoachPermissions(session.user.id, m.org_id)
    if (!perms.can_view_all_clients) {
      return Response.json({ error: 'Insufficient permissions to view all org clients' }, { status: 403 })
    }
    membership = m
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

  // Fetch client profiles and coach profiles in parallel. "Last check-in"
  // merges three sources, same as the coach's own /coach/clients list
  // (app/coach/clients/page.tsx) — the raw daily check_ins table,
  // autoflow_responses, and form_submissions (weekly check-in forms,
  // onboarding forms, etc.). Querying check_ins alone — the original bug
  // here — showed "Never" for any client who only ever submits via a form,
  // which is the primary way most coaches actually run check-ins.
  const [clientProfiles, coachProfiles, latestCheckIns, latestAutoflowResps, latestFormSubs] = await Promise.all([
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
      .or('sleep_hours.not.is.null,notes.not.is.null,rhr.not.is.null,hrv.not.is.null')
      .order('created_at', { ascending: false }),

    admin
      .from('autoflow_responses')
      .select('client_id, submitted_at')
      .in('client_id', clientIds)
      .order('submitted_at', { ascending: false }),

    admin
      .from('form_submissions')
      .select('client_id, submitted_at')
      .in('client_id', clientIds)
      .order('submitted_at', { ascending: false }),
  ])

  const clientProfileMap = Object.fromEntries(
    (clientProfiles.data ?? []).map((p) => [p.id, p])
  )
  const coachProfileMap = Object.fromEntries(
    (coachProfiles.data ?? []).map((p) => [p.id, p])
  )

  // Latest check-in per client, across all three sources.
  const lastCheckInMap: Record<string, string> = {}
  for (const ci of latestCheckIns.data ?? []) {
    if (!lastCheckInMap[ci.user_id]) lastCheckInMap[ci.user_id] = ci.created_at
  }
  for (const r of latestAutoflowResps.data ?? []) {
    const existing = lastCheckInMap[r.client_id]
    if (!existing || r.submitted_at > existing) lastCheckInMap[r.client_id] = r.submitted_at
  }
  for (const r of latestFormSubs.data ?? []) {
    const existing = lastCheckInMap[r.client_id]
    if (!existing || r.submitted_at > existing) lastCheckInMap[r.client_id] = r.submitted_at
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
