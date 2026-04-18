'use client'

import { useEffect, useState } from 'react'

type Analytics = {
  total_active: number; new_mtd: number; cancels_mtd: number
  mtd_churn_pct: number; net_growth_mtd: number
  clients_by_coach: { name: string; count: number }[]
  weekly: { label: string; total: number; new: number; churned: number; net: number; churn_pct: number }[]
}

export default function OrgAnalyticsTab() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/org/analytics').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm animate-pulse">Loading analytics…</div>
  if (!data) return <div className="py-12 text-center text-gray-400 text-sm">Failed to load analytics.</div>

  return (
    <div className="space-y-6">
      {/* MTD summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Active Clients', value: data.total_active.toString(), color: 'text-gray-900' },
          { label: 'New MTD', value: `+${data.new_mtd}`, color: 'text-green-600' },
          { label: 'Cancels MTD', value: data.cancels_mtd > 0 ? `-${data.cancels_mtd}` : '0', color: data.cancels_mtd > 0 ? 'text-red-500' : 'text-gray-900' },
          { label: 'MTD Churn %', value: `${data.mtd_churn_pct}%`, color: data.mtd_churn_pct > 4 ? 'text-red-500' : 'text-gray-900', sub: 'KPI: <4%' },
          { label: 'Net Growth MTD', value: data.net_growth_mtd >= 0 ? `+${data.net_growth_mtd}` : `${data.net_growth_mtd}`, color: data.net_growth_mtd > 0 ? 'text-green-600' : data.net_growth_mtd < 0 ? 'text-red-500' : 'text-gray-900' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <p className="text-xs text-gray-500 font-medium">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            {'sub' in card && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clients by coach */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Clients by Coach</h3>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Coach</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Clients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.clients_by_coach.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-4 text-gray-400 text-center text-xs">No data</td></tr>
                ) : (
                  <>
                    {data.clients_by_coach.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-900">{c.count}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-100">
                      <td className="px-4 py-2.5 text-xs font-bold text-gray-400">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">{data.total_active}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly trend */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Weekly Trend (Last 8 Weeks)</h3>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Week', 'Total', 'New', 'Churned', 'Net', 'Churn %'].map(h => (
                      <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${h === 'Week' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.weekly.map((w, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-2.5 text-gray-700 font-medium text-xs whitespace-nowrap">{w.label}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{w.total}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-green-600">{w.new > 0 ? `+${w.new}` : '0'}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-red-500">{w.churned > 0 ? `-${w.churned}` : '0'}</td>
                      <td className={`px-3 py-2.5 text-right font-bold ${w.net > 0 ? 'text-green-600' : w.net < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {w.net > 0 ? `+${w.net}` : w.net}
                      </td>
                      <td className={`px-3 py-2.5 text-right text-xs ${w.churn_pct > 4 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                        {w.churn_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-gray-50">
              <p className="text-xs text-gray-400">Churn % highlighted red when &gt; 4% (KPI threshold)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
