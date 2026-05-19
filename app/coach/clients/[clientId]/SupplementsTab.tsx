'use client'

import { useState, useEffect, useRef } from 'react'

// ── Supplements Tab ───────────────────────────────────────────────────────────

type LibSupplement = {
  id: string; coach_id: string | null; name: string
  default_dosage: string | null; benefits: string | null; brand_url: string | null; considerations: string | null
}
type ClientSupplement = {
  id: string; supplement_id: string | null; name: string
  dosage: string | null; benefits: string | null; brand_url: string | null; notes: string | null; considerations: string | null
}

export default function SupplementsTab({ clientId }: { clientId: string }) {
  const [library, setLibrary] = useState<LibSupplement[]>([])
  const [assigned, setAssigned] = useState<ClientSupplement[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newDosage, setNewDosage] = useState('')
  const [newBenefits, setNewBenefits] = useState('')
  const [newBrandUrl, setNewBrandUrl] = useState('')
  const [newConsiderations, setNewConsiderations] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingLibId, setEditingLibId] = useState<string | null>(null)
  const [libEdits, setLibEdits] = useState<Partial<LibSupplement>>({})
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function startEditLib(sup: LibSupplement) {
    setEditingLibId(sup.id)
    setLibEdits({ name: sup.name, default_dosage: sup.default_dosage ?? '', benefits: sup.benefits ?? '', brand_url: sup.brand_url ?? '', considerations: sup.considerations ?? '' })
  }

  async function saveLibEdit(id: string) {
    const res = await fetch(`/api/coach/supplements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(libEdits),
    })
    if (res.ok) {
      const updated = await res.json()
      setLibrary(p => p.map(s => s.id === id ? updated : s))
    }
    setEditingLibId(null)
  }

  async function deleteLib(id: string) {
    await fetch(`/api/coach/supplements/${id}`, { method: 'DELETE' })
    setLibrary(p => p.filter(s => s.id !== id))
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/coach/supplements').then(r => r.json()),
      fetch(`/api/coach/clients/${clientId}/supplements`).then(r => r.json()),
    ]).then(([lib, asgn]) => {
      setLibrary(Array.isArray(lib) ? lib : [])
      setAssigned(Array.isArray(asgn) ? asgn : [])
    }).finally(() => setLoading(false))
  }, [clientId])

  async function assign(sup: LibSupplement) {
    const res = await fetch(`/api/coach/clients/${clientId}/supplements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplement_id: sup.id,
        name: sup.name,
        dosage: sup.default_dosage,
        benefits: sup.benefits,
        brand_url: sup.brand_url,
        considerations: sup.considerations,
      }),
    })
    const d = await res.json()
    if (res.ok) setAssigned(p => [...p, d])
  }

  async function addCustom() {
    if (!newName.trim()) return
    setSaving(true)
    const libRes = await fetch('/api/coach/supplements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), default_dosage: newDosage, benefits: newBenefits, brand_url: newBrandUrl, considerations: newConsiderations }),
    })
    const libData = await libRes.json()
    if (libRes.ok) setLibrary(p => [...p, libData])
    setNewName(''); setNewDosage(''); setNewBenefits(''); setNewBrandUrl(''); setNewConsiderations('')
    setAddingCustom(false)
    setSaving(false)
  }

  function patchField(id: string, field: string, value: string) {
    setAssigned(p => p.map(s => s.id === id ? { ...s, [field]: value } : s))
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id])
    saveTimers.current[id] = setTimeout(() => {
      fetch(`/api/coach/clients/${clientId}/supplements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    }, 800)
  }

  async function remove(id: string) {
    setAssigned(p => p.filter(s => s.id !== id))
    await fetch(`/api/coach/clients/${clientId}/supplements/${id}`, { method: 'DELETE' })
  }

  const assignedIds = new Set(assigned.map(a => a.supplement_id).filter(Boolean))

  if (loading) return <div className="py-10 text-center text-sm text-gray-400">Loading…</div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Library */}
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Supplement Library</h3>
            <button onClick={() => setAddingCustom(v => !v)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              {addingCustom ? 'Cancel' : '+ Add Custom'}
            </button>
          </div>

          {addingCustom && (
            <div className="space-y-2 bg-blue-50 rounded-xl p-3">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Supplement name *"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={newDosage} onChange={e => setNewDosage(e.target.value)} placeholder="Default dosage"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea value={newBenefits} onChange={e => setNewBenefits(e.target.value)} placeholder="Benefits / description" rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <input value={newBrandUrl} onChange={e => setNewBrandUrl(e.target.value)} placeholder="Brand URL (optional)"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
                <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Considerations — coach only, not shown to client
                </p>
                <textarea value={newConsiderations} onChange={e => setNewConsiderations(e.target.value)}
                  placeholder="Contraindications, cautions, interactions…" rows={2}
                  className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
              <button onClick={addCustom} disabled={saving || !newName.trim()}
                className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save to Library'}
              </button>
            </div>
          )}

          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {library.map(sup => {
              const isAssigned = assignedIds.has(sup.id)
              const isEditing = editingLibId === sup.id

              if (isEditing) {
                return (
                  <div key={sup.id} className="py-3 space-y-2">
                    <input value={libEdits.name ?? ''} onChange={e => setLibEdits(p => ({ ...p, name: e.target.value }))}
                      placeholder="Name *"
                      className="w-full text-sm font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={libEdits.default_dosage ?? ''} onChange={e => setLibEdits(p => ({ ...p, default_dosage: e.target.value }))}
                      placeholder="Default dosage"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <textarea value={libEdits.benefits ?? ''} onChange={e => setLibEdits(p => ({ ...p, benefits: e.target.value }))}
                      placeholder="Benefits / description" rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={libEdits.brand_url ?? ''} onChange={e => setLibEdits(p => ({ ...p, brand_url: e.target.value }))}
                      placeholder="Brand URL"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1">
                      <p className="text-[10px] font-semibold text-amber-700">Considerations — coach only</p>
                      <textarea value={libEdits.considerations ?? ''} onChange={e => setLibEdits(p => ({ ...p, considerations: e.target.value }))}
                        placeholder="Contraindications, cautions…" rows={2}
                        className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveLibEdit(sup.id)}
                        className="flex-1 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity">
                        Save
                      </button>
                      <button onClick={() => setEditingLibId(null)}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => { setEditingLibId(null); deleteLib(sup.id) }}
                        className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={sup.id} className="py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{sup.name}</p>
                    {sup.default_dosage && <p className="text-xs text-gray-400 mt-0.5">{sup.default_dosage}</p>}
                    {sup.benefits && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{sup.benefits}</p>}
                    {sup.considerations && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 line-clamp-2">
                        ⚠ {sup.considerations}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => startEditLib(sup)}
                      className="text-xs text-gray-400 hover:text-gray-700 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                      Edit
                    </button>
                    <button
                      onClick={() => !isAssigned && assign(sup)}
                      disabled={isAssigned}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                        isAssigned ? 'bg-green-50 text-green-600 cursor-default' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {isAssigned ? 'Assigned ✓' : '+ Assign'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Assigned */}
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Assigned to Client</h3>
          {assigned.length === 0 ? (
            <p className="text-sm text-gray-400">No supplements assigned yet. Select from the library.</p>
          ) : (
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {assigned.map(s => {
                const isOpen = expandedIds.has(s.id)
                return (
                  <div key={s.id} className="border border-gray-100 rounded-xl overflow-hidden">
                    {/* Header row — always visible */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        onClick={() => toggleExpanded(s.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                      >
                        <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button onClick={() => toggleExpanded(s.id)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.name || 'Unnamed supplement'}</p>
                        {!isOpen && s.dosage && (
                          <p className="text-xs text-gray-400 truncate">{s.dosage}</p>
                        )}
                      </button>
                      <button onClick={() => remove(s.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="Remove">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Expandable fields */}
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-50">
                        <div className="pt-2">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Name</label>
                          <input
                            value={s.name}
                            onChange={e => patchField(s.id, 'name', e.target.value)}
                            className="w-full text-sm font-semibold text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Dosage</label>
                          <input
                            value={s.dosage ?? ''}
                            onChange={e => patchField(s.id, 'dosage', e.target.value)}
                            placeholder="e.g. 2000 IU daily with food"
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Benefits</label>
                          <textarea
                            value={s.benefits ?? ''}
                            onChange={e => patchField(s.id, 'benefits', e.target.value)}
                            placeholder="Why this supplement…"
                            rows={2}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Brand / Link</label>
                          <input
                            value={s.brand_url ?? ''}
                            onChange={e => patchField(s.id, 'brand_url', e.target.value)}
                            placeholder="https://…"
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Notes for client</label>
                          <textarea
                            value={s.notes ?? ''}
                            onChange={e => patchField(s.id, 'notes', e.target.value)}
                            placeholder="Any extra instructions…"
                            rows={2}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1">
                          <p className="text-[10px] font-semibold text-amber-700 flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Considerations — not visible to client
                          </p>
                          <textarea
                            value={s.considerations ?? ''}
                            onChange={e => patchField(s.id, 'considerations', e.target.value)}
                            placeholder="Contraindications, cautions, interactions…"
                            rows={2}
                            className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

