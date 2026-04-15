import { requirePlatformAdmin, getPlatformStats, getAllCoaches, getAllOrgs } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  await requirePlatformAdmin()

  const [stats, { coaches }, { orgs }] = await Promise.all([
    getPlatformStats(),
    getAllCoaches(1, 10),
    getAllOrgs(1, 5),
  ])

  const tierLabel = (tier: string) => {
    if (tier === 'coach_solo') return 'Solo'
    if (tier === 'coach_pro') return 'Pro'
    if (tier === 'coach_business') return 'Business'
    return tier
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Platform Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">Prokol platform metrics</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Coaches"
          value={stats.total_coaches}
          sub={
            <span className="text-xs text-zinc-500 mt-1 block">
              Solo: {stats.coaches_by_tier['coach_solo'] ?? 0} &middot;{' '}
              Pro: {stats.coaches_by_tier['coach_pro'] ?? 0} &middot;{' '}
              Business: {stats.coaches_by_tier['coach_business'] ?? 0}
            </span>
          }
        />
        <MetricCard
          label="Individual Users"
          value={stats.total_individuals}
        />
        <MetricCard
          label="Organisations"
          value={stats.total_orgs}
        />
        <MetricCard
          label="New This Week"
          value={stats.new_signups_7d}
          sub={<span className="text-xs text-zinc-500 mt-1 block">{stats.new_signups_30d} in last 30 days</span>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent coaches */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Recent Coach Signups
          </h2>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Tier</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {coaches.map(coach => (
                  <tr key={coach.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-200 font-medium">
                      {coach.full_name ?? <span className="text-zinc-500 italic">No name</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <TierBadge tier={coach.subscription_tier ?? ''} />
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs">
                      {coach.created_at ? new Date(coach.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
                {coaches.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-4 text-zinc-500 text-center text-xs">No coaches yet</td></tr>
                )}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-zinc-800">
              <a href="/admin/coaches" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                View all coaches →
              </a>
            </div>
          </div>
        </div>

        {/* Recent orgs */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Recent Organisations
          </h2>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Org</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Owner</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {orgs.map(org => (
                  <tr key={org.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-200 font-medium">{org.name}</td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs">
                      {org.owner_name ?? org.owner_email ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs">
                      {org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-4 text-zinc-500 text-center text-xs">No organisations yet</td></tr>
                )}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-zinc-800">
              <a href="/admin/orgs" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                View all organisations →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string
  value: number
  sub?: React.ReactNode
}) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 px-5 py-4">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-zinc-100 mt-1">{value.toLocaleString()}</p>
      {sub}
    </div>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    coach_solo: 'bg-zinc-700 text-zinc-300',
    coach_pro: 'bg-blue-900 text-blue-300',
    coach_business: 'bg-purple-900 text-purple-300',
    platform_admin: 'bg-red-900 text-red-300',
  }
  const label: Record<string, string> = {
    coach_solo: 'Solo',
    coach_pro: 'Pro',
    coach_business: 'Business',
    platform_admin: 'Admin',
  }
  const cls = colors[tier] ?? 'bg-zinc-800 text-zinc-400'
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {label[tier] ?? tier}
    </span>
  )
}
