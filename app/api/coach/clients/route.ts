import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { getOrgForUser } from '@/lib/org'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  // A coach who owns more than one org (gym org-switching) is still the
  // same coach_id in every one of them — without this, this list would
  // return every org's clients regardless of which one is active.
  const membership = await getOrgForUser(coachId)

  let rowsQuery = supabase
    .from('coach_clients')
    .select('client_id, accepted_at, status')
    .eq('coach_id', coachId)
    .eq('status', 'active')
  if (membership) rowsQuery = rowsQuery.eq('org_id', membership.org_id)
  const { data: rows } = await rowsQuery.order('accepted_at', { ascending: false })

  if (!rows?.length) return Response.json([])

  const clientIds = rows.map((r) => r.client_id)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, subscription_tier')
    .in('id', clientIds)

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const clients = rows.map((r) => ({
    id: r.client_id,
    email: profileMap[r.client_id]?.email ?? 'Unknown',
    full_name: profileMap[r.client_id]?.full_name ?? null,
    subscription_tier: profileMap[r.client_id]?.subscription_tier ?? 'individual_free',
    joined_at: r.accepted_at,
  }))

  return Response.json(clients)
}
