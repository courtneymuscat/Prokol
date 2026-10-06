import { requirePlatformAdmin, getCoachDetail } from '@/lib/admin'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const TIER_LABELS: Record<string, string> = {
  coach_solo: 'Solo',
  coach_pro: 'Pro',
  coach_business: 'Business',
}

export default async function AdminCoachDetailPage({
  params,
}: {
  params: Promise<{ coachId: string }>
}) {
  await requirePlatformAdmin()
  const { coachId } = await params

  const detail = await getCoachDetail(coachId)
  if (!detail) notFound()

  const { coach, activeClients, archivedClients } = detail

  return (
    <div className="space-y-6">
      <div>
        <a href="/admin/coaches" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Independent coaches</a>
        <h1 className="text-2xl font-bold text-zinc-100 mt-1">{coach.full_name ?? coach.email ?? 'Coach'}</h1>
        <p className="text-sm text-zinc-500 mt-1">{coach.email}</p>
      </div>

      {/* Profile summary */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Profile</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-zinc-500 mb-1">Tier</p>
            <p className="text-zinc-200">{TIER_LABELS[coach.subscription_tier ?? ''] ?? coach.subscription_tier ?? '—'}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Organisation</p>
            <p className="text-zinc-200">{coach.org_name ?? 'None (independent)'}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Joined</p>
            <p className="text-zinc-200">{coach.created_at ? new Date(coach.created_at).toLocaleDateString() : '—'}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Active clients</p>
            <p className="text-zinc-200">{activeClients.length}</p>
          </div>
        </div>
        {coach.stripe_customer_id && (
          <a
            href={`https://dashboard.stripe.com/customers/${coach.stripe_customer_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View in Stripe ↗
          </a>
        )}
      </div>

      {/* Active clients */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Active clients ({activeClients.length})</h2>
        {activeClients.length === 0 ? (
          <p className="text-xs text-zinc-500">No active clients.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="text-left py-2 pr-4 font-medium">Client</th>
                  <th className="text-left py-2 pr-4 font-medium">Tier</th>
                  <th className="text-left py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {activeClients.map((c) => (
                  <tr key={c.client_id}>
                    <td className="py-2 pr-4">
                      <div className="text-zinc-200">{c.client_name ?? <span className="text-zinc-500 italic">No name</span>}</div>
                      <div className="text-zinc-500">{c.client_email ?? '—'}</div>
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">{c.tier ?? '—'}</td>
                    <td className="py-2 text-zinc-400">
                      {c.joined_at ? new Date(c.joined_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archived clients */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Archived clients ({archivedClients.length})</h2>
        {archivedClients.length === 0 ? (
          <p className="text-xs text-zinc-500">No archived clients.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="text-left py-2 pr-4 font-medium">Client</th>
                  <th className="text-left py-2 font-medium">Archived</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {archivedClients.map((c) => (
                  <tr key={c.client_id}>
                    <td className="py-2 pr-4">
                      <div className="text-zinc-200">{c.client_name ?? <span className="text-zinc-500 italic">No name</span>}</div>
                      <div className="text-zinc-500">{c.client_email ?? '—'}</div>
                    </td>
                    <td className="py-2 text-zinc-400">
                      {c.archived_at ? new Date(c.archived_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
