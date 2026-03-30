import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientSearch from './ClientSearch'

export default async function CoachClientsPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()

  const { data: allRows } = await supabase
    .from('coach_clients')
    .select('client_id, accepted_at, status')
    .eq('coach_id', coachId)
    .in('status', ['active', 'archived'])
    .order('accepted_at', { ascending: false })

  const allIds = (allRows ?? []).map((r) => r.client_id)

  type ClientRow = { id: string; email: string; name: string | null; tier: string; joinedAt: string | null; lastCheckIn: string | null }
  let active: ClientRow[] = []
  let archived: ClientRow[] = []

  if (allIds.length) {
    const admin = (await import('@/lib/supabase/admin')).createAdminClient()
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, subscription_tier, full_name')
      .in('id', allIds)

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

    const { data: latestCheckIns } = await supabase
      .from('check_ins')
      .select('user_id, created_at')
      .in('user_id', allIds)
      .order('created_at', { ascending: false })

    const lastCheckIn: Record<string, string> = {}
    for (const c of latestCheckIns ?? []) {
      if (!lastCheckIn[c.user_id]) lastCheckIn[c.user_id] = c.created_at
    }

    for (const r of allRows ?? []) {
      const p = profileMap[r.client_id]
      const row: ClientRow = {
        id: r.client_id,
        email: p?.email ?? 'Unknown',
        name: (p as Record<string, unknown>)?.full_name as string | null ?? null,
        tier: p?.subscription_tier ?? 'tier_1',
        joinedAt: r.accepted_at,
        lastCheckIn: lastCheckIn[r.client_id] ?? null,
      }
      if (r.status === 'archived') archived.push(row)
      else active.push(row)
    }
  }

  return (
    <main className="flex-1 p-6 space-y-6 max-w-4xl w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">{active.length} active{archived.length > 0 ? ` · ${archived.length} archived` : ''}</p>
        </div>
        <a
          href="/coach/dashboard"
          className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
        >
          + Invite client
        </a>
      </div>

      <ClientSearch clients={active as Parameters<typeof ClientSearch>[0]['clients']} archivedClients={archived as Parameters<typeof ClientSearch>[0]['clients']} />
    </main>
  )
}
