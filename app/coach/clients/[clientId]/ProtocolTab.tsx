'use client'

import { useState, useEffect, useRef } from 'react'

// ── Protocol Tab ──────────────────────────────────────────────────────────────

type ProtocolSection = { id: string; title: string; content: string; hidden?: boolean }

const PROTOCOL_PRESETS = ['Sleep', 'Stress Management', 'Lifestyle', 'Nutrition Timing', 'Recovery', 'Mindset', 'Movement']

export default function ProtocolTab({ clientId }: { clientId: string }) {
  const [sections, setSections] = useState<ProtocolSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showPresets, setShowPresets] = useState(false)

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/protocol`)
      .then(r => r.json())
      .then(d => setSections(Array.isArray(d.sections) ? d.sections : []))
      .finally(() => setLoading(false))
  }, [clientId])

  function scheduleSave(updated: ProtocolSection[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/coach/clients/${clientId}/protocol`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: updated }),
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 1000)
  }

  function addSection(title: string) {
    const updated = [...sections, { id: crypto.randomUUID(), title, content: '' }]
    setSections(updated)
    scheduleSave(updated)
    setShowPresets(false)
  }

  function updateSection(id: string, field: 'title' | 'content', value: string) {
    const updated = sections.map(s => s.id === id ? { ...s, [field]: value } : s)
    setSections(updated)
    scheduleSave(updated)
  }

  function deleteSection(id: string) {
    const updated = sections.filter(s => s.id !== id)
    setSections(updated)
    scheduleSave(updated)
  }

  function toggleHidden(id: string) {
    const updated = sections.map(s => s.id === id ? { ...s, hidden: !s.hidden } : s)
    setSections(updated)
    scheduleSave(updated)
  }

  if (loading) return <div className="py-10 text-center text-sm text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Client Protocol</h3>
          <p className="text-xs text-gray-400 mt-0.5">Lifestyle, sleep, stress management and other protocols — visible to the client.</p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <span className="text-xs text-gray-400">Saving…</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-500">Saved ✓</span>}
          <div className="relative">
            <button
              onClick={() => setShowPresets(v => !v)}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              + Add Section
            </button>
            {showPresets && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[180px]">
                {PROTOCOL_PRESETS.map(p => (
                  <button key={p} onClick={() => addSection(p)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    {p}
                  </button>
                ))}
                <button onClick={() => addSection('Custom')}
                  className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors">
                  Custom…
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500 font-medium">No protocol sections yet</p>
          <p className="text-xs text-gray-400 mt-1">Add sections like Sleep, Stress Management, Lifestyle…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map(s => (
            <div key={s.id} className={`rounded-2xl border p-4 space-y-2 ${s.hidden ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <input
                  value={s.title}
                  onChange={e => updateSection(s.id, 'title', e.target.value)}
                  className={`flex-1 text-sm font-semibold border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none py-0.5 bg-transparent ${s.hidden ? 'text-red-700' : 'text-gray-900'}`}
                  placeholder="Section title"
                />
                {s.hidden && (
                  <span className="text-[10px] font-semibold text-red-500 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0">Hidden from client</span>
                )}
                {/* Toggle visibility */}
                <button
                  onClick={() => toggleHidden(s.id)}
                  className={`flex-shrink-0 transition-colors ${s.hidden ? 'text-red-400 hover:text-gray-400' : 'text-gray-300 hover:text-gray-600'}`}
                  title={s.hidden ? 'Show to client' : 'Hide from client'}
                >
                  {s.hidden ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
                <button onClick={() => deleteSection(s.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="Delete section">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <textarea
                value={s.content}
                onChange={e => updateSection(s.id, 'content', e.target.value)}
                placeholder="Add notes, guidelines, or instructions for this section…"
                rows={3}
                className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 resize-none placeholder:text-gray-300 ${s.hidden ? 'text-red-800 border-red-200 bg-red-50 focus:ring-red-300' : 'text-gray-700 border-gray-200 focus:ring-blue-500'}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

