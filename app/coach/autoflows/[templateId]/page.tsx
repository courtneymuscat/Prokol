'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = 'text' | 'textarea' | 'scale' | 'yesno' | 'choice' | 'note'

type Question = {
  id: string
  type: QuestionType
  label: string
  required: boolean
  description?: string
  options?: string[]
}

type Task = {
  id: string
  label: string
  link_type?: 'resource' | 'form' | 'url' | null
  link_url?: string | null
  link_label?: string | null
}

type Step = {
  step_number: number
  title: string
  description: string
  questions: Question[]
  day_offset: number
  resource_ids: string[]
  form_id: string | null
  tasks: Task[]
}

type Template = {
  id: string
  name: string
  description: string
  type: string
  total_steps: number
  core_questions: Question[]
  steps: Step[]
}

type CoachResource = {
  id: string
  name: string
  type: string
  coach_resource_folders: { name: string; icon: string } | null
}

type CoachForm = {
  id: string
  title: string
  type: string
}

const TYPE_LABELS: Record<Exclude<QuestionType, 'note'>, string> = {
  text: 'Short answer',
  textarea: 'Long answer',
  scale: 'Scale 1–10',
  yesno: 'Yes / No',
  choice: 'Multiple choice',
}

// ── Question builder ───────────────────────────────────────────────────────────

function QuestionCard({
  q,
  onChange,
  onDelete,
}: {
  q: Question
  onChange: (q: Question) => void
  onDelete: () => void
}) {
  const isNote = q.type === 'note'

  if (isNote) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Note</span>
              <span className="text-xs text-amber-600">Shown as info text — no answer required</span>
            </div>
            <textarea
              value={q.label}
              onChange={e => onChange({ ...q, label: e.target.value })}
              placeholder="Write your note here…"
              rows={3}
              className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 focus:outline-none bg-white resize-none"
            />
          </div>
          <button onClick={onDelete} className="text-amber-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <input
            value={q.label}
            onChange={e => onChange({ ...q, label: e.target.value })}
            placeholder="Question text…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <select
              value={q.type}
              onChange={e => onChange({ ...q, type: e.target.value as QuestionType })}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={q.required}
                onChange={e => onChange({ ...q, required: e.target.checked })}
                className="rounded"
              />
              Required
            </label>
          </div>
          {/* Optional description / helper text */}
          <input
            value={q.description ?? ''}
            onChange={e => onChange({ ...q, description: e.target.value || undefined })}
            placeholder="Add a description or helper text (optional)…"
            className="w-full text-xs border border-gray-100 rounded-lg px-3 py-1.5 focus:outline-none text-gray-500 bg-gray-50"
          />
          {q.type === 'choice' && (
            <div className="space-y-1.5 pl-1">
              {(q.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={e => {
                      const opts = [...(q.options ?? [])]
                      opts[i] = e.target.value
                      onChange({ ...q, options: opts })
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                  />
                  <button
                    onClick={() => onChange({ ...q, options: (q.options ?? []).filter((_, j) => j !== i) })}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <button
                onClick={() => onChange({ ...q, options: [...(q.options ?? []), ''] })}
                className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
              >
                + Add option
              </button>
            </div>
          )}
        </div>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  )
}

function QuestionList({
  questions,
  onChange,
  emptyText,
}: {
  questions: Question[]
  onChange: (qs: Question[]) => void
  emptyText: string
}) {
  const addQuestion = () => {
    onChange([...questions, { id: crypto.randomUUID(), type: 'text', label: '', required: false }])
  }
  const addNote = () => {
    onChange([...questions, { id: crypto.randomUUID(), type: 'note', label: '', required: false }])
  }

  return (
    <div className="space-y-2">
      {questions.length === 0 && (
        <p className="text-xs text-gray-400 py-2">{emptyText}</p>
      )}
      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          q={q}
          onChange={updated => {
            const qs = [...questions]
            qs[i] = updated
            onChange(qs)
          }}
          onDelete={() => onChange(questions.filter((_, j) => j !== i))}
        />
      ))}
      <div className="flex gap-2">
        <button
          onClick={addQuestion}
          className="flex-1 text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl py-2.5 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          + Add question
        </button>
        <button
          onClick={addNote}
          className="flex-1 text-xs text-amber-600 border border-dashed border-amber-200 rounded-xl py-2.5 hover:border-amber-400 hover:text-amber-700 bg-amber-50/50 transition-colors"
        >
          + Add note
        </button>
      </div>
    </div>
  )
}

// ── Task card ─────────────────────────────────────────────────────────────────

