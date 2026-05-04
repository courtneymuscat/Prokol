import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InviteForm from './InviteForm'
import CoachActivityFeed from './CoachActivityFeed'
import ClientSummaries from './ClientSummaries'
import LapsedClients from './LapsedClients'
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, org_id')
    .eq('id', coachId)
    .single()

  const isBusinessTier = profile?.subscription_tier === 'coach_business'
  const hasOrg = !!profile?.org_id

  const BIZ_TABS = ['org', 'org-templates', 'leads', 'archived', 'analytics']
  const activeTab = (isBusinessTier && BIZ_TABS.includes(tab ?? '')) ? tab! : 'home'

  let clients: { id: string; email: string; name: string | null; tier: string; joinedAt: string | null }[] = []
  let activeClients = 0

  if (activeTab === 'home') {
    const { data: clientRows } = await supabase
      .from('coach_clients')
      .select('client_id, accepted_at')
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .order('accepted_at', { ascending: false })

    const clientIds = (clientRows ?? []).map((r) => r.client_id)
    activeClients = clientIds.length

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, subscription_tier, full_name, first_name')
      .in('id', clientIds.length ? clientIds : ['none'])

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

  const tabBase = 'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap'
  const tabActive = 'border-blue-500 text-blue-600'
  const tabOrgActive = 'border-teal-500 text-teal-600'
  const tabInactive = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'

  return (
    <main className="flex-1 p-6 space-y-5 w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          {activeTab === 'home' && activeClients > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2.5 py-1 rounded-full">
              {activeClients} active
            </span>
          )}
        </div>
        <a
          href="/dashboard"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          My app
        </a>
      </div>

      {/* Org tab bar — business tier only */}
      {isBusinessTier && (
        <div className="flex gap-0 border-b border-gray-100 overflow-x-auto -mb-1">
          <Link href="/coach/dashboard" className={`${tabBase} ${activeTab === 'home' ? tabActive : tabInactive}`}>
            Overview
          </Link>
          {[
            { tab: 'org', label: 'Organisation' },
            { tab: 'leads', label: 'Leads' },
            { tab: 'archived', label: 'Archived' },
            { tab: 'analytics', label: 'Analytics' },
            { tab: 'org-templates', label: 'Templates' },
          ].map(({ tab: t, label }) => (
            <Link
              key={t}
              href={`/coach/dashboard?tab=${t}`}
              className={`${tabBase} ${activeTab === t ? tabOrgActive : tabInactive} flex items-center gap-1.5`}
            >
              {label}
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold leading-none" style={{ backgroundColor: 'rgba(29,158,117,0.08)', color: '#1D9E75' }}>Biz</span>
            </Link>
          ))}
        </div>
      )}

      {/* Org tabs */}
      {activeTab === 'org'           && (hasOrg ? <OrgTab /> : <OrgSetupPrompt />)}
      {activeTab === 'leads'         && (hasOrg ? <OrgLeadsTab /> : <OrgSetupPrompt />)}
      {activeTab === 'archived'      && (hasOrg ? <OrgArchivedTab /> : <OrgSetupPrompt />)}
      {activeTab === 'analytics'     && (hasOrg ? <OrgAnalyticsTab /> : <OrgSetupPrompt />)}
      {activeTab === 'org-templates' && <OrgTemplatesTab />}

      {/* Home */}
      {activeTab === 'home' && (
        <>
          {/* Row 1 — [stat | invite] */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            {/* Active clients — number stat */}
            <Link
              href="/coach/clients"
              className="bg-white rounded-2xl border p-5 flex flex-col items-center justify-center text-center gap-1 hover:shadow-sm transition-shadow min-h-[140px] group"
            >
              <p className="text-5xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {activeClients}
              </p>
              <p className="text-sm text-gray-400 mt-1">Active clients</p>
              <p className="text-xs text-blue-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                View all →
              </p>
            </Link>

            {/* Invite form — fills remaining 3 cols */}
            <div className="lg:col-span-3">
              <InviteForm />
            </div>
          </div>

          {/* Row 2 — No check-in (full width, horizontal) */}
          <LapsedClients />

          {/* Client summaries */}
          {clients.length > 0 && (
            <ClientSummaries coachId={coachId} clients={clients} />
          )}

          {/* Activity feed */}
          <CoachActivityFeed />
        </>
      )}
    </main>
  )
}
