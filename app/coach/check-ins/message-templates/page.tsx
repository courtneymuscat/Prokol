'use client'

import { useEffect, useState } from 'react'
import { FLAG_CATEGORY_PRIORITY, FLAG_CATEGORY_LABELS, type FlagCategory } from '@/lib/checkinFlags'

type Templates = {
  urgent_template: string
  urgent_enabled: boolean
  normal_template: string
  lead_template: string
  category_snippets: Record<string, string>
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
          {FLAG_CATEGORY_PRIORITY.map((cat: FlagCategory, i) => (
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
