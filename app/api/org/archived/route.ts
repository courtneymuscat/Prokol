import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole } from '@/lib/org'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try { membership = await requireOrgRole(session.user.id, 'coach') }
  catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const admin = createAdminClient()

  const { data: orgMembers } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', membership.org_id)
    .eq('is_active', true)

  const coachIds = (orgMembers ?? []).map(m => m.user_id)
  if (!coachIds.length) return Response.json([])

  const { data: rows } = await admin
    .from('coach_clients')
    .select('client_id, coach_id, accepted_at, archived_at')
    .in('coach_id', coachIds)
    .eq('status', 'archived')
    .order('archived_at', { ascending: false, nullsFirst: false })

  if (!rows?.length) return Response.json([])

  const clientIds = [...new Set(rows.map(r => r.client_id))]
  const [clientsRes, coachesRes] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, subscription_tier').in('id', clientIds),
    admin.from('profiles').select('id, full_name, email').in('id', coachIds),
  ])

  const clientMap = Object.fromEntries((clientsRes.data ?? []).map(p => [p.id, p]))
  const coachMap = Object.fromEntries((coachesRes.data ?? []).map(p => [p.id, p]))

  return Response.json(rows.map(r => ({
    client_id: r.client_id,
    client_name: clientMap[r.client_id]?.full_name ?? null,
    client_email: clientMap[r.client_id]?.email ?? 'Unknown',
    coach_name: coachMap[r.coach_id]?.full_name ?? coachMap[r.coach_id]?.email ?? 'Unknown',
    joined_at: r.accepted_at,
    archived_at: r.archived_at,
  })))
}
