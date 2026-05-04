'use client'

import { useState, useEffect, useRef } from 'react'
import { noteBodyToHtml } from '@/lib/noteUtils'

type Template = { id: string; name: string; body: string; created_at: string }

// ── Rich toolbar (same as ClientTabs NotesTab) ────────────────────────────────

const FONT_COLORS = ['#111827', '#ef4444', '#f97316', '#eab308', '#22c55e', '#1D9E75', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

function RichToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const highlightInputRef = useRef<HTMLInputElement>(null)

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
    return (
      <button type="button" title={title}
        onMouseDown={(e) => { e.preventDefault(); onClick() }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900 text-sm font-semibold select-none">
        {children}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-0.5 flex-wrap border border-gray-200 rounded-xl px-2 py-1.5 bg-gray-50">
      <ToolBtn title="Bold" onClick={() => exec('bold')}><span className="font-bold">B</span></ToolBtn>
      <ToolBtn title="Italic" onClick={() => exec('italic')}><span className="italic">I</span></ToolBtn>
      <ToolBtn title="Underline" onClick={() => exec('underline')}><span className="underline">U</span></ToolBtn>
      <ToolBtn title="Strikethrough" onClick={() => exec('strikeThrough')}><span className="line-through">S</span></ToolBtn>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      {FONT_COLORS.map(c => (
        <button key={c} type="button" title={`Colour ${c}`}
          onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c) }}
          className="w-5 h-5 rounded-full border border-white shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: c }} />
      ))}
      <button type="button" title="Custom colour"
        onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click() }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>
      <input ref={colorInputRef} type="color" className="sr-only" onChange={e => exec('foreColor', e.target.value)} />

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <ToolBtn title="Highlight" onClick={() => highlightInputRef.current?.click()}>
        <span style={{ background: 'linear-gradient(transparent 50%, #fde047 50%)' }} className="px-0.5">H</span>
      </ToolBtn>
      <input ref={highlightInputRef} type="color" defaultValue="#fde047" className="sr-only" onChange={e => exec('hiliteColor', e.target.value)} />

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <ToolBtn title="Heading" onClick={() => exec('formatBlock', '<h3>')}><span className="font-bold text-xs">H</span></ToolBtn>
      <ToolBtn title="Subheading" onClick={() => exec('formatBlock', '<h4>')}><span className="font-semibold text-[10px]">H2</span></ToolBtn>
      <ToolBtn title="Paragraph" onClick={() => exec('formatBlock', '<p>')}><span className="text-xs">¶</span></ToolBtn>
      <ToolBtn title="Bullet list" onClick={() => exec('insertUnorderedList')}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </ToolBtn>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <ToolBtn title="Clear formatting" onClick={() => exec('removeFormat')}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </ToolBtn>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').trim()
}



export default function NoteTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/coach/note-templates')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setError(null)
    setCreating(true)
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = '' }, 0)
  }

  function openEdit(t: Template) {
    setCreating(false)
    setName(t.name)
    setError(null)
    setEditing(t)
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = noteBodyToHtml(t.body)
      }
    }, 0)
  }

  function closePanel() {
    setCreating(false)
    setEditing(null)
  }

  async function handleSave() {
    const html = editorRef.current?.innerHTML ?? ''
    if (!name.trim() || !stripHtml(html)) { setError('Name and body are required'); return }
    setSaving(true); setError(null)

    if (editing) {
      const res = await fetch(`/api/coach/note-templates/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body: html }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t))
        closePanel()
      } else setError('Failed to save')
    } else {
      const res = await fetch('/api/coach/note-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body: html }),
      })
      if (res.ok) {
        const created = await res.json()
        setTemplates((prev) => [...prev, created])
        closePanel()
      } else setError('Failed to save')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return
    await fetch(`/api/coach/note-templates/${id}`, { method: 'DELETE' })
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    if (editing?.id === id) closePanel()
  }

  const panelOpen = creating || !!editing

  return (
    <main className="flex-1 p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Note Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Create reusable note structures for client reviews, assessments, and progress notes.</p>
        </div>
        <button onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          + New template
        </button>
      </div>

      <div className="flex gap-6">
        {/* Template list */}
        <div className="flex-1 min-w-0 space-y-3">
          {loading && <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>}

          {!loading && templates.length === 0 && (
            <div className="bg-white rounded-2xl border p-8 text-center">
              <p className="text-gray-600 font-medium">No templates yet</p>
              <p className="text-gray-400 text-sm mt-1">Click &quot;+ New template&quot; to create your first one.</p>
            </div>
          )}

          {!loading && templates.length > 0 && templates.map((t) => (
            <div key={t.id}
              className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-sm ${editing?.id === t.id ? 'border-blue-400 bg-blue-50' : ''}`}
              onClick={() => openEdit(t)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{stripHtml(t.body).slice(0, 120)}{stripHtml(t.body).length > 120 ? '…' : ''}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                  className="text-gray-300 hover:text-red-400 flex-shrink-0 mt-0.5 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Editor panel */}
        {panelOpen && (
          <div className="w-[520px] flex-shrink-0 bg-white rounded-2xl border p-5 space-y-4 self-start sticky top-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{editing ? 'Edit template' : 'New template'}</p>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Template name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly Check-In Review"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Body</label>
              <RichToolbar editorRef={editorRef} />
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Write your template… use the toolbar for bold headings, colours, lists etc."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed overflow-auto prose prose-sm max-w-none"
                style={{ minHeight: '320px' }}
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save template'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
