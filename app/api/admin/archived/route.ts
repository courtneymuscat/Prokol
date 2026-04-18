import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/admin'

export async function GET() {
  await requirePlatformAdmin()
  const admin = createAdminClient()

  const { data: rows, error } = await admin
    .from('coach_clients')
    .select('client_id, coach_id, archived_at, accepted_at')
    .eq('status', 'archived')
    .order('archived_at', { ascending: false, nullsFirst: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return Response.json({ clients: [] })

  const clientIds = [...new Set(rows.map(r => r.client_id))]
  const coachIds = [...new Set(rows.map(r => r.coach_id))]

  const [clientsRes, coachesRes] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, subscription_tier').in('id', clientIds),
    admin.from('profiles').select('id, full_name, email').in('id', coachIds),
  ])

  const clientMap = Object.fromEntries((clientsRes.data ?? []).map(p => [p.id, p]))
  const coachMap = Object.fromEntries((coachesRes.data ?? []).map(p => [p.id, p]))

  const clients = rows.map(r => ({
    client_id: r.client_id,
    coach_id: r.coach_id,
    client_name: clientMap[r.client_id]?.full_name ?? null,
    client_email: clientMap[r.client_id]?.email ?? 'Unknown',
    coach_name: coachMap[r.coach_id]?.full_name ?? coachMap[r.coach_id]?.email ?? 'Unknown',
    tier: clientMap[r.client_id]?.subscription_tier ?? null,
    joined_at: r.accepted_at,
    archived_at: r.archived_at,
  }))

  return Response.json({ clients })
}
