import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InviteForm from './InviteForm'
import CoachActivityFeed from './CoachActivityFeed'
import ClientSummaries from './ClientSummaries'
import OrgTab from './OrgTab'
import OrgTemplatesTab from './OrgTemplatesTab'
import OrgSetupPrompt from './OrgSetupPrompt'
import OrgLeadsTab from './OrgLeadsTab'
import OrgArchivedTab from './OrgArchivedTab'
import OrgAnalyticsTab from './OrgAnalyticsTab'

export default async function CoachDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()

  // Always fetch the profile so we know tier + org status for tab rendering
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, org_id')
    .eq('id', coachId)
    .single()

  const isBusinessTier = profile?.subscription_tier === 'coach_business'
  const hasOrg = !!profile?.org_id

  // Redirect non-business coaches away from org tabs
  const BIZ_TABS = ['org', 'org-templates', 'leads', 'archived', 'analytics']
  const activeTab = (isBusinessTier && BIZ_TABS.includes(tab ?? '')) ? tab! : 'home'

  // Only run the heavy client queries when on the home tab
  let clients: { id: string; email: string; name: string | null; tier: string; joinedAt: string | null }[] = []

  let activeClients = 0
  let unreadCount = 0
  let totalCheckIns = 0

  if (activeTab === 'home') {
    const { data: clientRows } = await supabase
      .from('coach_clients')
      .select('client_id, accepted_at')
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .order('accepted_at', { ascending: false })

    const clientIds = (clientRows ?? []).map((r) => r.client_id)
    activeClients = clientIds.length

    const [{ count: unread }, { count: checkIns }, { data: profiles }] = await Promise.all([
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

    unreadCount = unread ?? 0
    totalCheckIns = checkIns ?? 0

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
    clients = (clientRows ?? []).map((r) => {
      const p = profileMap[r.client_id] as Record<string, unknown> | undefined
      return {
        id: r.client_id,
        email: (p?.email as string) ?? 'Unknown',
        name: (p?.full_name as string | null) ?? (p?.first_name as string | null) ?? null,
        tier: (p?.subscription_tier as string) ?? 'individual_free',
        joinedAt: r.accepted_at,
      }
    })
  }

  const stats = [
    { label: 'Active clients', value: activeClients, href: '/coach/clients' },
    { label: 'Unread forms', value: unreadCount, href: '/coach/forms', highlight: unreadCount > 0 },
    { label: 'Check-ins this week', value: totalCheckIns, href: '/coach/check-ins' },
  ]

  // ─── Tab bar styles ──────────────────────────────────────────────────────────
  const tabBase = 'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap'
  const tabActive = 'border-blue-500 text-blue-600'
  const tabOrgActive = 'border-purple-500 text-purple-600'
  const tabInactive = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'

  return (
    <main className="flex-1 p-6 space-y-6 max-w-5xl w-full">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Coach Dashboard</h1>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full">Coach view</span>
          </div>
          {activeTab === 'home' && (
            <p className="text-sm text-gray-500 mt-1">
              {activeClients} active client{activeClients !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <a
          href="/dashboard"
          className="ml-auto text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          ← My dashboard
        </a>
      </div>

      {/* Tab bar — only shown for business tier coaches */}
      {isBusinessTier && (
        <div className="flex gap-0 border-b border-gray-100 -mb-2 overflow-x-auto">
          <Link href="/coach/dashboard" className={`${tabBase} ${activeTab === 'home' ? tabActive : tabInactive}`}>
            Overview
          </Link>
          {[
            { tab: 'org', label: 'Organisation' },
            { tab: 'leads', label: 'Leads' },
            { tab: 'archived', label: 'Archived' },
            { tab: 'analytics', label: 'Analytics' },
            { tab: 'org-templates', label: 'Org Templates' },
          ].map(({ tab: t, label }) => (
            <Link
              key={t}
              href={`/coach/dashboard?tab=${t}`}
              className={`${tabBase} ${activeTab === t ? tabOrgActive : tabInactive} flex items-center gap-1.5 whitespace-nowrap`}
            >
              {label}
              <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-semibold leading-none">Biz</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── Organisation tab ──────────────────────────────────────────────── */}
      {activeTab === 'org' && (hasOrg ? <OrgTab /> : <OrgSetupPrompt />)}

      {/* ── Leads tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'leads' && (hasOrg ? <OrgLeadsTab /> : <OrgSetupPrompt />)}

      {/* ── Archived tab ──────────────────────────────────────────────────── */}
      {activeTab === 'archived' && (hasOrg ? <OrgArchivedTab /> : <OrgSetupPrompt />)}

      {/* ── Analytics tab ─────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (hasOrg ? <OrgAnalyticsTab /> : <OrgSetupPrompt />)}

      {/* ── Org Templates tab ─────────────────────────────────────────────── */}
      {activeTab === 'org-templates' && <OrgTemplatesTab />}

      {/* ── Home (Overview) tab ───────────────────────────────────────────── */}
      {activeTab === 'home' && (
        <>
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

          {/* Client summaries */}
          {clients.length === 0 ? (
            <div className="bg-white rounded-2xl border p-8 text-center space-y-4">
              <p className="text-gray-500 font-medium">No clients yet</p>
              <p className="text-gray-400 text-sm">Generate an invite link below and share it with your first client.</p>
            </div>
          ) : (
            <ClientSummaries coachId={coachId} clients={clients} />
          )}

          <InviteForm />
          <CoachActivityFeed />
        </>
      )}
    </main>
  )
}
