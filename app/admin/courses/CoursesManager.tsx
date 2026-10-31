'use client'

import { useState, useEffect } from 'react'

type AutoflowOption = { id: string; name: string; total_steps: number | null }

type Course = {
  id: string
  code: string
  name: string | null
  description: string | null
  price_cents: number | null
  currency: string
  is_active: boolean
  autoflow_ids: string[]
}

export default function CoursesManager({ initialAutoflowId }: { initialAutoflowId: string | null }) {
  const [autoflows, setAutoflows] = useState<AutoflowOption[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedAutoflows, setSelectedAutoflows] = useState<Set<string>>(
    () => new Set(initialAutoflowId ? [initialAutoflowId] : []),
  )
  const [priceInput, setPriceInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/coach/autoflows').then(r => r.json()),
      fetch('/api/coach/program-links').then(r => r.json()),
    ]).then(([af, links]) => {
      setAutoflows(Array.isArray(af) ? af : [])
      setCourses(Array.isArray(links) ? links : [])
    }).finally(() => setLoading(false))
  }, [])

  function toggleAutoflow(id: string) {
    setSelectedAutoflows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function autoflowNames(ids: string[]): string {
    return ids.map(id => autoflows.find(a => a.id === id)?.name ?? 'Untitled autoflow').join(', ')
  }

  async function createCourse() {
    if (selectedAutoflows.size === 0) {
      setError('Select at least one autoflow')
      return
    }
    const priceCents = priceInput.trim() ? Math.round(Number(priceInput) * 100) : undefined
    if (priceInput.trim() && (!priceCents || priceCents <= 0)) {
      setError('Enter a valid price, or leave it blank for a free course')
      return
    }
    setCreating(true)
    setError(null)
    const res = await fetch('/api/coach/program-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autoflowIds: Array.from(selectedAutoflows),
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        priceCents,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      setError(data.error ?? 'Failed to create course')
      return
    }
    setCourses(prev => [{
      id: data.id,
      code: data.code,
      name: name.trim() || null,
      description: description.trim() || null,
      price_cents: priceCents ?? null,
      currency: 'aud',
      is_active: true,
      autoflow_ids: Array.from(selectedAutoflows),
    }, ...prev])
    setName('')
    setDescription('')
    setSelectedAutoflows(new Set())
    setPriceInput('')
  }

  function copyLink(code: string, id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/org/join/${code}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function startEditing(course: Course) {
    setEditingId(course.id)
    setEditingName(course.name ?? '')
  }

  async function saveName(courseId: string) {
    const trimmed = editingName.trim()
    setCourses(prev => prev.map(c => (c.id === courseId ? { ...c, name: trimmed || null } : c)))
    setEditingId(null)
    await fetch(`/api/coach/program-links/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
  }

  async function deleteCourse(courseId: string) {
    if (!confirm('Delete this course link? Anyone still holding the URL will no longer be able to use it.')) return
    setDeletingId(courseId)
    const res = await fetch(`/api/coach/program-links/${courseId}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) setCourses(prev => prev.filter(c => c.id !== courseId))
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 max-w-xl">
        <h2 className="text-sm font-semibold text-zinc-200">New course</h2>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. 12-Week Transformation Package"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <p className="text-xs text-zinc-600 mt-1">Shown on the sign-up page. Leave blank to just show the autoflow's own name (fine for a single-autoflow course).</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description <span className="text-zinc-600 font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Autoflows</label>
          {autoflows.length === 0 ? (
            <p className="text-xs text-zinc-500">No autoflow templates found — create one at Coach → Autoflows first.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {autoflows.map(a => (
                <label key={a.id} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAutoflows.has(a.id)}
                    onChange={() => toggleAutoflow(a.id)}
                    className="rounded border-zinc-600 bg-zinc-950"
                  />
                  {a.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Price <span className="text-zinc-600 font-normal">(optional — blank is free)</span></label>
          <div className="relative max-w-[160px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
              placeholder="149.00"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-6 pr-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={createCourse}
          disabled={creating}
          className="text-sm font-semibold px-4 py-2 rounded-xl text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: 'var(--nc-primary)' }}
        >
          {creating ? 'Creating…' : 'Generate link'}
        </button>
      </div>

      {courses.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800 max-w-xl">
          {courses.map(c => (
            <div key={c.id} className="px-5 py-4 space-y-1.5">
              {editingId === c.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveName(c.id)}
                    placeholder="Untitled course"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <button onClick={() => saveName(c.id)} className="text-xs font-medium text-emerald-400 hover:text-emerald-300">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs font-medium text-zinc-500 hover:text-zinc-300">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-100">{c.name || autoflowNames(c.autoflow_ids) || 'Untitled course'}</p>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => startEditing(c)} className="text-xs font-medium text-zinc-400 hover:text-zinc-200">Rename</button>
                    <button
                      onClick={() => copyLink(c.code, c.id)}
                      className="text-xs font-medium text-zinc-300 border border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-800 transition-colors"
                    >
                      {copiedId === c.id ? '✓ Copied' : 'Copy link'}
                    </button>
                    <button
                      onClick={() => deleteCourse(c.id)}
                      disabled={deletingId === c.id}
                      className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {deletingId === c.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-sm font-mono text-emerald-400">/org/join/{c.code}</p>
              <p className="text-xs text-zinc-500">
                {c.price_cents ? `$${(c.price_cents / 100).toFixed(2)} ${c.currency.toUpperCase()}` : 'Free'}
                {' · '}
                {autoflowNames(c.autoflow_ids) || 'No autoflow attached'}
                {!c.is_active && ' · inactive'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
