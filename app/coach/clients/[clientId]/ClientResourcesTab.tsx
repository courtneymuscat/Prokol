'use client'

import { useState, useEffect } from 'react'

// ── Client Resources Tab ──────────────────────────────────────────────────────

type ClientResource = {
  id: string
  assigned_at: string
  coach_resources: {
    id: string
    name: string
    description: string | null
    type: 'link' | 'video' | 'pdf' | 'document'
    url: string | null
    coach_resource_folders: { id: string; name: string; color: string; icon: string } | null
  } | null
}

type CoachResource = {
  id: string
  name: string
  description: string | null
  type: 'link' | 'video' | 'pdf' | 'document'
  url: string | null
  folder_id: string | null
  coach_resource_folders: { id: string; name: string; color: string; icon: string } | null
}

const RESOURCE_TYPE_ICON: Record<string, string> = { link: '🔗', video: '🎬', pdf: '📄', document: '📝' }

export default function ClientResourcesTab({ clientId }: { clientId: string }) {
  const [assignments, setAssignments] = useState<ClientResource[]>([])
  const [library, setLibrary] = useState<CoachResource[]>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  async function load() {
    const [aRes, lRes] = await Promise.all([
      fetch(`/api/coach/clients/${clientId}/resources`).then(r => r.json()),
      fetch('/api/coach/resources').then(r => r.json()),
    ])
    setAssignments(Array.isArray(aRes) ? aRes : [])
    setLibrary(Array.isArray(lRes) ? lRes : [])
  }

  useEffect(() => { load().finally(() => setLoading(false)) }, [clientId])

  async function handleAssign(resourceId: string) {
    setAssigning(resourceId)
    const res = await fetch(`/api/coach/clients/${clientId}/resources`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_id: resourceId }),
    })
    if (res.ok) {
      const row = await res.json()
      setAssignments(prev => [row, ...prev.filter(a => a.coach_resources?.id !== resourceId)])
    }
    setAssigning(null)
  }

  async function handleRemove(resourceId: string) {
    if (!confirm('Remove this resource from the client?')) return
    await fetch(`/api/coach/clients/${clientId}/resources/${resourceId}`, { method: 'DELETE' })
    setAssignments(prev => prev.filter(a => a.coach_resources?.id !== resourceId))
  }

  const assignedIds = new Set(assignments.map(a => a.coach_resources?.id).filter(Boolean))
  const unassigned = library.filter(r => !assignedIds.has(r.id))

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Loading resources…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {assignments.length === 0 ? 'No resources assigned' : `${assignments.length} resource${assignments.length !== 1 ? 's' : ''} assigned`}
        </p>
        <button onClick={() => setShowPicker(v => !v)}
          className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          + Assign resource
        </button>
      </div>

      {showPicker && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-800">Pick from your library</p>
          {unassigned.length === 0 ? (
            <p className="text-sm text-blue-600">All resources are already assigned, or your library is empty.{' '}
              <a href="/coach/resources" target="_blank" className="underline">Add resources →</a>
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {unassigned.map(r => (
                <button key={r.id} onClick={() => handleAssign(r.id)} disabled={assigning === r.id}
                  className="text-left flex items-start gap-2 bg-white rounded-xl border border-blue-200 hover:border-blue-400 p-3 transition-colors disabled:opacity-50">
                  <span className="text-base flex-shrink-0 mt-0.5">{RESOURCE_TYPE_ICON[r.type] ?? '📝'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                    {r.coach_resource_folders && (
                      <p className="text-xs text-gray-400">{r.coach_resource_folders.icon} {r.coach_resource_folders.name}</p>
                    )}
                  </div>
                  {assigning === r.id && <span className="ml-auto text-xs text-blue-500">Adding…</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-3xl mb-2">📚</div>
          <p className="text-sm text-gray-500 mb-1">No resources assigned yet.</p>
          <p className="text-xs text-gray-400">Assign resources from your library for this client to access.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assignments.map(a => {
            const r = a.coach_resources
            if (!r) return null
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start justify-between gap-3 group">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0 mt-0.5">{RESOURCE_TYPE_ICON[r.type] ?? '📝'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                    {r.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{r.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {r.coach_resource_folders && (
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {r.coach_resource_folders.icon} {r.coach_resource_folders.name}
                        </span>
                      )}
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-blue-500 hover:underline truncate max-w-[120px]">
                          Open →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleRemove(r.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ClientServeGuide extracted to ./ClientServeGuide.tsx (lazy-loaded)

