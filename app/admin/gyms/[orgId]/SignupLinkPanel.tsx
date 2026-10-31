'use client'

import { useState, useEffect } from 'react'

type AutoflowOption = { id: string; name: string; total_steps: number | null }

type ExistingLink = {
  id: string
  code: string
  name: string | null
  isActive: boolean
  autoflowNames: string[]
}

export default function SignupLinkPanel({
  orgId,
  frontDoorUrl,
  existingLinks,
}: {
  orgId: string
  frontDoorUrl: string
  existingLinks: ExistingLink[]
}) {
  const [autoflows, setAutoflows] = useState<AutoflowOption[]>([])
  const [selectedAutoflows, setSelectedAutoflows] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [links, setLinks] = useState(existingLinks)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    // Court's own autoflow library — a gym has no coaching staff of its own,
    // so the signup link always enrolls into one of her own templates, same
    // as any other client she invites directly.
    fetch('/api/coach/autoflows')
      .then((r) => r.json())
      .then((data) => setAutoflows(Array.isArray(data) ? data : []))
      .catch(() => setAutoflows([]))
  }, [])

  function toggleAutoflow(id: string) {
    setSelectedAutoflows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreate() {
    setCreating(true)
    setError(null)
    const res = await fetch(`/api/admin/gyms/${orgId}/signup-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoflowIds: Array.from(selectedAutoflows), name: name.trim() || undefined }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      setError(data.error ?? 'Failed to create signup link')
      return
    }
    setLinks((prev) => [{
      id: data.id,
      code: data.code,
      name: name.trim() || null,
      isActive: true,
      autoflowNames: autoflows.filter((a) => selectedAutoflows.has(a.id)).map((a) => a.name),
    }, ...prev])
    setSelectedAutoflows(new Set())
    setName('')
  }

  function startEditing(link: ExistingLink) {
    setEditingId(link.id)
    setEditingName(link.name ?? '')
  }

  async function saveName(linkId: string) {
    const trimmed = editingName.trim()
    setLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, name: trimmed || null } : l)))
    setEditingId(null)
    await fetch(`/api/admin/gyms/${orgId}/signup-link/${linkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
  }

  async function deleteLink(linkId: string) {
    if (!confirm('Delete this signup link? Anyone still holding the URL will no longer be able to use it.')) return
    setDeletingId(linkId)
    const res = await fetch(`/api/admin/gyms/${orgId}/signup-link/${linkId}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) setLinks((prev) => prev.filter((l) => l.id !== linkId))
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 max-w-xl">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">New signup link</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Anyone who signs up through this link is enrolled in the autoflow(s) below starting the day they actually sign up. They set their own starting macros by completing the onboarding questions right after — there's no coach here to set them manually.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name <span className="text-zinc-600 font-normal">(optional)</span></label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Arete Nutrition members"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Autoflows</label>
          {autoflows.length === 0 ? (
            <p className="text-xs text-zinc-500">No autoflow templates found — create one at Coach → Autoflows first.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {autoflows.map((a) => (
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

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="text-sm font-semibold px-4 py-2 rounded-xl text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: 'var(--nc-primary)' }}
        >
          {creating ? 'Creating…' : 'Generate link'}
        </button>
      </div>

      {links.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800 max-w-xl">
          {links.map((link) => (
            <div key={link.id} className="px-5 py-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                {editingId === link.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveName(link.id)}
                      placeholder="Untitled link"
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <button onClick={() => saveName(link.id)} className="text-xs font-medium text-emerald-400 hover:text-emerald-300">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs font-medium text-zinc-500 hover:text-zinc-300">Cancel</button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-zinc-100">{link.name || 'Untitled link'}</p>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button onClick={() => startEditing(link)} className="text-xs font-medium text-zinc-400 hover:text-zinc-200">Rename</button>
                      <button
                        onClick={() => deleteLink(link.id)}
                        disabled={deletingId === link.id}
                        className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingId === link.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </>
                )}
              </div>
              <p className="text-sm font-mono text-emerald-400">{frontDoorUrl}/org/join/{link.code}</p>
              <p className="text-xs text-zinc-500">
                {link.autoflowNames.length > 0 ? link.autoflowNames.join(', ') : 'No autoflow attached'}
                {!link.isActive && ' · inactive'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