const LINK_TYPE_META = {
  resource: { label: '📚 Resource', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  form:     { label: '📋 Form',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
  url:      { label: '🔗 Link',     color: 'bg-gray-50 text-gray-600 border-gray-200' },
} as const

function TaskCard({ task, onChange, onDelete, resources, forms }: {
  task: Task
  onChange: (t: Task) => void
  onDelete: () => void
  resources: CoachResource[]
  forms: CoachForm[]
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [linkMode, setLinkMode] = useState<'resource' | 'form' | 'url'>('url')
  const [urlInput, setUrlInput] = useState(task.link_type === 'url' ? (task.link_url ?? '') : '')

  const hasLink = !!task.link_type

  function removeLink() {
    onChange({ ...task, link_type: null, link_url: null, link_label: null })
    setShowPicker(false)
    setUrlInput('')
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm flex-shrink-0">☐</span>
        <input
          value={task.label}
          onChange={e => onChange({ ...task, label: e.target.value })}
          placeholder="Task description…"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none"
        />
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Existing link */}
      {hasLink && !showPicker && (
        <div className="flex items-center gap-2 pl-5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${LINK_TYPE_META[task.link_type!].color}`}>
            {LINK_TYPE_META[task.link_type!].label}
          </span>
          <span className="text-xs text-gray-600 truncate flex-1">{task.link_label || task.link_url}</span>
          <button onClick={removeLink} className="text-gray-300 hover:text-red-400 flex-shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Attach button */}
      {!hasLink && !showPicker && (
        <button
          onClick={() => setShowPicker(true)}
          className="pl-5 text-xs text-gray-400 hover:text-blue-500 transition-colors"
        >
          + Attach resource, form, or link
        </button>
      )}

      {/* Picker */}
      {showPicker && (
        <div className="pl-5 space-y-2">
          <div className="flex gap-1">
            {(['resource', 'form', 'url'] as const).map(m => (
              <button
                key={m}
                onClick={() => setLinkMode(m)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${linkMode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {m === 'resource' ? '📚 Resource' : m === 'form' ? '📋 Form' : '🔗 URL'}
              </button>
            ))}
          </div>

          {linkMode === 'resource' && (
            resources.length === 0 ? (
              <p className="text-xs text-gray-400">No resources yet. <a href="/coach/resources" target="_blank" className="text-blue-500 underline">Add some →</a></p>
            ) : (
              <select
                defaultValue=""
                onChange={e => {
                  const r = resources.find(r => r.id === e.target.value)
                  if (!r) return
                  onChange({ ...task, link_type: 'resource', link_url: null, link_label: r.name })
                  setShowPicker(false)
                }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none bg-white"
              >
                <option value="" disabled>Select a resource…</option>
                {resources.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.type === 'link' ? '🔗' : r.type === 'video' ? '🎬' : r.type === 'pdf' ? '📄' : '📝'} {r.name}
                    {r.coach_resource_folders ? ` · ${r.coach_resource_folders.name}` : ''}
                  </option>
                ))}
              </select>
            )
          )}

          {linkMode === 'form' && (
            forms.length === 0 ? (
              <p className="text-xs text-gray-400">No forms yet. <a href="/coach/forms" target="_blank" className="text-blue-500 underline">Create one →</a></p>
            ) : (
              <select
                defaultValue=""
                onChange={e => {
                  const f = forms.find(f => f.id === e.target.value)
                  if (!f) return
                  onChange({ ...task, link_type: 'form', link_url: `/forms/${f.id}`, link_label: f.title })
                  setShowPicker(false)
                }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none bg-white"
              >
                <option value="" disabled>Select a form…</option>
                {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            )
          )}

          {linkMode === 'url' && (
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none"
              />
              <button
                onClick={() => {
                  if (!urlInput.trim()) return
                  onChange({ ...task, link_type: 'url', link_url: urlInput.trim(), link_label: null })
                  setShowPicker(false)
                }}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                disabled={!urlInput.trim()}
              >
                Attach
              </button>
            </div>
          )}

          <button onClick={() => setShowPicker(false)} className="text-xs text-gray-400 hover:text-gray-600">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main editor ────────────────────────────────────────────────────────────────

export default function AutoflowTemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = use(params)
  const router = useRouter()
  const isNew = templateId === 'new'

  const [template, setTemplate] = useState<Template | null>(null)
  const [activeStep, setActiveStep] = useState<number>(1)
  const [tab, setTab] = useState<'core' | 'steps'>('core')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [resources, setResources] = useState<CoachResource[]>([])
  const [forms, setForms] = useState<CoachForm[]>([])

  // New template state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('weekly_checkin')
  const [newSteps, setNewSteps] = useState('12')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/coach/autoflows/${templateId}`)
        .then(r => r.json())
        .then(d => {
        if (!d.error) setTemplate({
          ...d,
          steps: (d.steps ?? []).map((s: Step) => ({
            ...s,
            resource_ids: s.resource_ids ?? [],
            form_id: s.form_id ?? null,
            tasks: s.tasks ?? [],
          })),
        })
      })
        .finally(() => setLoading(false))
    }
    // Load resources + forms for step linking
    Promise.all([
      fetch('/api/coach/resources').then(r => r.json()),
      fetch('/api/forms').then(r => r.json()),
    ]).then(([res, frm]) => {
      setResources(Array.isArray(res) ? res : [])
      setForms(Array.isArray(frm) ? frm : [])
    })
  }, [templateId, isNew])

  async function createTemplate() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/coach/autoflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, type: newType, total_steps: parseInt(newSteps) || 12 }),
    })
    const d = await res.json()
    if (d.id) router.replace(`/coach/autoflows/${d.id}`)
    else setCreating(false)
  }

  async function save() {
    if (!template) return
    setSaving(true)
    await fetch(`/api/coach/autoflows/${template.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: template.name,
        description: template.description,
        core_questions: template.core_questions,
        steps: template.steps,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function duplicateTemplate() {
    if (!template) return
    const res = await fetch(`/api/coach/autoflows/${template.id}/duplicate`, { method: 'POST' })
    const d = await res.json()
    if (d.id) router.push(`/coach/autoflows/${d.id}`)
  }

  async function deleteTemplate() {
    if (!template) return
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return
    await fetch(`/api/coach/autoflows/${template.id}`, { method: 'DELETE' })
    router.push('/coach/autoflows')
  }

  function updateStep(stepNum: number, patch: Partial<Step>) {
    if (!template) return
    setTemplate({
      ...template,
      steps: template.steps.map(s =>
        s.step_number === stepNum
          ? { ...s, resource_ids: s.resource_ids ?? [], form_id: s.form_id ?? null, tasks: s.tasks ?? [], ...patch }
          : s
      ),
    })
  }

  // ── New template creation form ────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
          <a href="/coach/autoflows" className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </a>
          <h1 className="text-lg font-bold text-gray-900">New Autoflow</h1>
        </div>
        <main className="max-w-lg mx-auto w-full p-6 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Flow name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. 12-Week Check-in, New Client Onboarding"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'weekly_checkin', label: 'Weekly Check-in', desc: 'Repeating weekly or fortnightly check-ins with progress questions' },
                  { value: 'onboarding', label: 'Onboarding', desc: 'Multi-stage onboarding flow (day 0, 3, 7, 14…)' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setNewType(opt.value)
                      setNewSteps(opt.value === 'onboarding' ? '4' : '12')
                    }}
                    className={`text-left rounded-xl border p-3 transition-colors ${newType === opt.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Number of {newType === 'onboarding' ? 'stages' : 'weeks'}
              </label>
              <input
                type="number"
                min={1}
                max={52}
                value={newSteps}
                onChange={e => setNewSteps(e.target.value)}
                className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                {newType === 'onboarding'
                  ? 'Stages are spaced at days 0, 3, 7, 14 by default — you can customise offsets after creation.'
                  : 'Steps will be spaced 7 days apart. You can adjust offsets after creation.'}
              </p>
            </div>
            <button
              onClick={createTemplate}
              disabled={!newName.trim() || creating}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating…' : 'Create & edit →'}
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Template not found.</p>
      </div>
    )
  }

  const currentStep = template.steps.find(s => s.step_number === activeStep)

  // ── Editor ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/coach/autoflows" className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </a>
          <input
            value={template.name}
            onChange={e => setTemplate({ ...template, name: e.target.value })}
            className="text-lg font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 min-w-0"
          />
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize flex-shrink-0">
            {template.type === 'weekly_checkin' ? 'Weekly check-in' : 'Onboarding'} · {template.total_steps} steps
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={duplicateTemplate}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 flex items-center gap-1"
            title="Duplicate this flow"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Duplicate
          </button>
          <button
            onClick={deleteTemplate}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2"
          >
            Delete
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: tab selector */}
        <aside className="w-56 bg-white border-r flex-shrink-0 p-3 space-y-0.5">
          <button
            onClick={() => setTab('core')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'core' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Core questions
            <p className="text-xs font-normal text-gray-400 mt-0.5">{template.core_questions.length} questions — shown every step</p>
          </button>
          <div className="pt-2 pb-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3">Steps</p>
          </div>
          {template.steps.map(s => (
            <button
              key={s.step_number}
              onClick={() => { setActiveStep(s.step_number); setTab('steps') }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${tab === 'steps' && activeStep === s.step_number ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {s.title || `Step ${s.step_number}`}
              <span className="text-[11px] text-gray-400 ml-1">· day {s.day_offset}</span>
            </button>
          ))}
        </aside>

        {/* Right: editor panel */}
        <main className="flex-1 overflow-y-auto p-6">
          {tab === 'core' && (
            <div className="max-w-2xl space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Core questions</h2>
                <p className="text-xs text-gray-500 mt-0.5">These appear on every step of this flow, before the step-specific questions.</p>
              </div>
              <QuestionList
                questions={template.core_questions}
                onChange={qs => setTemplate({ ...template, core_questions: qs })}
                emptyText="No core questions yet. Add questions that apply to every check-in."
              />
            </div>
          )}

          {tab === 'steps' && currentStep && (
            <div className="max-w-2xl space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Step title</label>
                    <input
                      value={currentStep.title}
                      onChange={e => updateStep(activeStep, { title: e.target.value })}
                      placeholder={`Step ${activeStep}`}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                    <textarea
                      value={currentStep.description ?? ''}
                      onChange={e => updateStep(activeStep, { description: e.target.value })}
                      placeholder="Optional intro text shown to the client…"
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Send on day <span className="text-gray-400 font-normal">(from flow start date)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={currentStep.day_offset}
                      onChange={e => updateStep(activeStep, { day_offset: parseInt(e.target.value) || 0 })}
                      className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Step-specific questions</h3>
                <p className="text-xs text-gray-500 mb-3">These are unique to this step. Core questions always appear above these.</p>
                <QuestionList
                  questions={currentStep.questions}
                  onChange={qs => updateStep(activeStep, { questions: qs })}
                  emptyText="No step-specific questions. Core questions will still appear."
                />
              </div>

              {/* Tasks checklist */}
              <div className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-white">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Tasks</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Checklist items the client ticks off as part of this step.</p>
                </div>
                <div className="space-y-2">
                  {(currentStep.tasks ?? []).map((task, i) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      resources={resources}
                      forms={forms}
                      onChange={updated => {
                        const tasks = [...(currentStep.tasks ?? [])]
                        tasks[i] = updated
                        updateStep(activeStep, { tasks })
                      }}
                      onDelete={() => updateStep(activeStep, { tasks: (currentStep.tasks ?? []).filter((_, j) => j !== i) })}
                    />
                  ))}
                  <button
                    onClick={() => updateStep(activeStep, { tasks: [...(currentStep.tasks ?? []), { id: crypto.randomUUID(), label: '' }] })}
                    className="text-xs text-gray-500 hover:text-gray-800 border border-dashed border-gray-200 rounded-xl py-2 px-3 w-full transition-colors">
                    + Add task
                  </button>
                </div>
              </div>

              {/* Resources */}
              <div className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-white">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Resources</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Resources from your library to share with the client in this step.</p>
                </div>
                {resources.length === 0 ? (
                  <p className="text-xs text-gray-400">No resources in your library yet. <a href="/coach/resources" target="_blank" className="text-blue-500 underline">Add resources →</a></p>
                ) : (
                  <div className="space-y-1.5">
                    {resources.map(r => {
                      const selected = (currentStep.resource_ids ?? []).includes(r.id)
                      return (
                        <label key={r.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="checkbox" checked={selected} onChange={e => {
                            const ids = currentStep.resource_ids ?? []
                            updateStep(activeStep, { resource_ids: e.target.checked ? [...ids, r.id] : ids.filter(id => id !== r.id) })
                          }} className="rounded accent-blue-600" />
                          <span className="text-sm">{r.type === 'link' ? '🔗' : r.type === 'video' ? '🎬' : r.type === 'pdf' ? '📄' : '📝'}</span>
                          <span className="text-sm font-medium text-gray-900 flex-1 truncate">{r.name}</span>
                          {r.coach_resource_folders && (
                            <span className="text-xs text-gray-400 flex-shrink-0">{r.coach_resource_folders.icon} {r.coach_resource_folders.name}</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Linked form */}
              <div className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-white">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Linked form</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Attach a form for the client to fill out as part of this step.</p>
                </div>
                {forms.length === 0 ? (
                  <p className="text-xs text-gray-400">No forms yet. <a href="/coach/forms" target="_blank" className="text-blue-500 underline">Create a form →</a></p>
                ) : (
                  <select
                    value={currentStep.form_id ?? ''}
                    onChange={e => updateStep(activeStep, { form_id: e.target.value || null })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                  >
                    <option value="">No form linked</option>
                    {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
