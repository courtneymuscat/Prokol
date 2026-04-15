'use client'

import { useState, useTransition } from 'react'
import { actionUpdateCoachTier, actionSuspendAccount } from '@/app/actions/admin'

type Coach = {
  id: string
  full_name: string | null
  email: string | null
  subscription_tier: string | null
  stripe_customer_id: string | null
  created_at: string | null
  org_id: string | null
  client_count: number
  org_name: string | null
}

const COACH_TIERS = ['coach_solo', 'coach_pro', 'coach_business'] as const
const TIER_LABELS: Record<string, string> = {
  coach_solo: 'Solo',
  coach_pro: 'Pro',
  coach_business: 'Business',
}
const TIER_COLORS: Record<string, string> = {
  coach_solo: 'bg-zinc-700 text-zinc-300',
  coach_pro: 'bg-blue-900 text-blue-300',
  coach_business: 'bg-purple-900 text-purple-300',
}

export default function CoachesTable({
  initialCoaches,
  total,
  page,
}: {
  initialCoaches: Coach[]
  total: number
  page: number
}) {
  const [coaches] = useState(initialCoaches)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Tier modal
  const [tierModal, setTierModal] = useState<{ coach: Coach } | null>(null)
  const [selectedTier, setSelectedTier] = useState('')
  const [tierPending, startTierTransition] = useTransition()
  const [tierResult, setTierResult] = useState<{ error?: string; success?: boolean } | null>(null)

  // Suspend modal
  const [suspendModal, setSuspendModal] = useState<{ coach: Coach } | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendPending, startSuspendTransition] = useTransition()
  const [suspendResult, setSuspendResult] = useState<{ error?: string; success?: boolean } | null>(null)

  const filtered = coaches.filter(c => {
    const matchSearch =
      !search ||
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const matchTier = !tierFilter || c.subscription_tier === tierFilter
    return matchSearch && matchTier
  })

  function handleTierSubmit() {
    if (!tierModal || !selectedTier) return
    setTierResult(null)
    startTierTransition(async () => {
      const result = await actionUpdateCoachTier(tierModal.coach.id, selectedTier)
      setTierResult(result)
      if (result.success) {
        setTimeout(() => {
          setTierModal(null)
          setTierResult(null)
          window.location.reload()
        }, 800)
      }
    })
  }

  function handleSuspendSubmit() {
    if (!suspendModal || !suspendReason.trim()) return
    setSuspendResult(null)
    startSuspendTransition(async () => {
      const result = await actionSuspendAccount(suspendModal.coach.id, suspendReason)
      setSuspendResult(result)
      if (result.success) {
        setTimeout(() => {
          setSuspendModal(null)
          setSuspendResult(null)
          window.location.reload()
        }, 800)
      }
    })
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">All tiers</option>
          {COACH_TIERS.map(t => (
            <option key={t} value={t}>{TIER_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-zinc-500 mb-3">
        Showing {filtered.length} of {total} coaches (page {page})
      </div>

      {/* Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Clients</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Org</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map(coach => (
                <tr key={coach.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-zinc-200 font-medium">
                    {coach.full_name ?? <span className="text-zinc-500 italic">No name</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{coach.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${TIER_COLORS[coach.subscription_tier ?? ''] ?? 'bg-zinc-800 text-zinc-400'}`}>
                      {TIER_LABELS[coach.subscription_tier ?? ''] ?? coach.subscription_tier ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{coach.client_count}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{coach.org_name ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {coach.created_at ? new Date(coach.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === coach.id ? null : coach.id)}
                        className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-800 transition-colors border border-zinc-700"
                      >
                        Actions ▾
                      </button>
                      {openDropdown === coach.id && (
                        <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 w-44 py-1">
                          <button
                            onClick={() => {
                              setOpenDropdown(null)
                              setSelectedTier(coach.subscription_tier ?? 'coach_solo')
                              setTierModal({ coach })
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                          >
                            Change tier
                          </button>
                          <button
                            onClick={() => {
                              setOpenDropdown(null)
                              setSuspendReason('')
                              setSuspendModal({ coach })
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
                          >
                            Suspend account
                          </button>
                          {coach.stripe_customer_id && (
                            <a
                              href={`https://dashboard.stripe.com/customers/${coach.stripe_customer_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenDropdown(null)}
                              className="block px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                            >
                              View in Stripe ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-zinc-500 text-center text-xs">
                    No coaches match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex gap-3 mt-4">
        {page > 1 && (
          <a
            href={`/admin/coaches?page=${page - 1}`}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 transition-colors"
          >
            ← Previous
          </a>
        )}
        {filtered.length === 50 && (
          <a
            href={`/admin/coaches?page=${page + 1}`}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 transition-colors"
          >
            Next →
          </a>
        )}
      </div>

      {/* Tier modal */}
      {tierModal && (
        <Modal onClose={() => setTierModal(null)}>
          <h3 className="text-base font-semibold text-zinc-100 mb-1">Change tier</h3>
          <p className="text-xs text-zinc-400 mb-4">
            {tierModal.coach.full_name ?? tierModal.coach.email}
          </p>
          <select
            value={selectedTier}
            onChange={e => setSelectedTier(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 mb-4 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            {COACH_TIERS.map(t => (
              <option key={t} value={t}>{TIER_LABELS[t]}</option>
            ))}
          </select>
          {tierResult?.error && (
            <p className="text-xs text-red-400 mb-3">{tierResult.error}</p>
          )}
          {tierResult?.success && (
            <p className="text-xs text-green-400 mb-3">Tier updated!</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setTierModal(null)}
              className="text-xs px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTierSubmit}
              disabled={tierPending}
              className="text-xs font-semibold px-4 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {tierPending ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </Modal>
      )}

      {/* Suspend modal */}
      {suspendModal && (
        <Modal onClose={() => setSuspendModal(null)}>
          <h3 className="text-base font-semibold text-red-400 mb-1">Suspend account</h3>
          <p className="text-xs text-zinc-400 mb-4">
            {suspendModal.coach.full_name ?? suspendModal.coach.email}
          </p>
          <textarea
            placeholder="Reason for suspension…"
            value={suspendReason}
            onChange={e => setSuspendReason(e.target.value)}
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 mb-4 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
          />
          {suspendResult?.error && (
            <p className="text-xs text-red-400 mb-3">{suspendResult.error}</p>
          )}
          {suspendResult?.success && (
            <p className="text-xs text-green-400 mb-3">Account suspended.</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setSuspendModal(null)}
              className="text-xs px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSuspendSubmit}
              disabled={suspendPending || !suspendReason.trim()}
              className="text-xs font-semibold px-4 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {suspendPending ? 'Suspending…' : 'Suspend'}
            </button>
          </div>
        </Modal>
      )}

      {/* Backdrop for dropdown close */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setOpenDropdown(null)}
        />
      )}
    </>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        {children}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  )
}
