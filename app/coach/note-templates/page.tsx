'use client'

import { useState, useEffect } from 'react'

type Template = { id: string; name: string; body: string; created_at: string }

const STARTER_TEMPLATES = [
  {
    name: 'Weekly Check-In Review',
    body: `## Weekly Check-In Review

**Date:**

### Sleep & Recovery
- Sleep hours:
- Sleep quality:
- Recovery notes:

### Energy & Mood
- Energy level:
- Mood:

### Nutrition
- Adherence to plan:
- Highlights:
- Challenges:

### Training
- Sessions completed:
- Performance notes:

### Goal Progress
- Progress toward main goal:
- Mini goals completed:

### Adjustments for Next Week
-

### Coach Notes
`,
  },
  {
    name: 'Initial Assessment',
    body: `## Initial Assessment

**Date:**
**Client:**

### Current Stats
- Age:
- Weight:
- Height:

### Primary Goal


### Secondary Goals


### Dietary Background
- Current eating habits:
- Dietary restrictions / preferences:
- Previous diets tried:

### Training Background
- Current activity level:
- Training history:
- Injuries / limitations:

### Lifestyle
- Occupation / activity at work:
- Stress levels:
- Sleep:

### Action Plan
1.
2.
3.

### Notes
`,
  },
  {
    name: 'Progress Note',
    body: `## Progress Note

**Date:**
**Week:**

### Measurements / Stats
- Weight:
- Other metrics:

### What's Working Well


### Challenges / Obstacles


### Adjustments to Plan
- Nutrition:
- Training:
- Habits:

### Next Steps
1.
2.
3.

### Motivational Notes
`,
  },
  {
    name: 'Nutrition Review',
    body: `## Nutrition Review

**Date:**
**Review period:**

### Calorie & Macro Summary
- Average calories:
- Average protein:
- Average carbs:
- Average fat:

### Meal Timing & Patterns


### Food Quality Notes


### Areas for Improvement


### Recommendations
1.
2.
3.

### Notes
`,
  },
  {
    name: 'Client Check-In Summary',
    body: `## Client Check-In Summary

**Date:**
**Client:**
**Week:**

### Training
- Sessions completed:
- Performance notes:
- PRs / highlights:
- Struggles:

### Nutrition Summary
- Adherence to plan:
- Average calories:
- Average protein:
- Highlights:
- Challenges:

### Wins This Week


### Barriers & Strategies
- Barriers:
- Strategies for next time:

### Updates
- Life changes / schedule shifts:
- Injuries or limitations:

### Actions for Next Week
1.
2.
3.

### Coach Notes
`,
  },
]

export default function NoteTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    fetch('/api/coach/note-templates')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setBody('')
    setError(null)
    setCreating(true)
  }

  function openEdit(t: Template) {
    setCreating(false)
    setName(t.name)
    setBody(t.body)
    setError(null)
    setEditing(t)
  }

  function closePanel() {
    setCreating(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!name.trim() || !body.trim()) { setError('Name and body are required'); return }
    setSaving(true); setError(null)
    if (editing) {
      const res = await fetch(`/api/coach/note-templates/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t))
        closePanel()
      } else setError('Failed to save')
    } else {
      const res = await fetch('/api/coach/note-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body }),
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

  async function seedStarters() {
    setSeeding(true)
    const created: Template[] = []
    for (const t of STARTER_TEMPLATES) {
      const res = await fetch('/api/coach/note-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      })
      if (res.ok) created.push(await res.json())
    }
    setTemplates((prev) => [...prev, ...created])
    setSeeding(false)
  }

  const panelOpen = creating || !!editing

  return (
    <main className="flex-1 p-6 max-w-5xl w-full">
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
            <div className="bg-white rounded-2xl border p-8 text-center space-y-4">
              <p className="text-gray-600 font-medium">No templates yet</p>
              <p className="text-gray-400 text-sm">Create your own or add starter templates to get going quickly.</p>
              <button onClick={seedStarters} disabled={seeding}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors">
                {seeding ? 'Adding…' : '+ Add starter templates'}
              </button>
            </div>
          )}

          {!loading && templates.length > 0 && (
            <>
              {templates.map((t) => (
                <div key={t.id}
                  className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-sm ${editing?.id === t.id ? 'border-blue-400 bg-blue-50' : ''}`}
                  onClick={() => openEdit(t)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 whitespace-pre-line">{t.body.slice(0, 120)}…</p>
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
              <button onClick={seedStarters} disabled={seeding}
                className="text-xs text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50">
                {seeding ? 'Adding…' : '+ Add starter templates'}
              </button>
            </>
          )}
        </div>

        {/* Editor panel */}
        {panelOpen && (
          <div className="w-96 flex-shrink-0 bg-white rounded-2xl border p-5 space-y-4 self-start sticky top-6">
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

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Body</label>
              <p className="text-xs text-gray-400 mb-1.5">Use ## for headings, ### for subheadings, **bold** for labels.</p>
              <textarea value={body} onChange={(e) => setBody(e.target.value)}
                rows={18}
                placeholder={'## Note Title\n\n### Section 1\n\n### Section 2\n'}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
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
