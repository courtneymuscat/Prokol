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
    .in('status', ['active', 'archived', 'pending_invite'])
    .order('accepted_at', { ascending: false })

  const allIds = (allRows ?? []).map((r) => r.client_id)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000')

  type ClientRow = { id: string; email: string; name: string | null; tier: string; joinedAt: string | null; lastCheckIn: string | null; pendingInvite?: boolean; inviteUrl?: string; inviteToken?: string }
  type PendingInviteRow = { email: string; inviteUrl: string; sentAt: string; token: string }
  let active: ClientRow[] = []
  let archived: ClientRow[] = []
  let pendingInvites: PendingInviteRow[] = []

  const admin = (await import('@/lib/supabase/admin')).createAdminClient()

  if (allIds.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, subscription_tier, full_name, first_name')
      .in('id', allIds)

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

    // Fetch invite tokens for pending_invite clients so we can show the link
    const pendingClientIds = (allRows ?? []).filter(r => r.status === 'pending_invite').map(r => r.client_id)
    const pendingEmails = pendingClientIds.map(id => profileMap[id]?.email).filter(Boolean) as string[]
    const inviteTokenMap: Record<string, string> = {}
    if (pendingEmails.length) {
      const { data: invites } = await admin
        .from('coach_invites')
        .select('email, token')
        .eq('coach_id', coachId)
        .in('email', pendingEmails)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      for (const inv of invites ?? []) {
        if (!inviteTokenMap[inv.email]) inviteTokenMap[inv.email] = inv.token
      }
    }

    const activeIds = (allRows ?? []).filter(r => r.status !== 'pending_invite').map(r => r.client_id)
    const [{ data: latestCheckIns }, { data: latestAutoflowResps }] = await Promise.all([
      activeIds.length
        ? admin.from('check_ins').select('user_id, created_at').in('user_id', activeIds).or('sleep_hours.not.is.null,notes.not.is.null,rhr.not.is.null,hrv.not.is.null').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      activeIds.length
        ? admin.from('autoflow_responses').select('client_id, submitted_at').in('client_id', activeIds).order('submitted_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])

    const lastCheckIn: Record<string, string> = {}
    for (const c of latestCheckIns ?? []) {
      if (!lastCheckIn[c.user_id]) lastCheckIn[c.user_id] = c.created_at
    }
    for (const r of latestAutoflowResps ?? []) {
      const existing = lastCheckIn[r.client_id]
      if (!existing || r.submitted_at > existing) lastCheckIn[r.client_id] = r.submitted_at
    }

    for (const r of allRows ?? []) {
      const p = profileMap[r.client_id]
      const email = p?.email ?? 'Unknown'
      const token = inviteTokenMap[email]
      const row: ClientRow = {
        id: r.client_id,
        email,
        name: ((p as Record<string, unknown>)?.full_name as string | null) ?? ((p as Record<string, unknown>)?.first_name as string | null) ?? null,
        tier: p?.subscription_tier ?? 'individual_free',
        joinedAt: r.accepted_at,
        lastCheckIn: lastCheckIn[r.client_id] ?? null,
        pendingInvite: r.status === 'pending_invite',
        inviteUrl: token ? `${baseUrl}/invite/${token}` : undefined,
        inviteToken: token || undefined,
      }
      if (r.status === 'archived') archived.push(row)
      else active.push(row)
    }
  }

  // Also fetch pending invites for emails that don't have an account yet
  const { data: rawPendingInvites } = await admin
    .from('coach_invites')
    .select('email, token, created_at')
    .eq('coach_id', coachId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  // Only show invites for emails not already in coach_clients
  const knownEmails = new Set(active.map(c => c.email).concat(archived.map(c => c.email)))
  for (const inv of rawPendingInvites ?? []) {
    if (!knownEmails.has(inv.email)) {
      pendingInvites.push({ email: inv.email, inviteUrl: `${baseUrl}/invite/${inv.token}`, sentAt: inv.created_at, token: inv.token })
    }
  }

  return (
    <main className="flex-1 p-6 space-y-6 max-w-4xl w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">{active.filter(c => !c.pendingInvite).length} active{archived.length > 0 ? ` · ${archived.length} archived` : ''}</p>
        </div>
        <a
          href="/coach/dashboard"
          className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
        >
          + Invite client
        </a>
      </div>

      <ClientSearch
        clients={active as Parameters<typeof ClientSearch>[0]['clients']}
        archivedClients={archived as Parameters<typeof ClientSearch>[0]['clients']}
        pendingInvites={pendingInvites}
      />
    </main>
  )
}
