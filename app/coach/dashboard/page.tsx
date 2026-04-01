import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InviteForm from './InviteForm'
import CoachActivityFeed from './CoachActivityFeed'

const TIER_LABEL: Record<string, string> = { tier_1: 'Free', tier_2: 'Pro', tier_3: 'Elite' }

export default async function CoachDashboard() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()

  // Step 1: get clients
  const { data: clientRows } = await supabase
    .from('coach_clients')
    .select('client_id, accepted_at')
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .order('accepted_at', { ascending: false })

  const clientIds = (clientRows ?? []).map((r) => r.client_id)
  const activeClients = clientIds.length

  // Step 2: parallel queries that depend on clientIds
  const [{ count: unreadCount }, { count: totalCheckIns }, { data: profiles }] = await Promise.all([
    supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('viewed_by_coach', false),

    supabase
      .from('check_ins')
      .select('id', { count: 'exact', head: true })
      .in('user_id', clientIds.length ? clientIds : ['none'])
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

    supabase
      .from('profiles')
      .select('id, email, subscription_tier, full_name, first_name')
      .in('id', clientIds.length ? clientIds : ['none']),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const clients = (clientRows ?? []).map((r) => {
    const p = profileMap[r.client_id] as Record<string, unknown> | undefined
    const displayName = (p?.full_name as string | null) ?? (p?.first_name as string | null) ?? null
    return {
      id: r.client_id,
      email: (p?.email as string) ?? 'Unknown',
      name: displayName,
      tier: (p?.subscription_tier as string) ?? 'tier_1',
      joinedAt: r.accepted_at,
    }
  })

  const stats = [
    { label: 'Active clients', value: activeClients, href: '/coach/clients' },
    { label: 'Unread forms', value: unreadCount ?? 0, href: '/coach/forms', highlight: (unreadCount ?? 0) > 0 },
    { label: 'Check-ins this week', value: totalCheckIns ?? 0, href: '/coach/check-ins' },
  ]

  return (
    <main className="flex-1 p-6 space-y-8 max-w-4xl w-full">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Coach Dashboard</h1>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full">Coach view</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {activeClients} active client{activeClients !== 1 ? 's' : ''}
          </p>
        </div>
        <a
          href="/dashboard"
          className="ml-auto text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          ← My dashboard
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <a
            key={s.label}
            href={s.href}
            className={`bg-white rounded-2xl border p-5 hover:shadow-sm transition-shadow ${s.highlight ? 'border-blue-200 bg-blue-50' : ''}`}
          >
            <p className={`text-3xl font-bold ${s.highlight ? 'text-blue-600' : 'text-gray-900'}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </a>
        ))}
      </div>

      {/* Clients list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your clients</h2>
          <a href="/coach/clients" className="text-sm text-blue-600 hover:underline">View all</a>
        </div>

        {clients.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center space-y-4">
            <p className="text-gray-500 font-medium">No clients yet</p>
            <p className="text-gray-400 text-sm">Generate an invite link below and share it with your first client.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.slice(0, 5).map((client) => (
              <a
                key={client.id}
                href={`/coach/clients/${client.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-600">{(client.name ?? client.email)[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{client.name ?? client.email}</p>
                  {client.name && <p className="text-xs text-gray-400 truncate">{client.email}</p>}
                  <p className="text-xs text-gray-400">
                    {TIER_LABEL[client.tier] ?? client.tier}
                    {client.joinedAt && ` · Joined ${new Date(client.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            ))}
            {clients.length > 5 && (
              <a href="/coach/clients" className="block text-center text-sm text-blue-600 hover:underline py-2">
                View all {clients.length} clients →
              </a>
            )}
          </div>
        )}
      </section>

      {/* Invite */}
      <InviteForm />

      {/* Activity feed */}
      <CoachActivityFeed />
    </main>
  )
}
