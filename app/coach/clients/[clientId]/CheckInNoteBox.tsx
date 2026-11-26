'use client'

import { useEffect, useRef, useState } from 'react'
import { noteBodyToHtml } from '@/lib/noteUtils'
import RichToolbar from './RichToolbar'

// Private coach notes attached to a specific check-in, each with an optional
// follow-up date. Deliberately distinct from CheckinFeedbackViaMessages
// directly above it — that sends a message the client reads, this is only
// ever visible to the coach.
//
// Uses the same contentEditable + RichToolbar + template picker as the full
// Notes tab, and writes to the same coach_notes row, so a note written here
// is indistinguishable from one written there.

export type CheckInNote = {
  id: string
  body: string
  created_at: string
  follow_up_date?: string | null
  follow_up_done?: boolean
  source_label?: string | null
  source_url?: string | null
}

const PRESETS: { label: string; weeks: number }[] = [
  { label: '2 weeks', weeks: 2 },
  { label: '4 weeks', weeks: 4 },
  { label: '6 weeks', weeks: 6 },
  { label: '12 weeks', weeks: 12 },
]

function dateInWeeks(weeks: number): string {
  const d = new Date()
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

function fmtDue(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function CheckInNoteBox({
  clientId,
  sourceLabel,
  sourceUrl,
  notes = [],
  onChanged,
  onComposingChange,
}: {
  clientId: string
  sourceLabel: string
  sourceUrl: string
  /** Notes already attached to this check-in, filtered by the parent. */
  notes?: CheckInNote[]
  onChanged?: () => void
  /** Fires when the composer opens or closes, so the check-in above can
   *  switch its answers to a scrollable pane and keep the note in view. */
  onComposingChange?: (composing: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<{ id: string; name: string; body: string }[]>([])
  const [hasText, setHasText] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // Only fetch templates once the box is actually opened — this component
  // renders under every check-in in the list.
  useEffect(() => {
    if (!open || templates.length) return
    fetch('/api/coach/note-templates')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {/* template picker just stays hidden */})
  }, [open, templates.length])

  function syncHasText() {
    const stripped = (editorRef.current?.innerHTML ?? '').replace(/<[^>]*>/g, '').trim()
    setHasText(!!stripped)
  }

  function openComposer(note?: CheckInNote) {
    setError(null)
    setEditingId(note?.id ?? null)
    setFollowUp(note?.follow_up_date ?? '')
    setOpen(true)
    onComposingChange?.(true)
    // The editor only exists once `open` is true, so fill it after paint.
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = note ? note.body : ''
        editorRef.current.focus()
      }
      syncHasText()
    }, 0)
  }

  function closeComposer() {
    setOpen(false)
    onComposingChange?.(false)
    setEditingId(null)
    setFollowUp('')
    setError(null)
    setHasText(false)
  }

  async function save() {
    const html = editorRef.current?.innerHTML ?? ''
    if (!html.replace(/<[^>]*>/g, '').trim()) return
    setSaving(true)
    setError(null)

    const res = editingId
      ? await fetch(`/api/coach/notes/${clientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteId: editingId, body: html, follow_up_date: followUp || null }),
        })
      : await fetch(`/api/coach/notes/${clientId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: html,
            follow_up_date: followUp || null,
            source_label: sourceLabel,
            source_url: sourceUrl,
          }),
        })

    setSaving(false)
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? 'Could not save note.')
      return
    }
    onChanged?.()
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
    closeComposer()
  }

  async function remove(noteId: string) {
    if (!confirm('Delete this note? Any follow-up reminder on it goes too.')) return
    const res = await fetch(`/api/coach/notes/${clientId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId }),
    })
    if (res.ok) onChanged?.()
  }

  return (
    <div className="mt-4 space-y-2">
      {/* Notes already written about this check-in */}
      {notes.map((note) => (
        <div key={note.id} className="rounded-xl border border-purple-200 bg-purple-50/60 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold text-purple-800 uppercase tracking-wide">
              Private note
            </p>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <button onClick={() => openComposer(note)} className="text-[11px] text-purple-600 hover:text-purple-900 transition-colors">
                Edit
              </button>
              <button onClick={() => remove(note.id)} className="text-[11px] text-purple-300 hover:text-red-500 transition-colors">
                Delete
              </button>
            </div>
          </div>
          <div
            className="text-sm text-gray-800 leading-relaxed mt-1 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: note.body }}
          />
          {note.follow_up_date && (
            <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              note.follow_up_done
                ? 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                : 'bg-white text-purple-700 border-purple-300'
            }`}>
              Follow up {fmtDue(note.follow_up_date)}
            </span>
          )}
        </div>
      ))}

      {!open && (
        <button
          onClick={() => openComposer()}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-dashed border-gray-200 hover:border-gray-300 rounded-xl py-2 px-3 w-full transition-colors text-left"
        >
          + {notes.length ? 'Another private note' : 'Private note'}
          {saved && <span className="text-green-600 font-semibold"> · saved</span>}
        </button>
      )}

      {open && (
        <div className="rounded-xl border border-purple-300 bg-purple-50 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-purple-800 uppercase tracking-wide">
              {editingId ? 'Editing note' : 'Private note'} · only you see this
            </p>
            <div className="flex items-center gap-2">
              {templates.length > 0 && !editingId && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const t = templates.find((t) => t.id === e.target.value)
                    if (t && editorRef.current) {
                      editorRef.current.innerHTML = noteBodyToHtml(t.body)
                      syncHasText()
                      e.target.value = ''
                    }
                  }}
                  className="text-[11px] border border-purple-200 rounded-lg px-2 py-1 text-purple-800 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                >
                  <option value="" disabled>Use template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={closeComposer}
                className="text-purple-400 hover:text-purple-700 transition-colors"
                aria-label="Close note"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <RichToolbar editorRef={editorRef} />

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncHasText}
            data-placeholder={`What you want to remember about ${sourceLabel}…`}
            className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 leading-relaxed overflow-auto prose prose-sm max-w-none"
            style={{ minHeight: '5.5rem', maxHeight: '22vh' }}
          />

          <div>
            <p className="text-[11px] font-medium text-purple-800 mb-1.5">Remind me to follow up</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESETS.map((p) => {
                const value = dateInWeeks(p.weeks)
                const active = followUp === value
                return (
                  <button
                    key={p.weeks}
                    onClick={() => setFollowUp(active ? '' : value)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-purple-700 border-purple-200 hover:border-purple-400'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
              <input
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="text-[11px] border border-purple-200 rounded-full px-2.5 py-1 bg-white text-purple-800 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              {followUp && (
                <button onClick={() => setFollowUp('')} className="text-[11px] text-purple-500 hover:text-purple-800 underline">
                  clear
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-[11px] text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-purple-600 truncate">
              Saves to this client&apos;s Notes tab
            </p>
            <button
              onClick={save}
              disabled={saving || !hasText}
              className="text-xs font-semibold bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : followUp ? 'Save & remind me' : 'Save note'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
