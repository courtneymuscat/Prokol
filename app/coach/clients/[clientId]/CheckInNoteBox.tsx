'use client'

import { useState } from 'react'

// Private coach note attached to a specific check-in, with an optional
// follow-up date. Deliberately distinct from CheckinFeedbackViaMessages
// directly above it — that sends a message the client reads, this is only
// ever visible to the coach.

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

export default function CheckInNoteBox({
  clientId,
  sourceLabel,
  sourceUrl,
}: {
  clientId: string
  sourceLabel: string
  sourceUrl: string
}) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [followUp, setFollowUp] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/coach/notes/${clientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body,
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
    setBody('')
    setFollowUp('')
    setSaved(true)
    setTimeout(() => { setSaved(false); setOpen(false) }, 1800)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-800 border border-dashed border-gray-200 hover:border-gray-300 rounded-xl py-2 px-3 w-full transition-colors text-left"
      >
        + Private note {saved && <span className="text-green-600 font-semibold">· saved</span>}
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/60 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-purple-800 uppercase tracking-wide">
          Private note · only you see this
        </p>
        <button
          onClick={() => { setOpen(false); setError(null) }}
          className="text-purple-400 hover:text-purple-700 transition-colors"
          aria-label="Close note"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        autoFocus
        placeholder={`What you want to remember about ${sourceLabel}…`}
        className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
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
            min={new Date().toISOString().slice(0, 10)}
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
          Linked to {sourceLabel}
        </p>
        <button
          onClick={save}
          disabled={saving || !body.trim()}
          className="text-xs font-semibold bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : followUp ? 'Save & remind me' : 'Save note'}
        </button>
      </div>
    </div>
  )
}
