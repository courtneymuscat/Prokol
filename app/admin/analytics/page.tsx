import { requirePlatformAdmin, computePlatformAnalytics } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  await requirePlatformAdmin()

  const a = await computePlatformAnalytics()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">The Prokol umbrella — every organisation, gym, coach, and client</p>
      </div>

      {/* Platform snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Active Organisations" value={a.active_orgs.toString()} />
        <MetricCard label="Active Gyms" value={a.active_gyms.toString()} />
        <MetricCard label="Active Coaches" value={a.active_coaches.toString()} />
        <MetricCard label="Active Clients" value={a.clients.total_active.toString()} />
        <MetricCard label="White-label Orgs" value={a.active_white_label_orgs.toString()} />
      </div>

      {/* Client growth this month */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Client Growth (Month to Date)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="New MTD" value={`+${a.clients.new_mtd}`} positive />
          <MetricCard label="Cancels MTD" value={a.clients.cancels_mtd > 0 ? `-${a.clients.cancels_mtd}` : '0'} negative={a.clients.cancels_mtd > 0} />
          <MetricCard
            label="MTD Churn %"
            value={`${a.clients.mtd_churn_pct}%`}
            negative={a.clients.mtd_churn_pct > 4}
            positive={a.clients.mtd_churn_pct === 0}
            sub="KPI: <4%"
          />
          <MetricCard
            label="Net Growth MTD"
            value={a.clients.net_growth_mtd >= 0 ? `+${a.clients.net_growth_mtd}` : `${a.clients.net_growth_mtd}`}
            positive={a.clients.net_growth_mtd > 0}
            negative={a.clients.net_growth_mtd < 0}
          />
        </div>
      </div>

      {/* Org / gym growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">New Organisations (Last 8 Weeks)</h2>
          <WeeklyNewTable rows={a.orgs_weekly} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">New Gyms (Last 8 Weeks)</h2>
          <WeeklyNewTable rows={a.gyms_weekly} />
        </div>
      </div>
      <p className="text-xs text-zinc-600 -mt-4">
        Organisation/gym counts are new signups per week — there&apos;s no deactivation timestamp on organisations, so a churn figure isn&apos;t computable yet.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active clients by org */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Active Clients by Organisation</h2>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Organisation</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500">Clients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {a.clients_by_org.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-4 text-zinc-500 text-center text-xs">No data</td></tr>
                ) : (
                  <>
                    {a.clients_by_org.map((c, i) => (
                      <tr key={i} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-zinc-200 font-medium">{c.name}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-zinc-100">{c.count}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-zinc-700">
                      <td className="px-4 py-2.5 text-xs font-bold text-zinc-400">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-zinc-100">{a.clients.total_active}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly client trend */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Client Trend (Last 8 Weeks)</h2>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 whitespace-nowrap">Week of</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-zinc-500">Total</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-zinc-500">New</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-zinc-500">Churned</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-zinc-500">Net</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-zinc-500">Churn %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {a.clients.weekly.map((w, i) => (
                    <tr key={i} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-300 text-xs font-medium whitespace-nowrap">{w.label}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-200">{w.total}</td>
                      <td className="px-3 py-2.5 text-right text-green-400 font-medium">{w.new > 0 ? `+${w.new}` : '0'}</td>
                      <td className="px-3 py-2.5 text-right text-red-400 font-medium">{w.churned > 0 ? `-${w.churned}` : '0'}</td>
                      <td className={`px-3 py-2.5 text-right font-bold ${w.net > 0 ? 'text-green-400' : w.net < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                        {w.net > 0 ? `+${w.net}` : w.net}
                      </td>
                      <td className={`px-3 py-2.5 text-right text-xs ${w.churn_pct > 4 ? 'text-red-400 font-bold' : 'text-zinc-400'}`}>
                        {w.churn_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-zinc-800">
              <p className="text-xs text-zinc-600">Churn % highlighted red when &gt; 4% (KPI threshold)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WeeklyNewTable({ rows }: { rows: { label: string; new: number }[] }) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Week of</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500">New</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {rows.map((w, i) => (
            <tr key={i} className="hover:bg-zinc-800/40 transition-colors">
              <td className="px-4 py-2.5 text-zinc-300 text-xs font-medium whitespace-nowrap">{w.label}</td>
              <td className="px-4 py-2.5 text-right font-medium text-green-400">{w.new > 0 ? `+${w.new}` : '0'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MetricCard({
  label, value, sub, positive, negative,
}: {
  label: string; value: string; sub?: string
  positive?: boolean; negative?: boolean
}) {
  const valueColor = positive ? 'text-green-400' : negative ? 'text-red-400' : 'text-zinc-100'
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 px-5 py-4">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  )
}
