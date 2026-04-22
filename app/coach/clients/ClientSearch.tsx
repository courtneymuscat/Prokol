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
  pendingInvite?: boolean
  inviteUrl?: string
}

type PendingInvite = {
  email: string
  inviteUrl: string
  sentAt: string
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

function CopyInviteButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  function copy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium hover:bg-amber-100 transition-colors flex-shrink-0"
      title="Copy invite link"
    >
      {copied ? 'Copied!' : 'Copy invite link'}
    </button>
  )
}

function ClientCard({ client, muted = false }: { client: Client; muted?: boolean }) {
  return (
    <Link
      href={`/coach/clients/${client.id}`}
      className={`flex items-center gap-4 bg-white rounded-2xl border p-4 hover:bg-gray-50 transition-colors group ${muted ? 'opacity-60' : ''}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${muted ? 'bg-gray-100' : client.pendingInvite ? 'bg-amber-50' : 'bg-blue-100'}`}>
        <span className={`text-sm font-bold ${muted ? 'text-gray-400' : client.pendingInvite ? 'text-amber-500' : 'text-blue-600'}`}>
          {(client.name ?? client.email)[0].toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{client.name ?? client.email}</p>
          {client.name && <p className="text-xs text-gray-400 truncate">{client.email}</p>}
          {client.pendingInvite && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Invite pending</span>
          )}
          {!muted && !client.pendingInvite && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[client.tier] ?? 'bg-gray-100 text-gray-500'}`}>
              {TIER_LABELS[client.tier] ?? client.tier}
            </span>
          )}
          {!muted && !client.pendingInvite && isLapsed(client.lastCheckIn) && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">No recent check-in</span>
          )}
          {client.pendingInvite && client.inviteUrl && <CopyInviteButton url={client.inviteUrl} />}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {muted
            ? `Archived · Joined ${client.joinedAt ? new Date(client.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}`
            : client.pendingInvite
            ? 'Invite sent — not yet accepted'
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

export default function ClientSearch({ clients, archivedClients = [], pendingInvites = [] }: { clients: Client[]; archivedClients?: Client[]; pendingInvites?: PendingInvite[] }) {
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(true)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  const matches = (c: Client) => {
    const q = query.toLowerCase()
    return c.email.toLowerCase().includes(q) || (c.name ?? '').toLowerCase().includes(q)
  }
  const filtered = clients.filter(matches)
  const filteredArchived = archivedClients.filter(matches)
  const filteredPending = pendingInvites.filter(p => p.email.toLowerCase().includes(query.toLowerCase()))

  function copyPendingLink(email: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedEmail(email)
      setTimeout(() => setCopiedEmail(null), 2000)
    })
  }

  const activeClients = filtered.filter(c => !c.pendingInvite)
  const pendingClients = filtered.filter(c => c.pendingInvite)

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

      {activeClients.length === 0 && pendingClients.length === 0 && filteredPending.length === 0 && (
        <div className="bg-white rounded-2xl border p-10 text-center">
          <p className="text-gray-500 text-sm font-medium">
            {query ? `No clients matching "${query}"` : 'No active clients yet'}
          </p>
        </div>
      )}

      {activeClients.map((client) => <ClientCard key={client.id} client={client} />)}

      {/* Pending invite clients (have accounts, haven't accepted) */}
      {pendingClients.map((client) => <ClientCard key={client.id} client={client} />)}

      {/* Pending invites for emails without accounts yet */}
      {filteredPending.map((inv) => (
        <div key={inv.email} className="flex items-center gap-4 bg-white rounded-2xl border border-dashed p-4 opacity-70">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-gray-400">{inv.email[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-700 truncate">{inv.email}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Not yet signed up</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Invite sent {new Date(inv.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => copyPendingLink(inv.email, inv.inviteUrl)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            {copiedEmail === inv.email ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
      ))}

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
