'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type QuestionType = 'text' | 'textarea' | 'number' | 'radio' | 'checkbox' | 'dropdown' | 'file_upload' | 'image'

type Question = {
  id: string | null   // null = not yet saved
  order_index: number
  label: string
  description: string | null
  type: QuestionType
  options: string[] | null
  required: boolean
  _dirty?: boolean
}

type FormMeta = {
  title: string
  description: string
  type: 'onboarding' | 'weekly_checkin' | 'custom'
  is_active: boolean
}

const TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  radio: 'Single choice',
  checkbox: 'Multiple choice',
  dropdown: 'Dropdown',
  file_upload: 'File upload',
  image: 'Image',
}

export default function FormBuilderPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = use(params)
  const router = useRouter()
  const isNew = formId === 'new'

  const [meta, setMeta] = useState<FormMeta>({ title: '', description: '', type: 'weekly_checkin', is_active: true })
  const [questions, setQuestions] = useState<Question[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : formId)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/forms/${formId}`)
      .then((r) => r.json())
      .then((d) => {
        setMeta({ title: d.title, description: d.description ?? '', type: d.type, is_active: d.is_active })
        // Normalise questions from DB: convert legacy 'select' → 'radio', ensure options is always array|null
        const qs = (d.questions ?? []).map((q: Question) => ({
          ...q,
          type: q.type === 'select' ? 'radio' : q.type,
          options: Array.isArray(q.options) ? q.options
            : typeof q.options === 'string' ? (() => { try { const p = JSON.parse(q.options as unknown as string); return Array.isArray(p) ? p : null } catch { return null } })()
            : null,
        }))
        setQuestions(qs)
        setLoading(false)
      })
  }, [formId, isNew])

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      { id: null, order_index: prev.length, label: '', description: null, type: 'text', options: null, required: false, _dirty: true },
    ])
  }

  function updateQuestion(idx: number, patch: Partial<Question>) {
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, ...patch, _dirty: true } : q))
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_index: i })))
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    const next = [...questions]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setQuestions(next.map((q, i) => ({ ...q, order_index: i, _dirty: true })))
  }

  async function handleSave() {
    if (!meta.title.trim()) { setError('Form title is required'); return }
    setSaving(true)
    setError(null)

    // 1. Create or update form
    let fId = savedId
    if (!fId) {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error); setSaving(false); return }
      fId = d.id
      setSavedId(fId)
    } else {
      await fetch(`/api/forms/${fId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      })
    }

    // 2. Save questions
    for (const [i, q] of questions.entries()) {
      if (!q._dirty) continue
      if (!q.id) {
        // New question
        await fetch(`/api/forms/${fId}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...q, order_index: i }),
        })
      } else {
        await fetch(`/api/forms/questions/${q.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...q, order_index: i }),
        })
      }
    }

    // 3. Delete removed questions (handled inline via removeQuestion + API)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    if (isNew && fId) router.replace(`/coach/forms/${fId}/edit`)
  }

  async function handleDeleteQuestion(idx: number) {
    const q = questions[idx]
    if (q.id) {
      await fetch(`/api/forms/questions/${q.id}`, { method: 'DELETE' })
    }
    removeQuestion(idx)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><p className="text-gray-400 text-sm">Loading…</p></div>

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/coach/forms" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-gray-900">{isNew ? 'New form' : 'Edit form'}</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save form'}
        </button>
      </div>

      <main className="max-w-2xl mx-auto w-full p-6 space-y-6">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

        {/* Form metadata */}
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Form title</label>
            <input
              value={meta.title}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              placeholder="e.g. Weekly Check-In"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={meta.description}
              onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
              rows={2}
              placeholder="Instructions for your clients…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Form type</label>
              <select
                value={meta.type}
                onChange={(e) => setMeta((m) => ({ ...m, type: e.target.value as FormMeta['type'] }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="onboarding">Onboarding</option>
                <option value="weekly_checkin">Weekly check-in</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meta.is_active}
                  onChange={(e) => setMeta((m) => ({ ...m, is_active: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <QuestionCard
              key={idx}
              q={q}
              idx={idx}
              total={questions.length}
              onChange={(patch) => updateQuestion(idx, patch)}
              onDelete={() => handleDeleteQuestion(idx)}
              onMove={(dir) => moveQuestion(idx, dir)}
            />
          ))}
        </div>

        <button
          onClick={addQuestion}
          className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          + Add question
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-3 rounded-2xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save form'}
        </button>
      </main>
    </div>
  )
}

function QuestionCard({
  q, idx, total, onChange, onDelete, onMove,
}: {
  q: Question
  idx: number
  total: number
  onChange: (patch: Partial<Question>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [optionInput, setOptionInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  function addOption() {
    const val = optionInput.trim()
    if (!val) return
    const current = Array.isArray(q.options) ? q.options : []
    onChange({ options: [...current, val] })
    setOptionInput('')
  }

  function removeOption(i: number) {
    const current = Array.isArray(q.options) ? q.options : []
    onChange({ options: current.filter((_, j) => j !== i) })
  }

  async function handleImageUpload(file: File) {
    setUploading(true)
    setUploadError(null)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `forms/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('form-images').upload(path, file, { upsert: true })
    if (error) { setUploadError(error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('form-images').getPublicUrl(data.path)
    onChange({ options: [publicUrl] })
    setUploading(false)
  }

  const imageUrl = q.type === 'image' ? q.options?.[0] ?? null : null

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white'

  return (
    <div className="bg-white rounded-2xl border p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 pt-1">
          <button onClick={() => onMove(-1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button onClick={() => onMove(1)} disabled={idx === total - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        <div className="flex-1 space-y-2">
          <input
            value={q.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={q.type === 'image' ? 'Caption (optional)…' : 'Question…'}
            className={inputClass}
          />
          {q.type !== 'image' && (
            <input
              value={q.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value || null })}
              placeholder="Description (optional)…"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white placeholder:text-gray-300"
            />
          )}

          <div className="flex gap-2">
            <select
              value={q.type}
              onChange={(e) => {
                const t = e.target.value as QuestionType
                onChange({ type: t, options: (t === 'radio' || t === 'checkbox' || t === 'dropdown') ? (q.options ?? []) : null })
              }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {q.type !== 'image' && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => onChange({ required: e.target.checked })}
                  className="rounded"
                />
                Required
              </label>
            )}
          </div>

          {(q.type === 'radio' || q.type === 'checkbox' || q.type === 'dropdown') && (
            <div className="space-y-1.5">
              {(Array.isArray(q.options) ? q.options : []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">{opt}</span>
                  <button onClick={() => removeOption(i)} className="text-gray-300 hover:text-red-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                  placeholder="Add option…"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button onClick={addOption} className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2">Add</button>
              </div>
            </div>
          )}

          {q.type === 'file_upload' && (
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Client will be prompted to upload a file. Uploads save automatically to their profile.
            </p>
          )}

          {q.type === 'image' && (
            <div className="space-y-2">
              {imageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Form image" className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-gray-50" />
                  <button
                    onClick={() => onChange({ options: null })}
                    className="absolute top-2 right-2 bg-white border border-gray-200 rounded-lg p-1 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-6 cursor-pointer transition-colors ${uploading ? 'border-blue-200 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                  {uploading ? (
                    <p className="text-xs text-blue-500 font-medium">Uploading…</p>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs text-gray-400">Click to upload an image</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
                    className="sr-only"
                  />
                </label>
              )}
              {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
            </div>
          )}
        </div>

        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 mt-1 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  )
}
