'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Client Resources Tab ──────────────────────────────────────────────────────

type ClientResource = {
  id: string
  assigned_at: string
  coach_resources: {
    id: string
    name: string
    description: string | null
    type: 'link' | 'video' | 'pdf' | 'document' | 'image'
    url: string | null
    coach_resource_folders: { id: string; name: string; color: string; icon: string } | null
  } | null
}

type CoachResource = {
  id: string
  name: string
  description: string | null
  type: 'link' | 'video' | 'pdf' | 'document' | 'image'
  url: string | null
  folder_id: string | null
  coach_resource_folders: { id: string; name: string; color: string; icon: string } | null
}

type Folder = { id: string; name: string; color: string; icon: string }

const RESOURCE_TYPE_ICON: Record<string, string> = { link: '🔗', video: '🎬', pdf: '📄', document: '📝', image: '🖼️' }

const FILE_TYPES = ['pdf', 'document', 'video', 'image'] as const
const ACCEPT_MAP: Record<string, string> = {
  document: '.doc,.docx,.txt,.pages,.odt',
  pdf:      '.pdf',
  video:    '.mp4,.mov,.avi,.webm,video/*',
  image:    '.jpg,.jpeg,.png,.gif,.webp,image/*',
}

// ── Upload modal ──────────────────────────────────────────────────────────────

function UploadModal({ clientId, folders, onDone, onClose }: {
  clientId: string
  folders: Folder[]
  onDone: (assignment: ClientResource) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CoachResource['type']>('pdf')
  const [url, setUrl] = useState('')
  const [folderId, setFolderId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isFileType = (FILE_TYPES as readonly string[]).includes(type)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 50 MB.`)
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`
      const { data, error } = await supabase.storage
        .from('coach-resources')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('coach-resources').getPublicUrl(data.path)
      setUrl(publicUrl)
      if (!name.trim()) setName(file.name.replace(`.${ext}`, '').replace(/[_-]/g, ' '))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      // Create resource in library
      const res = await fetch('/api/coach/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description || null, type, url: url || null, folder_id: folderId || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create resource')
      const resource = await res.json()
      // Assign to client
      const assignRes = await fetch(`/api/coach/clients/${clientId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: resource.id }),
      })
      if (!assignRes.ok) throw new Error('Failed to assign resource')
      const assignment = await assignRes.json()
      onDone(assignment)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Upload Resource</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</label>
              <select value={type} onChange={e => { setType(e.target.value as CoachResource['type']); setUrl(''); setUploadError(null) }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="pdf">📄 PDF</option>
                <option value="document">📝 Document</option>
                <option value="image">🖼️ Image</option>
                <option value="video">🎬 Video</option>
                <option value="link">🔗 Link</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Folder</label>
              <select value={folderId} onChange={e => setFolderId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">No folder</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
              </select>
            </div>
          </div>

          {/* File upload or URL input */}
          {isFileType ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">File</label>
              {url ? (
                <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-xl">
                  <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-xs text-green-700 flex-1 truncate">File uploaded</span>
                  <button type="button" onClick={() => { setUrl(''); if (fileRef.current) fileRef.current.value = '' }}
                    className="text-xs text-green-600 hover:text-red-500 font-medium shrink-0">Remove</button>
                </div>
              ) : (
                <label className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                  {uploading ? (
                    <><svg className="w-4 h-4 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span className="text-xs text-blue-600">Uploading…</span></>
                  ) : (
                    <><svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg><span className="text-xs text-gray-500">Click to upload {type}</span></>
                  )}
                  <input ref={fileRef} type="file" className="hidden" accept={ACCEPT_MAP[type]} onChange={handleFileChange} disabled={uploading} />
                </label>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Resource name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Brief description…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {uploadError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{uploadError}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || uploading || !name.trim()}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save & assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function ClientResourcesTab({ clientId }: { clientId: string }) {
  const [assignments, setAssignments] = useState<ClientResource[]>([])
  const [library, setLibrary] = useState<CoachResource[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  async function load() {
    const [aRes, lRes, fRes] = await Promise.all([
      fetch(`/api/coach/clients/${clientId}/resources`).then(r => r.json()),
      fetch('/api/coach/resources').then(r => r.json()),
      fetch('/api/coach/resources/folders').then(r => r.json()),
    ])
    setAssignments(Array.isArray(aRes) ? aRes : [])
    setLibrary(Array.isArray(lRes) ? lRes : [])
    setFolders(Array.isArray(fRes) ? fRes : [])
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
      {showUpload && (
        <UploadModal
          clientId={clientId}
          folders={folders}
          onDone={(assignment) => {
            setAssignments(prev => [assignment, ...prev])
            setLibrary(prev => assignment.coach_resources ? [assignment.coach_resources as CoachResource, ...prev] : prev)
            setShowUpload(false)
          }}
          onClose={() => setShowUpload(false)}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {assignments.length === 0 ? 'No resources assigned' : `${assignments.length} resource${assignments.length !== 1 ? 's' : ''} assigned`}
        </p>
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowUpload(true); setShowPicker(false) }}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            + Upload file
          </button>
          <button onClick={() => setShowPicker(v => !v)}
            className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors">
            Assign existing
          </button>
        </div>
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

