'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type Folder = {
  id: string
  name: string
  color: string
  icon: string
  sort_order: number
}

type Resource = {
  id: string
  name: string
  description: string | null
  type: 'link' | 'video' | 'pdf' | 'document'
  url: string | null
  folder_id: string | null
  coach_resource_folders: Folder | null
  created_at: string
}

// ── Template presets coaches can import ───────────────────────────────────────

const PRESET_FOLDERS = [
  { name: 'Nutrition', color: 'green', icon: '🥗' },
  { name: 'Training', color: 'blue', icon: '💪' },
  { name: 'Mindset', color: 'purple', icon: '🧠' },
  { name: 'Onboarding', color: 'amber', icon: '👋' },
]

const PRESET_RESOURCES: { name: string; description: string; type: Resource['type']; folderName: string }[] = [
  { name: 'Macro Tracking Guide', description: 'How to track protein, carbs, and fat to hit your daily targets.', type: 'document', folderName: 'Nutrition' },
  { name: 'Meal Prep 101', description: 'Step-by-step guide to preparing a full week of meals on Sunday.', type: 'document', folderName: 'Nutrition' },
  { name: 'Eating Out Without Derailing Progress', description: 'Smart choices for restaurants, takeaway, and social events.', type: 'document', folderName: 'Nutrition' },
  { name: 'Reading Food Labels', description: 'What to look for on nutrition panels and ingredient lists.', type: 'document', folderName: 'Nutrition' },
  { name: 'Progressive Overload Explained', description: 'The principle that drives strength and muscle gains over time.', type: 'document', folderName: 'Training' },
  { name: 'Recovery & Sleep Guide', description: 'Why sleep is your most underrated tool for results.', type: 'document', folderName: 'Training' },
  { name: 'Beginner Workout Guide', description: 'Foundation movement patterns and how to structure your first program.', type: 'document', folderName: 'Training' },
  { name: 'Habit Stacking Framework', description: 'Attach new habits to existing routines for effortless consistency.', type: 'document', folderName: 'Mindset' },
  { name: 'Motivation vs Discipline', description: 'Why motivation is unreliable and how to build discipline that lasts.', type: 'document', folderName: 'Mindset' },
  { name: 'Goal Setting Template', description: '90-day goal setting framework with weekly milestones and checkpoints.', type: 'document', folderName: 'Mindset' },
  { name: 'Welcome to Coaching', description: 'What to expect from your coaching program and how to get the most out of it.', type: 'document', folderName: 'Onboarding' },
  { name: 'How to Use the App', description: 'Quick guide to logging food, tracking habits, and using the calendar.', type: 'document', folderName: 'Onboarding' },
  { name: 'Progress Photo Guide', description: 'How to take consistent progress photos for accurate comparison.', type: 'document', folderName: 'Onboarding' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export const FOLDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  gray:   { bg: 'bg-gray-100',  text: 'text-gray-600',   border: 'border-gray-200' },
}

export const TYPE_META: Record<Resource['type'], { icon: string; label: string }> = {
  link:     { icon: '🔗', label: 'Link' },
  video:    { icon: '🎬', label: 'Video' },
  pdf:      { icon: '📄', label: 'PDF' },
  document: { icon: '📝', label: 'Document' },
}

// ── Resource Card ─────────────────────────────────────────────────────────────

function ResourceCard({ resource, onEdit, onDelete }: {
  resource: Resource
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = TYPE_META[resource.type]
  const folder = resource.coach_resource_folders
  const colors = folder ? (FOLDER_COLORS[folder.color] ?? FOLDER_COLORS.gray) : FOLDER_COLORS.gray

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-2.5 group hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{meta.icon}</span>
          <p className="text-sm font-semibold text-gray-900 truncate">{resource.name}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-700 transition-colors" title="Edit">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {resource.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{resource.description}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
          {folder?.icon} {folder?.name ?? 'Unfiled'}
        </span>
        <span className="text-[11px] text-gray-400">{meta.label}</span>
        {resource.url && (
          <a href={resource.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[11px] text-blue-500 hover:text-blue-700 underline truncate max-w-[140px]">
            {resource.url.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>
    </div>
  )
}

// ── Resource Modal ─────────────────────────────────────────────────────────────

const FILE_UPLOAD_TYPES: Resource['type'][] = ['document', 'pdf', 'video']

const ACCEPT_MAP: Record<string, string> = {
  document: '.doc,.docx,.txt,.pages,.odt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf:      '.pdf,application/pdf',
  video:    '.mp4,.mov,.avi,.webm,video/*',
}

function ResourceModal({ initial, folders, onSave, onClose }: {
  initial?: Partial<Resource>
  folders: Folder[]
  onSave: (data: Partial<Resource>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [type, setType] = useState<Resource['type']>(initial?.type ?? 'link')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [folderId, setFolderId] = useState(initial?.folder_id ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canUploadFile = FILE_UPLOAD_TYPES.includes(type)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)

    // Client-side size check — Supabase free tier bucket limit is typically 50 MB
    const MAX_MB = 50
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_MB} MB. Try compressing the file, or paste a URL below instead.`)
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
      if (error) {
        // Surface a friendlier message for size errors
        if (error.message?.toLowerCase().includes('size') || error.message?.toLowerCase().includes('exceeded')) {
          throw new Error(`File too large for storage. Try compressing it, or paste a URL below instead.`)
        }
        throw error
      }
      const { data: { publicUrl } } = supabase.storage.from('coach-resources').getPublicUrl(data.path)
      setUrl(publicUrl)
      if (!name.trim()) {
        setName(file.name.replace(`.${ext}`, '').replace(/[_-]/g, ' '))
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), description: description || null, type, url: url || null, folder_id: folderId || null })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">{initial?.id ? 'Edit Resource' : 'Add Resource'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</label>
              <select value={type} onChange={e => { setType(e.target.value as Resource['type']); setUrl(''); setUploadError(null) }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="link">🔗 Link</option>
                <option value="video">🎬 Video</option>
                <option value="pdf">📄 PDF</option>
                <option value="document">📝 Document</option>
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

          {/* File upload — shown for document / pdf / video */}
          {canUploadFile ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">File</label>
              {url ? (
                <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-xl">
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-xs text-green-700 truncate flex-1">File uploaded</span>
                  <button type="button" onClick={() => { setUrl(''); if (fileRef.current) fileRef.current.value = '' }}
                    className="text-xs text-green-600 hover:text-red-500 font-medium flex-shrink-0">Remove</button>
                </div>
              ) : (
                <label className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                  {uploading ? (
                    <>
                      <svg className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span className="text-xs text-blue-600">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      <span className="text-xs text-gray-500">Click to upload {type}</span>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept={ACCEPT_MAP[type]} className="sr-only" onChange={handleFileChange} disabled={uploading} />
                </label>
              )}
              {uploadError && (
                <div className="mt-1.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <p className="text-xs text-red-600">{uploadError}</p>
                  <p className="text-xs text-red-400 mt-0.5">Tip: upload to Google Drive, Dropbox, or iCloud and paste the share link below.</p>
                </div>
              )}
              {!uploadError && <p className="text-[11px] text-gray-400 mt-1">Max 50 MB · Or paste a URL below instead</p>}
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" type="url"
                className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" type="url"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving || uploading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Folder Modal ───────────────────────────────────────────────────────────────

const FOLDER_COLOR_OPTIONS = ['blue', 'green', 'purple', 'amber', 'red', 'gray']
const FOLDER_ICON_OPTIONS = ['📁', '🥗', '💪', '🧠', '👋', '⚡', '📚', '🎯', '💡', '🌟']

function FolderModal({ initial, onSave, onClose }: {
  initial?: Partial<Folder>
  onSave: (data: Partial<Folder>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? 'blue')
  const [icon, setIcon] = useState(initial?.icon ?? '📁')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), color, icon })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">{initial?.id ? 'Edit Folder' : 'New Folder'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Folder name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nutrition"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_ICON_OPTIONS.map(i => (
                <button key={i} onClick={() => setIcon(i)}
                  className={`w-8 h-8 text-lg rounded-lg border transition-colors ${icon === i ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Color</label>
            <div className="flex gap-2">
              {FOLDER_COLOR_OPTIONS.map(c => {
                const cls = FOLDER_COLORS[c]
                return (
                  <button key={c} onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${cls.bg} ${color === c ? 'border-gray-700 scale-110' : 'border-transparent'}`} />
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ResourcesManager() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [importingPresets, setImportingPresets] = useState(false)
  const [importedPresets, setImportedPresets] = useState(false)

  async function load() {
    const [fRes, rRes] = await Promise.all([
      fetch('/api/coach/resources/folders').then(r => r.json()),
      fetch('/api/coach/resources').then(r => r.json()),
    ])
    setFolders(Array.isArray(fRes) ? fRes : [])
    setResources(Array.isArray(rRes) ? rRes : [])
  }

  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  async function handleCreateFolder(data: Partial<Folder>) {
    const res = await fetch('/api/coach/resources/folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    if (res.ok) { const f = await res.json(); setFolders(prev => [...prev, f]) }
    setShowFolderModal(false)
  }

  async function handleUpdateFolder(data: Partial<Folder>) {
    if (!editingFolder) return
    const res = await fetch(`/api/coach/resources/folders/${editingFolder.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    if (res.ok) { const u = await res.json(); setFolders(prev => prev.map(f => f.id === u.id ? u : f)) }
    setEditingFolder(null)
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm('Delete this folder? Resources inside will become unfiled.')) return
    await fetch(`/api/coach/resources/folders/${id}`, { method: 'DELETE' })
    setFolders(prev => prev.filter(f => f.id !== id))
    if (selectedFolder === id) setSelectedFolder(null)
  }

  async function handleCreateResource(data: Partial<Resource>) {
    const res = await fetch('/api/coach/resources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    if (res.ok) { const r = await res.json(); setResources(prev => [r, ...prev]) }
    setShowResourceModal(false)
  }

  async function handleUpdateResource(data: Partial<Resource>) {
    if (!editingResource) return
    const res = await fetch(`/api/coach/resources/${editingResource.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    if (res.ok) { const u = await res.json(); setResources(prev => prev.map(r => r.id === u.id ? u : r)) }
    setEditingResource(null)
  }

  async function handleDeleteResource(id: string) {
    if (!confirm('Delete this resource?')) return
    await fetch(`/api/coach/resources/${id}`, { method: 'DELETE' })
    setResources(prev => prev.filter(r => r.id !== id))
  }

  async function importPresets() {
    setImportingPresets(true)
    const folderMap: Record<string, string> = {}
    for (const pf of PRESET_FOLDERS) {
      const existing = folders.find(f => f.name === pf.name)
      if (existing) { folderMap[pf.name] = existing.id; continue }
      const res = await fetch('/api/coach/resources/folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pf),
      })
      if (res.ok) { const f = await res.json(); folderMap[pf.name] = f.id }
    }
    for (const pr of PRESET_RESOURCES) {
      await fetch('/api/coach/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pr.name, description: pr.description, type: pr.type, url: null, folder_id: folderMap[pr.folderName] ?? null }),
      })
    }
    await load()
    setImportingPresets(false)
    setImportedPresets(true)
    setShowPresets(false)
    setTimeout(() => setImportedPresets(false), 3000)
  }

  const visibleResources = selectedFolder === null
    ? resources
    : selectedFolder === '__unfiled'
    ? resources.filter(r => !r.folder_id)
    : resources.filter(r => r.folder_id === selectedFolder)

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-400">Loading resources…</p>
    </div>
  )

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left sidebar */}
      <aside className="w-52 bg-white border-r flex-shrink-0 flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <h1 className="text-base font-bold text-gray-900">Resources</h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button onClick={() => setSelectedFolder(null)}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedFolder === null ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            All resources
            <span className="ml-auto text-xs text-gray-400">{resources.length}</span>
          </button>

          {folders.map(folder => {
            const count = resources.filter(r => r.folder_id === folder.id).length
            return (
              <div key={folder.id} className="group relative">
                <button onClick={() => setSelectedFolder(folder.id)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors pr-12 ${selectedFolder === folder.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span>{folder.icon}</span>
                  <span className="flex-1 truncate">{folder.name}</span>
                  <span className="text-xs text-gray-400">{count}</span>
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                  <button onClick={() => setEditingFolder(folder)} className="p-0.5 text-gray-400 hover:text-gray-700">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => handleDeleteFolder(folder.id)} className="p-0.5 text-gray-400 hover:text-red-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            )
          })}

          {resources.some(r => !r.folder_id) && (
            <button onClick={() => setSelectedFolder('__unfiled')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedFolder === '__unfiled' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
              <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              Unfiled
            </button>
          )}
        </nav>
        <div className="p-2 border-t border-gray-100">
          <button onClick={() => setShowFolderModal(true)}
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            New folder
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {selectedFolder === null ? 'All Resources' : selectedFolder === '__unfiled' ? 'Unfiled' : folders.find(f => f.id === selectedFolder)?.name ?? 'Resources'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{visibleResources.length} resource{visibleResources.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              {importedPresets && <span className="text-xs text-green-600 font-medium">Templates imported!</span>}
              <button onClick={() => setShowPresets(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                Import templates
              </button>
              <button onClick={() => setShowResourceModal(true)}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                + Add resource
              </button>
            </div>
          </div>

          {showPresets && (
            <div className="mb-5 bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-blue-900">Resource templates</p>
                  <p className="text-xs text-blue-600 mt-0.5">{PRESET_RESOURCES.length} pre-built resources across {PRESET_FOLDERS.length} folders. Edit URLs after import.</p>
                </div>
                <button onClick={() => setShowPresets(false)} className="text-blue-400 hover:text-blue-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {PRESET_FOLDERS.map(pf => (
                  <div key={pf.name} className="text-xs text-blue-700 flex items-center gap-1.5">
                    <span>{pf.icon}</span>
                    <span className="font-medium">{pf.name}</span>
                    <span className="text-blue-400">({PRESET_RESOURCES.filter(p => p.folderName === pf.name).length})</span>
                  </div>
                ))}
              </div>
              <button onClick={importPresets} disabled={importingPresets}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {importingPresets ? 'Importing…' : 'Import all templates'}
              </button>
            </div>
          )}

          {visibleResources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-base font-semibold text-gray-700 mb-1">No resources yet</p>
              <p className="text-sm text-gray-400 mb-4">Add links, PDFs, videos, and documents for your clients.</p>
              <button onClick={() => setShowResourceModal(true)}
                className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                + Add first resource
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleResources.map(resource => (
                <ResourceCard key={resource.id} resource={resource}
                  onEdit={() => setEditingResource(resource)}
                  onDelete={() => handleDeleteResource(resource.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {(showResourceModal || editingResource) && (
        <ResourceModal
          initial={editingResource ?? { folder_id: selectedFolder && selectedFolder !== '__unfiled' ? selectedFolder : null }}
          folders={folders}
          onSave={editingResource ? handleUpdateResource : handleCreateResource}
          onClose={() => { setShowResourceModal(false); setEditingResource(null) }} />
      )}
      {(showFolderModal || editingFolder) && (
        <FolderModal
          initial={editingFolder ?? undefined}
          onSave={editingFolder ? handleUpdateFolder : handleCreateFolder}
          onClose={() => { setShowFolderModal(false); setEditingFolder(null) }} />
      )}
    </div>
  )
}
