'use client'

import { useState, useTransition } from 'react'
import { actionDeleteUser } from '@/app/actions/admin'
import AdminActionsMenu from '../_components/AdminActionsMenu'
import type { AdminUser } from '@/lib/admin'

// Mirrors MATRIX_TIERS in lib/feature-matrix, kept local because that module
// pulls in the service-role client and must not reach the browser bundle.
const TIER_LABELS: Record<string, string> = {
  individual_free: 'Free',
  individual_optimiser: 'Optimiser',
  individual_elite: 'Elite',
  coached: 'Coached',
  coach_pt_solo: 'Solo PT',
  coach_nutritionist_solo: 'Solo Nutr.',
  coach_solo: 'Solo (legacy)',
  coach_pro: 'Pro',
  coach_business: 'Business',
  wl_starter: 'WL Web',
  wl_pro: 'WL App',
}

const TIER_COLORS: Record<string, string> = {
  individual_free: 'bg-zinc-800 text-zinc-400',
  individual_optimiser: 'bg-indigo-900 text-indigo-300',
  individual_elite: 'bg-violet-900 text-violet-300',
  coached: 'bg-emerald-900 text-emerald-300',
  coach_pt_solo: 'bg-blue-900 text-blue-300',
  coach_nutritionist_solo: 'bg-blue-900 text-blue-300',
  coach_solo: 'bg-blue-900 text-blue-300',
  coach_pro: 'bg-blue-900 text-blue-300',
  coach_business: 'bg-teal-900 text-teal-300',
  wl_starter: 'bg-amber-900 text-amber-300',
  wl_pro: 'bg-amber-900 text-amber-300',
}

/** The plain-language answer to "what is this account?" */
function accountKind(u: AdminUser): { label: string; color: string } {
  if (u.orphaned) return { label: 'Incomplete signup', color: 'bg-red-900 text-red-300' }
  if (u.role === 'platform_admin') return { label: 'Platform admin', color: 'bg-red-900 text-red-300' }
  if (u.user_type === 'coach') return { label: 'Coach', color: 'bg-blue-900 text-blue-300' }
  if (u.user_type === 'business') return { label: 'Business owner', color: 'bg-teal-900 text-teal-300' }
  if (u.subscription_tier === 'coached') return { label: 'Coached client', color: 'bg-emerald-900 text-emerald-300' }
  return { label: 'Individual', color: 'bg-zinc-800 text-zinc-400' }
}

const KINDS = ['Coach', 'Coached client', 'Individual', 'Business owner', 'Platform admin', 'Incomplete signup']

export default function UsersTable({
  users,
  currentAdminId,
}: {
  users: AdminUser[]
  currentAdminId: string
}) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [deleteModal, setDeleteModal] = useState<AdminUser | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null)

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    const matchKind = !kindFilter || accountKind(u).label === kindFilter
    return matchSearch && matchKind
  })

  function handleDelete() {
    if (!deleteModal) return
    const id = deleteModal.id
    startTransition(async () => {
      const res = await actionDeleteUser(id)
      setResult(res)
      if (res.success) {
        setTimeout(() => window.location.reload(), 900)
      }
    })
  }

  const orphanCount = users.filter((u) => u.orphaned).length

  return (
    <>
      {orphanCount > 0 && (
        <div className="mb-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3">
          <p className="text-sm text-red-300 font-medium">
            {orphanCount} incomplete signup{orphanCount === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-red-400/80 mt-0.5">
            These have a login but no profile, usually from an abandoned signup. Their email stays
            unavailable until the account is deleted here.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">All account types</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-zinc-500 mb-3">
        Showing {filtered.length} of {users.length} users
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Account type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Coach</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Org</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Last seen</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((u) => {
                const kind = accountKind(u)
                return (
                  <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-200">
                      {u.full_name ?? <span className="italic text-zinc-600">No name</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {u.email ?? '—'}
                      {!u.email_confirmed && (
                        <span className="ml-1.5 text-amber-500" title="Email not confirmed">●</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${kind.color}`}>
                        {kind.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.subscription_tier ? (
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${TIER_COLORS[u.subscription_tier] ?? 'bg-zinc-800 text-zinc-400'}`}>
                          {TIER_LABELS[u.subscription_tier] ?? u.subscription_tier}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{u.coach_name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{u.org_name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      {u.id === currentAdminId || u.role === 'platform_admin' ? (
                        <span className="text-xs text-zinc-600">—</span>
                      ) : (
                        <AdminActionsMenu>
                          {(close) => (
                            <button
                              onClick={() => {
                                close()
                                setConfirmText('')
                                setResult(null)
                                setDeleteModal(u)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
                            >
                              Delete user…
                            </button>
                          )}
                        </AdminActionsMenu>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-zinc-100">Delete this user?</h2>
              <p className="text-sm text-zinc-400 mt-1">
                {deleteModal.full_name ?? deleteModal.email ?? deleteModal.id}
              </p>
            </div>

            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2.5">
              <p className="text-xs text-red-300 leading-relaxed">
                This permanently removes their account and everything in it — food logs, weigh-ins,
                check-ins, photos, messages, workouts and coaching records. Any active subscription is
                cancelled. This cannot be undone, and the email becomes free to sign up again.
              </p>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Type <span className="font-mono font-semibold text-zinc-200">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {result?.error && <p className="text-xs text-red-400">{result.error}</p>}
            {result?.success && <p className="text-xs text-emerald-400">Deleted. Refreshing…</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={pending}
                className="px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={pending || confirmText !== 'DELETE' || !!result?.success}
                className="px-3 py-2 text-xs font-semibold bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-red-700"
              >
                {pending ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
