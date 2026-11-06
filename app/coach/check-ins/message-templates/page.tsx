'use client'

import { useEffect, useState } from 'react'
import { FLAG_CATEGORY_PRIORITY, FLAG_CATEGORY_LABELS, URGENT_KEYWORDS } from '@/lib/checkinFlags'

type CustomCategory = { id: string; label: string }

type Templates = {
  urgent_template: string
  urgent_enabled: boolean
  normal_template: string
  lead_template: string
  category_snippets: Record<string, string>
  custom_categories: CustomCategory[]
}

function slugify(label: string, taken: Set<string>): string {
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'category'
  let candidate = base
  let i = 2
  while (taken.has(candidate)) {
    candidate = `${base}_${i}`
    i++
  }
  return candidate
}

function AddCustomCategory({ existingIds, onAdd }: { existingIds: string[]; onAdd: (cat: CustomCategory) => void }) {
  const [label, setLabel] = useState('')

  function add() {
    if (!label.trim()) return
    const id = slugify(label, new Set(existingIds))
    onAdd({ id, label: label.trim() })
    setLabel('')
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder="New category name…"
        className="flex-1 text-sm border border-dashed border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-solid focus:border-gray-400"
      />
      <button
        type="button"
        onClick={add}
        disabled={!label.trim()}
        className="text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors flex-shrink-0"
      >
        + Add category
      </button>
    </div>
  )
}

function UrgentWatchlistNote() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-2.5">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-left">
        <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          What triggers this automatically?
        </p>
        <svg className={`w-3.5 h-3.5 text-amber-600 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="text-[11px] text-amber-700 mt-2 leading-relaxed space-y-1.5">
          <p>This sends automatically (when the toggle above is on) in two cases:</p>
          <p>1. Any question a coach has flagged <span className="font-semibold">Urgent</span> with &quot;send an automated message&quot; switched on, in the autoflow builder.</p>
          <p>2. The built-in keyword scan — it reads every short/long text answer on a check-in and matches against this fixed watchlist (not editable): {URGENT_KEYWORDS.join(', ')}.</p>
        </div>
      )}
    </div>
  )
}

export default function MessageTemplatesPage() {
  const [templates, setTemplates] = useState<Templates | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/coach/message-templates')
      .then(r => r.json())
      .then(d => { if (!d.error) setTemplates(d) })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!templates) return
    setSaving(true)
    await fetch('/api/coach/message-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templates),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <main className="flex-1 p-6"><p className="text-sm text-gray-400">Loading…</p></main>
  if (!templates) return <main className="flex-1 p-6"><p className="text-sm text-gray-400">Couldn&apos;t load your templates.</p></main>

  return (
    <main className="flex-1 p-6 space-y-6 w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <a href="/coach/check-ins" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Check-ins</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Message templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Wording for the automated messages sent when a check-in is flagged — see "+ Flag this question" on any autoflow question.
            Merge fields: <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{'{first_name}'}</code>{' '}
            <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{'{coach_name}'}</code>{' '}
            <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{'{flag_reason}'}</code> (Normal only).
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="text-sm font-semibold px-4 py-2 rounded-xl text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Urgent */}
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Urgent</h2>
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={templates.urgent_enabled}
              onChange={e => setTemplates({ ...templates, urgent_enabled: e.target.checked })}
              className="rounded"
            />
            Send automatically
          </label>
        </div>
        <p className="text-xs text-gray-400">Sent when a question flagged Urgent fires, or the self-harm/disordered-eating keyword scan matches.</p>
        <UrgentWatchlistNote />
        <textarea
          value={templates.urgent_template}
          onChange={e => setTemplates({ ...templates, urgent_template: e.target.value })}
          rows={8}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none resize-y"
        />
      </div>

      {/* Normal */}
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Normal</h2>
        <p className="text-xs text-gray-400">Sent when one or more questions flagged Normal with "send an automated message" on and a category selected fire. Up to 2 categories combine into {'{flag_reason}'}, by priority order below.</p>
        <textarea
          value={templates.normal_template}
          onChange={e => setTemplates({ ...templates, normal_template: e.target.value })}
          rows={4}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none resize-y"
        />
        <div className="pt-2 border-t border-gray-100 space-y-2.5">
          <p className="text-xs font-medium text-gray-600">Category snippets — fill in {'{flag_reason}'}, highest priority first</p>
          {FLAG_CATEGORY_PRIORITY.map((cat, i) => (
            <div key={cat} className="flex items-start gap-2.5">
              <span className="text-xs text-gray-400 w-5 flex-shrink-0 pt-2">{i + 1}.</span>
              <div className="flex-1 space-y-1">
                <p className="text-xs font-medium text-gray-700">{FLAG_CATEGORY_LABELS[cat]}</p>
                <input
                  value={templates.category_snippets[cat] ?? ''}
                  onChange={e => setTemplates({ ...templates, category_snippets: { ...templates.category_snippets, [cat]: e.target.value } })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          ))}
          {templates.custom_categories.map((cat, i) => (
            <div key={cat.id} className="flex items-start gap-2.5">
              <span className="text-xs text-gray-400 w-5 flex-shrink-0 pt-2">{FLAG_CATEGORY_PRIORITY.length + i + 1}.</span>
              <div className="flex-1 space-y-1">
                <p className="text-xs font-medium text-gray-700">{cat.label} <span className="text-gray-400 font-normal">(custom)</span></p>
                <input
                  value={templates.category_snippets[cat.id] ?? ''}
                  onChange={e => setTemplates({ ...templates, category_snippets: { ...templates.category_snippets, [cat.id]: e.target.value } })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setTemplates({ ...templates, custom_categories: templates.custom_categories.filter((c) => c.id !== cat.id) })}
                className="text-gray-300 hover:text-red-400 transition-colors mt-1.5 flex-shrink-0"
                title="Remove this category"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <AddCustomCategory
            existingIds={[...FLAG_CATEGORY_PRIORITY, ...templates.custom_categories.map((c) => c.id)]}
            onAdd={(cat) => setTemplates({ ...templates, custom_categories: [...templates.custom_categories, cat] })}
          />
          <p className="text-[11px] text-gray-400">Custom categories always combine last — after the 6 built-in ones above, lowest priority.</p>
        </div>
      </div>

      {/* Lead */}
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Lead</h2>
        <p className="text-xs text-gray-400">Sent when a question flagged Lead with "send an automated message" on fires (e.g. a client saying they want to keep going). Can send alongside a Normal message on the same check-in.</p>
        <textarea
          value={templates.lead_template}
          onChange={e => setTemplates({ ...templates, lead_template: e.target.value })}
          rows={4}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none resize-y"
        />
      </div>
    </main>
  )
}
