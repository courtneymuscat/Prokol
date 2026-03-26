'use client'

import { useState } from 'react'

type Client = {
  id: string
  email: string
  tier: string
  joinedAt: string | null
  lastCheckIn: string | null
}

const TIER_LABELS: Record<string, string> = { tier_1: 'Free', tier_2: 'Pro', tier_3: 'Elite', coached: 'Coached' }
const TIER_COLORS: Record<string, string> = {
  tier_1: 'bg-gray-100 text-gray-500',
  tier_2: 'bg-blue-100 text-blue-600',
  tier_3: 'bg-purple-100 text-purple-600',
  coached: 'bg-green-100 text-green-600',
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

export default function ClientSearch({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState('')

  const filtered = clients.filter((c) =>
    c.email.toLowerCase().includes(query.toLowerCase())
  )

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
            {query ? `No clients matching "${query}"` : 'No clients yet'}
          </p>
        </div>
      )}

      {filtered.map((client) => (
        <a
          key={client.id}
          href={`/coach/clients/${client.id}`}
          className="flex items-center gap-4 bg-white rounded-2xl border p-4 hover:bg-gray-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-blue-600">{client.email[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 truncate">{client.email}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[client.tier] ?? 'bg-gray-100 text-gray-500'}`}>
                {TIER_LABELS[client.tier] ?? client.tier}
              </span>
              {isLapsed(client.lastCheckIn) && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">No recent check-in</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Last check-in: {timeAgo(client.lastCheckIn)}
              {client.joinedAt && ` · Joined ${new Date(client.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
            </p>
          </div>
          <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      ))}
    </div>
  )
}
