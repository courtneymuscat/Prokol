'use client'

import { useState, useTransition } from 'react'
import type { WhiteLabelApp } from './page'

export default function WhiteLabelAppsTable({
  apps,
  readonly = false,
}: {
  apps: WhiteLabelApp[]
  readonly?: boolean
}) {
  const [list, setList] = useState(apps)
  const [rejectModal, setRejectModal] = useState<WhiteLabelApp | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [actionResult, setActionResult] = useState<{ error?: string; success?: boolean } | null>(null)

  function handleApprove(app: WhiteLabelApp) {
    setActionResult(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/white-label/${app.id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setList(prev => prev.filter(a => a.id !== app.id))
      } else {
        setActionResult({ error: data.error ?? 'Failed to approve' })
      }
    })
  }

  function openReject(app: WhiteLabelApp) {
    setRejectReason('')
    setActionResult(null)
    setRejectModal(app)
  }

  function handleRejectSubmit() {
    if (!rejectModal || !rejectReason.trim()) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/white-label/${rejectModal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      const data = await res.json()
      if (data.success) {
        setList(prev => prev.filter(a => a.id !== rejectModal.id))
        setRejectModal(null)
      } else {
        setActionResult({ error: data.error ?? 'Failed to reject' })
      }
    })
  }

  if (list.length === 0) {
    return <p className="text-zinc-500 text-sm">No applications in this group.</p>
  }

  return (
    <>
      {actionResult?.error && (
        <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
          {actionResult.error}
        </div>
      )}

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Org</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">App name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Domain</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Brand</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Submitted</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Status</th>
                {!readonly && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {list.map(app => (
                <tr key={app.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-zinc-200 font-medium">{app.org_name}</p>
                    <p className="text-zinc-500 text-xs">{app.owner_name ?? app.owner_email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {app.logo_url && (
                        <img src={app.logo_url} alt="" className="h-5 w-auto object-contain rounded" />
                      )}
                      <span className="text-zinc-200">{app.app_name}</span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">{app.support_email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{app.custom_domain}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-4 h-4 rounded-full border border-zinc-700 inline-block flex-shrink-0"
                        style={{ backgroundColor: app.brand_colour }}
                        title={app.brand_colour}
                      />
                      {app.brand_colour_secondary && (
                        <span
                          className="w-4 h-4 rounded-full border border-zinc-700 inline-block flex-shrink-0"
                          style={{ backgroundColor: app.brand_colour_secondary }}
                          title={app.brand_colour_secondary}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                    {app.rejection_reason && (
                      <p className="text-xs text-zinc-500 mt-1 max-w-[160px] truncate" title={app.rejection_reason}>
                        {app.rejection_reason}
                      </p>
                    )}
                  </td>
                  {!readonly && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(app)}
                          disabled={pending}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-800 text-green-200 hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openReject(app)}
                          disabled={pending}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-800/60 disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-red-400 mb-1">Reject application</h3>
            <p className="text-xs text-zinc-400 mb-4">
              {rejectModal.app_name} — {rejectModal.custom_domain}
            </p>
            <textarea
              placeholder="Reason for rejection (sent to org owner)…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 mb-4 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />
            {actionResult?.error && (
              <p className="text-xs text-red-400 mb-3">{actionResult.error}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectModal(null)}
                className="text-xs px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={pending || !rejectReason.trim()}
                className="text-xs font-semibold px-4 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {pending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setRejectModal(null)} />
        </div>
      )}
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-900/40 text-amber-300 border-amber-800',
    approved: 'bg-green-900/40 text-green-300 border-green-800',
    rejected: 'bg-red-900/40 text-red-300 border-red-800',
  }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${styles[status] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
      {status}
    </span>
  )
}
