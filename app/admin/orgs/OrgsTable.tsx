'use client'

import { useState, useTransition } from 'react'
import { actionSuspendAccount } from '@/app/actions/admin'

type Org = {
  id: string
  name: string
  slug: string
  subscription_tier: string
  created_at: string | null
  is_active: boolean
  owner_id: string
  owner_name: string | null
  owner_email: string | null
  coach_count: number
  client_count: number
}

export default function OrgsTable({
  initialOrgs,
  total,
  page,
}: {
  initialOrgs: Org[]
  total: number
  page: number
}) {
  const [orgs] = useState(initialOrgs)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const [suspendModal, setSuspendModal] = useState<{ org: Org } | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendPending, startSuspendTransition] = useTransition()
  const [suspendResult, setSuspendResult] = useState<{ error?: string; success?: boolean } | null>(null)

  function handleSuspendSubmit() {
    if (!suspendModal || !suspendReason.trim()) return
    setSuspendResult(null)
    startSuspendTransition(async () => {
      const result = await actionSuspendAccount(suspendModal.org.owner_id, suspendReason)
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
      <div className="text-xs text-zinc-500 mb-3">{total} total organisations</div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Org name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Coaches</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Clients</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Created</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {orgs.map(org => (
                <tr key={org.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-zinc-200 font-medium">{org.name}</td>
                  <td className="px-4 py-3">
                    <div className="text-zinc-300 text-xs">{org.owner_name ?? '—'}</div>
                    <div className="text-zinc-500 text-xs">{org.owner_email ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{org.coach_count}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{org.client_count}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                      {org.subscription_tier.replace('org_', '')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${org.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === org.id ? null : org.id)}
                        className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-800 transition-colors border border-zinc-700"
                      >
                        Actions ▾
                      </button>
                      {openDropdown === org.id && (
                        <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 w-40 py-1">
                          <button
                            onClick={() => {
                              setOpenDropdown(null)
                              setSuspendReason('')
                              setSuspendModal({ org })
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
                          >
                            Suspend org owner
                          </button>
                          <a
                            href={`/admin/coaches?search=${encodeURIComponent(org.owner_email ?? '')}`}
                            onClick={() => setOpenDropdown(null)}
                            className="block px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                          >
                            View owner →
                          </a>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-zinc-500 text-center text-xs">
                    No organisations yet
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
            href={`/admin/orgs?page=${page - 1}`}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 transition-colors"
          >
            ← Previous
          </a>
        )}
        {orgs.length === 50 && (
          <a
            href={`/admin/orgs?page=${page + 1}`}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 transition-colors"
          >
            Next →
          </a>
        )}
      </div>

      {/* Suspend modal */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-red-400 mb-1">Suspend org owner</h3>
            <p className="text-xs text-zinc-400 mb-1">{suspendModal.org.name}</p>
            <p className="text-xs text-zinc-500 mb-4">
              Owner: {suspendModal.org.owner_name ?? suspendModal.org.owner_email ?? '—'}
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
              <p className="text-xs text-green-400 mb-3">Owner suspended.</p>
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
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setSuspendModal(null)} />
        </div>
      )}

      {/* Backdrop */}
      {openDropdown && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenDropdown(null)} />
      )}
    </>
  )
}
