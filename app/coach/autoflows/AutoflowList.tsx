'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Template = {
  id: string
  name: string
  description: string | null
  type: string
  total_steps: number
}

type Client = { id: string; email: string; full_name: string | null }

const TYPE_LABELS: Record<string, string> = {
  weekly_checkin: 'Weekly check-in',
  onboarding: 'Staged flow',
}

export default function AutoflowList({ templates }: { templates: Template[] }) {
  const router = useRouter()
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; template: Template | null }>({ open: false, template: null })
  const [clients, setClients] = useState<Client[] | null>(null)
  const [clientId, setClientId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [showAsCheckin, setShowAsCheckin] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignDone, setAssignDone] = useState(false)

  async function openAssign(e: React.MouseEvent, template: Template) {
    e.preventDefault()
    e.stopPropagation()
    setModal({ open: true, template })
    setClientId('')
    setAssignError(null)
    setAssignDone(false)
    setShowAsCheckin(template.type === 'weekly_checkin')
    if (!clients) {
      const res = await fetch('/api/coach/clients')
      if (res.ok) setClients(await res.json())
    }
  }

  function closeModal() {
    setModal({ open: false, template: null })
    setAssignDone(false)
    setAssignError(null)
  }

  async function handleAssign() {
    if (!clientId || !modal.template) return
    setAssigning(true)
    setAssignError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/autoflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: modal.template.id, start_date: startDate, show_as_checkin_prompt: showAsCheckin }),
    })
    setAssigning(false)
    if (res.ok) {
      setAssignDone(true)
    } else {
      const d = await res.json()
      setAssignError(d.error ?? 'Failed to assign')
    }
  }

  async function duplicate(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    setDuplicating(id)
    const res = await fetch(`/api/coach/autoflows/${id}/duplicate`, { method: 'POST' })
    const d = await res.json()
    setDuplicating(null)
    if (d.id) router.push(`/coach/autoflows/${d.id}`)
  }

  return (
    <>
      <div className="space-y-2">
        {templates.map(t => (
          <a
            key={t.id}
            href={`/coach/autoflows/${t.id}`}
            className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between hover:border-gray-400 transition-colors group"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">{t.name}</p>
              {t.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {TYPE_LABELS[t.type] ?? t.type}
                </span>
                <span className="text-[11px] text-gray-400">{t.total_steps} steps</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => openAssign(e, t)}
                className="opacity-0 group-hover:opacity-100 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all"
              >
                Assign to client
              </button>
              <button
                onClick={e => duplicate(e, t.id)}
                disabled={duplicating === t.id}
                title="Duplicate"
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
              >
                {duplicating === t.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        ))}
      </div>

      {modal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-900">Assign to client</h2>
            <p className="text-sm text-gray-500 -mt-2">{modal.template?.name}</p>

            {assignDone ? (
              <div className="space-y-4">
                <p className="text-sm text-green-600 font-medium">Assigned successfully!</p>
                <button onClick={closeModal} className="w-full bg-gray-100 text-gray-700 font-semibold py-2 rounded-xl text-sm hover:bg-gray-200 transition-colors">
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</label>
                  {!clients ? (
                    <p className="text-sm text-gray-400">Loading clients…</p>
                  ) : clients.length === 0 ? (
                    <p className="text-sm text-gray-400">No active clients found.</p>
                  ) : (
                    <select
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a client…</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Assign as check-in</p>
                    <p className="text-xs text-gray-400">Shows as a check-in prompt on client dashboard</p>
                  </div>
                  <div
                    onClick={() => setShowAsCheckin(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${showAsCheckin ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showAsCheckin ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </label>

                {assignError && <p className="text-xs text-red-500">{assignError}</p>}

                <div className="flex gap-2 pt-1">
                  <button onClick={closeModal} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2 rounded-xl text-sm hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!clientId || assigning}
                    className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {assigning ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
