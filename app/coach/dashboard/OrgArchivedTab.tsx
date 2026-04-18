'use client'

import { useEffect, useState } from 'react'

type ArchivedClient = {
  client_id: string; client_name: string | null; client_email: string
  coach_name: string; joined_at: string | null; archived_at: string | null
}

export default function OrgArchivedTab() {
  const [clients, setClients] = useState<ArchivedClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/org/archived').then(r => r.json()).then(d => {
      setClients(Array.isArray(d) ? d : [])
    }).finally(() => setLoading(false))
  }, [])

  const filtered = clients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (c.client_name ?? '').toLowerCase().includes(q) || c.client_email.toLowerCase().includes(q) || c.coach_name.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{clients.length} archived client{clients.length !== 1 ? 's' : ''}</p>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {clients.length === 0 ? 'No archived clients yet.' : 'No matches.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Client', 'Coach', 'Joined', 'Archived', 'Duration'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c, i) => {
                  const joined = c.joined_at ? new Date(c.joined_at) : null
                  const archived = c.archived_at ? new Date(c.archived_at) : null
                  let duration = '—'
                  if (joined && archived) {
                    const days = Math.round((archived.getTime() - joined.getTime()) / 86400000)
                    duration = days < 30 ? `${days}d` : `${Math.round(days / 30)}mo`
                  }
                  return (
                    <tr key={`${c.client_id}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.client_name ?? <span className="text-gray-400 italic">No name</span>}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.client_email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{c.coach_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {joined ? joined.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {archived ? archived.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-gray-300">Not recorded</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{duration}</td>
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
