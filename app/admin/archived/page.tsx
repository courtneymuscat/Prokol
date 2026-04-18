import { requirePlatformAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type ArchivedClient = {
  client_id: string
  coach_id: string
  client_name: string | null
  client_email: string
  coach_name: string
  tier: string | null
  joined_at: string | null
  archived_at: string | null
}

async function getArchivedClients(): Promise<ArchivedClient[]> {
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('coach_clients')
    .select('client_id, coach_id, archived_at, accepted_at')
    .eq('status', 'archived')
    .order('archived_at', { ascending: false, nullsFirst: false })

  if (!rows?.length) return []

  const clientIds = [...new Set(rows.map(r => r.client_id))]
  const coachIds = [...new Set(rows.map(r => r.coach_id))]

  const [clientsRes, coachesRes] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, subscription_tier').in('id', clientIds),
    admin.from('profiles').select('id, full_name, email').in('id', coachIds),
  ])

  const clientMap = Object.fromEntries((clientsRes.data ?? []).map(p => [p.id, p]))
  const coachMap = Object.fromEntries((coachesRes.data ?? []).map(p => [p.id, p]))

  return rows.map(r => ({
    client_id: r.client_id,
    coach_id: r.coach_id,
    client_name: clientMap[r.client_id]?.full_name ?? null,
    client_email: clientMap[r.client_id]?.email ?? 'Unknown',
    coach_name: coachMap[r.coach_id]?.full_name ?? coachMap[r.coach_id]?.email ?? 'Unknown',
    tier: clientMap[r.client_id]?.subscription_tier ?? null,
    joined_at: r.accepted_at,
    archived_at: r.archived_at,
  }))
}

export default async function ArchivedClientsPage() {
  await requirePlatformAdmin()
  const clients = await getArchivedClients()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Archived Clients</h1>
        <p className="text-sm text-zinc-500 mt-1">{clients.length} archived client{clients.length !== 1 ? 's' : ''} across all coaches</p>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        {clients.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm">No archived clients yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Coach</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Joined</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Archived</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {clients.map((c, i) => {
                  const joinedDate = c.joined_at ? new Date(c.joined_at) : null
                  const archivedDate = c.archived_at ? new Date(c.archived_at) : null
                  let duration = '—'
                  if (joinedDate && archivedDate) {
                    const days = Math.round((archivedDate.getTime() - joinedDate.getTime()) / (1000 * 60 * 60 * 24))
                    duration = days < 30 ? `${days}d` : `${Math.round(days / 30)}mo`
                  }
                  return (
                    <tr key={`${c.client_id}-${i}`} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-200">{c.client_name ?? <span className="text-zinc-500 italic">No name</span>}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{c.client_email}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{c.coach_name}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {joinedDate ? joinedDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {archivedDate ? archivedDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-zinc-600">Not recorded</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{duration}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
