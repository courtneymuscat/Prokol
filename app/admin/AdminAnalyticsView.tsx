import type { OrgAnalytics } from '@/lib/org'

// Pure presentational — no hooks, no fetch. Works from a server component
// (Court's own Analytics page) or a client component (the Analytics tab on
// an org-detail page), fed whatever OrgAnalytics the caller already has.
export default function AdminAnalyticsView({ data }: { data: OrgAnalytics }) {
  const {
    total_active: totalActive,
    new_mtd: newMTD,
    cancels_mtd: cancelsMTD,
    mtd_churn_pct: mtdChurnPct,
    net_growth_mtd: netGrowthMTD,
    clients_by_coach: clientsByCoach,
    weekly,
  } = data

  return (
    <div className="space-y-8">
      {/* MTD summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Active Clients" value={totalActive.toString()} neutral />
        <MetricCard label="New MTD" value={`+${newMTD}`} positive />
        <MetricCard label="Cancels MTD" value={cancelsMTD > 0 ? `-${cancelsMTD}` : '0'} negative={cancelsMTD > 0} />
        <MetricCard
          label="MTD Churn %"
          value={`${mtdChurnPct}%`}
          negative={mtdChurnPct > 4}
          positive={mtdChurnPct === 0}
          sub="KPI: <4%"
        />
        <MetricCard
          label="Net Growth MTD"
          value={netGrowthMTD >= 0 ? `+${netGrowthMTD}` : `${netGrowthMTD}`}
          positive={netGrowthMTD > 0}
          negative={netGrowthMTD < 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Clients by coach */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Active Clients by Coach</h2>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Coach</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500">Clients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {clientsByCoach.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-4 text-zinc-500 text-center text-xs">No data</td></tr>
                ) : (
                  <>
                    {clientsByCoach.map((c, i) => (
                      <tr key={i} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-zinc-200 font-medium">{c.name}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-zinc-100">{c.count}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-zinc-700">
                      <td className="px-4 py-2.5 text-xs font-bold text-zinc-400">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-zinc-100">{totalActive}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly trend */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Weekly Trend (Last 8 Weeks)</h2>
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
                  {weekly.map((w, i) => (
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

function MetricCard({
  label, value, sub, positive, negative, neutral,
}: {
  label: string; value: string; sub?: string
  positive?: boolean; negative?: boolean; neutral?: boolean
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
