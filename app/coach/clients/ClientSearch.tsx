'use client'

import { useState } from 'react'
import Link from 'next/link'

type Client = {
  id: string
  email: string
  name: string | null
  tier: string
  joinedAt: string | null
  lastCheckIn: string | null
}

const TIER_LABELS: Record<string, string> = {
  individual_free:      'Free',
  individual_optimiser: 'Optimiser',
  individual_elite:     'Elite',
  coached:              'Coached',
  coach_solo:           'Solo',
  coach_pro:            'Pro',
  coach_business:       'Business',
}
const TIER_COLORS: Record<string, string> = {
  individual_free:      'bg-gray-100 text-gray-500',
  individual_optimiser: 'bg-blue-100 text-blue-600',
  individual_elite:     'bg-purple-100 text-purple-600',
  coached:              'bg-green-100 text-green-600',
  coach_solo:           'bg-gray-100 text-gray-500',
  coach_pro:            'bg-blue-100 text-blue-600',
  coach_business:       'bg-indigo-100 text-indigo-600',
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function isLapsed(iso: string | null) {
  if (!iso) return true
  return Date.now() - new Date(iso).getTime() > 7 * 86400000
}

function ClientCard({ client, muted = false }: { client: Client; muted?: boolean }) {
  return (
    <Link
      href={`/coach/clients/${client.id}`}
      className={`flex items-center gap-4 bg-white rounded-2xl border p-4 hover:bg-gray-50 transition-colors group ${muted ? 'opacity-60' : ''}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${muted ? 'bg-gray-100' : 'bg-blue-100'}`}>
        <span className={`text-sm font-bold ${muted ? 'text-gray-400' : 'text-blue-600'}`}>
          {(client.name ?? client.email)[0].toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{client.name ?? client.email}</p>
          {client.name && <p className="text-xs text-gray-400 truncate">{client.email}</p>}
          {!muted && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[client.tier] ?? 'bg-gray-100 text-gray-500'}`}>
              {TIER_LABELS[client.tier] ?? client.tier}
            </span>
          )}
          {!muted && isLapsed(client.lastCheckIn) && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">No recent check-in</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {muted
            ? `Archived · Joined ${client.joinedAt ? new Date(client.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}`
            : `Last check-in: ${timeAgo(client.lastCheckIn)}${client.joinedAt ? ` · Joined ${new Date(client.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}`
          }
        </p>
      </div>
      <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

export default function ClientSearch({ clients, archivedClients = [] }: { clients: Client[]; archivedClients?: Client[] }) {
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(true)

  const matches = (c: Client) => {
    const q = query.toLowerCase()
    return c.email.toLowerCase().includes(q) || (c.name ?? '').toLowerCase().includes(q)
  }
  const filtered = clients.filter(matches)
  const filteredArchived = archivedClients.filter(matches)

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border p-10 text-center">
          <p className="text-gray-500 text-sm font-medium">
            {query ? `No clients matching "${query}"` : 'No active clients yet'}
          </p>
        </div>
      )}

      {filtered.map((client) => <ClientCard key={client.id} client={client} />)}

      {filteredArchived.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors mb-3"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showArchived ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showArchived ? 'Hide' : 'Show'} archived ({filteredArchived.length})
          </button>
          {showArchived && (
            <div className="space-y-3">
              {filteredArchived.map((client) => <ClientCard key={client.id} client={client} muted />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
