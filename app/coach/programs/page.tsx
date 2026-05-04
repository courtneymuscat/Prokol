'use client'

import { useState, useEffect } from 'react'

type ProgramSummary = {
  id: string
  name: string
  description: string | null
  week_count: number
  created_at: string
  updated_at: string
}

type Client = { id: string; email: string; full_name: string | null }

function AssignProgramModal({
  program,
  onClose,
}: {
  program: ProgramSummary
  onClose: () => void
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [clientId, setClientId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [assigning, setAssigning] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/clients')
      .then(r => r.json())
      .then(d => {
        setClients(Array.isArray(d) ? d : [])
        if (Array.isArray(d) && d.length > 0) setClientId(d[0].id)
      })
      .finally(() => setLoadingClients(false))
  }, [])

  async function assign() {
    if (!clientId) return
    setAssigning(true)
    setError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/programs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_id: program.id, start_date: startDate }),
    })
    if (res.ok) {
      setSuccess(true)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to assign')
    }
    setAssigning(false)
  }

  const clientLabel = (c: Client) => c.full_name ? `${c.full_name} (${c.email})` : c.email

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Assign to Client</h2>
            <p className="text-xs text-gray-400 mt-0.5">{program.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">Program assigned!</p>
            <p className="text-xs text-gray-400">The client will see it in their training calendar.</p>
            <button onClick={onClose} className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Client</label>
              {loadingClients ? (
                <p className="text-sm text-gray-400">Loading clients…</p>
              ) : clients.length === 0 ? (
                <p className="text-sm text-gray-400">No active clients found.</p>
              ) : (
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={assign} disabled={assigning || !clientId || loadingClients}
                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [assigningProgram, setAssigningProgram] = useState<ProgramSummary | null>(null)

  useEffect(() => {
    fetch('/api/coach/programs')
      .then((r) => r.json())
      .then((d) => setPrograms(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    const res = await fetch('/api/coach/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create program')
      setCreating(false)
      return
    }
    // Navigate to the builder
    window.location.href = `/coach/programs/${data.id}`
  }

  async function handleDelete(id: string) {
    setDeleteId(id)
    const res = await fetch(`/api/coach/programs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPrograms((prev) => prev.filter((p) => p.id !== id))
    }
    setDeleteId(null)
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Programs</h1>
        <button
          onClick={() => { setShowModal(true); setName(''); setDescription(''); setError(null) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + New Program
        </button>
      </div>

      <main className="w-full p-6">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-16">Loading programs…</p>
        )}

        {!loading && programs.length === 0 && (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">No programs yet</p>
            <p className="text-xs text-gray-400 mb-5">Create your first program template and assign it to clients.</p>
            <button
              onClick={() => { setShowModal(true); setName(''); setDescription(''); setError(null) }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              + New Program
            </button>
          </div>
        )}

        {!loading && programs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border p-5 flex flex-col hover:shadow-sm transition-shadow group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <a
                    href={`/coach/programs/${p.id}`}
                    className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug"
                  >
                    {p.name}
                  </a>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleteId === p.id}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50"
                    title="Delete program"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {p.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">{p.description}</p>
                )}

                <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">
                    {p.week_count === 0 ? 'No weeks' : `${p.week_count} week${p.week_count !== 1 ? 's' : ''}`}
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(p.created_at)}</span>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <button
                    onClick={() => setAssigningProgram(p)}
                    className="w-full text-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg py-1.5 transition-colors"
                  >
                    Assign to Client
                  </button>
                  <a
                    href={`/coach/programs/${p.id}`}
                    className="text-center text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 transition-colors"
                  >
                    Open builder
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">New Program</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Program name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 12-Week Strength Builder"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description <span className="text-gray-300">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe this program…"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create & Build'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assigningProgram && (
        <AssignProgramModal program={assigningProgram} onClose={() => setAssigningProgram(null)} />
      )}
    </div>
  )
}
