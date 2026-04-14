'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Client = {
  id: string
  email: string | null
  full_name: string | null
  subscription_tier: string
  assigned_coach_id: string
  assigned_coach_name: string | null
  join_date: string | null
  last_checkin_at: string | null
}

type Permissions = {
  can_view_all_clients: boolean
  can_reassign_clients: boolean
  can_use_org_templates: boolean
  can_message_all_clients: boolean
  can_view_org_analytics: boolean
}

type Coach = {
  id: string
  email: string | null
  full_name: string | null
  role: string
  client_count: number
  accepted_at: string | null
  permissions: Permissions
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<string, string> = {
  coached: 'Coached',
  individual_free: 'Free',
  individual_optimiser: 'Optimiser',
  individual_elite: 'Elite',
  coach_solo: 'Solo',
  coach_pro: 'Pro',
  coach_business: 'Business',
}

const TIER_COLOR: Record<string, string> = {
  coached: 'bg-blue-100 text-blue-700',
  individual_free: 'bg-gray-100 text-gray-600',
  individual_optimiser: 'bg-yellow-100 text-yellow-700',
  individual_elite: 'bg-purple-100 text-purple-700',
}

function initials(name: string | null, email: string | null): string {
  const n = name ?? email ?? '?'
  return n.split(/[\s@]/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

function relativeDate(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ clients, coaches }: { clients: Client[]; coaches: Coach[] }) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const activeThisWeek = clients.filter(
    (c) => c.last_checkin_at && new Date(c.last_checkin_at).getTime() > weekAgo
  ).length
  const rate = clients.length > 0 ? Math.round((activeThisWeek / clients.length) * 100) : 0

  const cards = [
    { label: 'Total coaches', value: coaches.length },
    { label: 'Total clients', value: clients.length },
    { label: 'Active this week', value: activeThisWeek },
    { label: 'Check-in rate (7d)', value: `${rate}%` },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-2xl font-bold text-gray-900">{c.value}</p>
          <p className="text-xs text-gray-500 mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Permissions drawer ───────────────────────────────────────────────────────

const PERMISSION_LABELS: { key: keyof Permissions; label: string; description: string }[] = [
  { key: 'can_view_all_clients', label: 'View all org clients', description: 'See clients assigned to other coaches' },
  { key: 'can_reassign_clients', label: 'Reassign clients', description: 'Move clients between coaches' },
  { key: 'can_use_org_templates', label: 'Use org templates', description: 'Access shared autoflows, programs, forms' },
  { key: 'can_message_all_clients', label: 'Message all clients', description: 'Message clients not assigned to them' },
  { key: 'can_view_org_analytics', label: 'View org analytics', description: 'See organisation-wide stats' },
]

function PermissionsDrawer({
  coach,
  onClose,
  onRemoved,
}: {
  coach: Coach
  onClose: () => void
  onRemoved: (coachId: string) => void
}) {
  const [perms, setPerms] = useState<Permissions>(coach.permissions)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/org/coaches/${coach.id}/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(perms),
    })
    setSaving(false)
    onClose()
  }

  async function remove() {
    setRemoving(true)
    const res = await fetch(`/api/org/coaches/${coach.id}`, { method: 'DELETE' })
    setRemoving(false)
    if (res.ok) {
      onRemoved(coach.id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="w-80 bg-white h-full shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex items-center justify-center">
                {initials(coach.full_name, coach.email)}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{coach.full_name ?? coach.email}</p>
                {coach.full_name && <p className="text-xs text-gray-400">{coach.email}</p>}
              </div>
            </div>
            <span className="inline-block mt-2 text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium capitalize">
              {coach.role}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Permission toggles */}
        <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Permissions</p>
          {PERMISSION_LABELS.map(({ key, label, description }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
              </div>
              <button
                role="switch"
                aria-checked={perms[key]}
                onClick={() => setPerms((p) => ({ ...p, [key]: !p[key] }))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors mt-0.5 ${
                  perms[key] ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    perms[key] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save permissions'}
          </button>

          {coach.role !== 'owner' && (
            !confirmRemove ? (
              <button
                onClick={() => setConfirmRemove(true)}
                className="w-full border border-red-200 text-red-600 rounded-xl py-2.5 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Remove from organisation
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-600 text-center">This will revoke their org access. Continue?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={remove}
                    disabled={removing}
                    className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {removing ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Reassign modal ───────────────────────────────────────────────────────────

function ReassignModal({
  client,
  coaches,
  onClose,
  onDone,
}: {
  client: Client
  coaches: Coach[]
  onClose: () => void
  onDone: () => void
}) {
  const [toCoachId, setToCoachId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eligible = coaches.filter((c) => c.id !== client.assigned_coach_id)

  async function submit() {
    if (!toCoachId) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/org/clients/${client.id}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_coach_id: toCoachId, note: note || undefined }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
      setSaving(false)
      return
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Reassign client</h3>
        <p className="text-sm text-gray-500">
          Moving <strong>{client.full_name ?? client.email}</strong> from{' '}
          <strong>{client.assigned_coach_name ?? 'current coach'}</strong>
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assign to</label>
          <select
            value={toCoachId}
            onChange={(e) => setToCoachId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
          >
            <option value="">Select a coach…</option>
            {eligible.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? c.email} ({c.client_count} clients)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for reassignment…"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!toCoachId || saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Reassigning…' : 'Reassign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invite coach modal ───────────────────────────────────────────────────────

function InviteCoachModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'coach' | 'admin'>('coach')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [atCap, setAtCap] = useState(false)
  const [capInfo, setCapInfo] = useState<{ current: number; limit: number } | null>(null)

  async function submit() {
    if (!email.trim()) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/org/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.atCap) {
        setAtCap(true)
        setCapInfo({ current: data.current, limit: data.limit })
      } else {
        setError(data.error ?? 'Something went wrong')
      }
      setSaving(false)
      return
    }
    onDone()
  }

  if (atCap) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Coach limit reached</h3>
            <p className="text-sm text-gray-500 mt-1">
              {"You've reached your"} {capInfo?.limit ?? 3} coach limit. Add more coaches for $19/month each.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">
              Cancel
            </button>
            <a
              href="/pricing"
              className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              Upgrade Plan
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Invite coach to organisation</h3>
        <p className="text-sm text-gray-500">{"We'll send them an email to create or log into their account."}</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="coach@example.com"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'coach' | 'admin')}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
          >
            <option value="coach">Coach — manages their own clients</option>
            <option value="admin">Admin — can manage all coaches and clients</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!email.trim() || saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Inviting…' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main OrgTab ──────────────────────────────────────────────────────────────

export default function OrgTab() {
  const [clients, setClients] = useState<Client[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)

  // Filters + sort
  const [search, setSearch] = useState('')
  const [filterCoach, setFilterCoach] = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [sortBy, setSortBy] = useState<'last_checkin' | 'join_date' | 'name'>('last_checkin')

  // UI state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [drawerCoach, setDrawerCoach] = useState<Coach | null>(null)
  const [reassignClient, setReassignClient] = useState<Client | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [cr, or] = await Promise.all([
      fetch('/api/org/clients'),
      fetch('/api/org/coaches'),
    ])
    if (cr.ok) setClients(await cr.json())
    if (or.ok) setCoaches(await or.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Close action menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handler = () => setOpenMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [openMenuId])

  const filtered = clients
    .filter((c) => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !(c.full_name ?? '').toLowerCase().includes(q) &&
          !(c.email ?? '').toLowerCase().includes(q) &&
          !(c.assigned_coach_name ?? '').toLowerCase().includes(q)
        ) return false
      }
      if (filterCoach && c.assigned_coach_id !== filterCoach) return false
      if (filterTier && c.subscription_tier !== filterTier) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? '')
      }
      if (sortBy === 'join_date') {
        return new Date(b.join_date ?? 0).getTime() - new Date(a.join_date ?? 0).getTime()
      }
      const aT = a.last_checkin_at ? new Date(a.last_checkin_at).getTime() : 0
      const bT = b.last_checkin_at ? new Date(b.last_checkin_at).getTime() : 0
      return bT - aT
    })

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-20" />
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 h-36" />
        <div className="bg-white rounded-2xl border border-gray-100 h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SummaryCards clients={clients} coaches={coaches} />

      {/* ── Coaches panel ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Coaches</h2>
          <button
            onClick={() => setInviteOpen(true)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            + Invite coach
          </button>
        </div>

        {coaches.length === 0 ? (
          <p className="text-sm text-gray-400">No coaches yet. Invite your team to get started.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {coaches.map((coach) => (
              <div key={coach.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-semibold text-sm flex items-center justify-center shrink-0">
                  {initials(coach.full_name, coach.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{coach.full_name ?? coach.email}</p>
                  <p className="text-xs text-gray-500">
                    {coach.client_count} client{coach.client_count !== 1 ? 's' : ''} ·{' '}
                    <span className="capitalize">{coach.role}</span>
                    {!coach.accepted_at && (
                      <span className="ml-1.5 text-[11px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Pending</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setDrawerCoach(coach)}
                  className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Manage
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Client table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100">
        {/* Filters */}
        <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            placeholder="Search by name or coach…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterCoach}
            onChange={(e) => setFilterCoach(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-white"
          >
            <option value="">All coaches</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>
            ))}
          </select>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-white"
          >
            <option value="">All tiers</option>
            <option value="coached">Coached</option>
            <option value="individual_free">Free</option>
            <option value="individual_optimiser">Optimiser</option>
            <option value="individual_elite">Elite</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-white"
          >
            <option value="last_checkin">Sort: Last check-in</option>
            <option value="join_date">Sort: Join date</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            {clients.length === 0
              ? 'No clients across your organisation yet.'
              : 'No clients match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Client', 'Coach', 'Tier', 'Last check-in', 'Joined', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center shrink-0">
                          {initials(client.full_name, client.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[140px]">
                            {client.full_name ?? client.email}
                          </p>
                          {client.full_name && (
                            <p className="text-xs text-gray-400 truncate max-w-[140px]">{client.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {client.assigned_coach_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_COLOR[client.subscription_tier] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TIER_LABEL[client.subscription_tier] ?? client.subscription_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {relativeDate(client.last_checkin_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {client.join_date ? new Date(client.join_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === client.id ? null : client.id)
                        }}
                        className="text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 text-base font-bold tracking-wider transition-colors"
                      >
                        ···
                      </button>
                      {openMenuId === client.id && (
                        <div
                          className="absolute right-4 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[160px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => { setReassignClient(client); setOpenMenuId(null) }}
                            className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Reassign to coach
                          </button>
                          <a
                            href={`/coach/clients/${client.id}`}
                            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            View profile
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
            {filtered.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Modals / drawer ───────────────────────────────────────────────── */}
      {drawerCoach && (
        <PermissionsDrawer
          coach={drawerCoach}
          onClose={() => setDrawerCoach(null)}
          onRemoved={(id) => setCoaches((prev) => prev.filter((c) => c.id !== id))}
        />
      )}

      {reassignClient && (
        <ReassignModal
          client={reassignClient}
          coaches={coaches}
          onClose={() => setReassignClient(null)}
          onDone={() => { setReassignClient(null); fetchData() }}
        />
      )}

      {inviteOpen && (
        <InviteCoachModal
          onClose={() => setInviteOpen(false)}
          onDone={() => { setInviteOpen(false); fetchData() }}
        />
      )}
    </div>
  )
}
