'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type QuestionType = 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'dropdown' | 'file_upload' | 'image'

type Question = {
  id: string
  order_index: number
  label: string
  description: string | null
  type: QuestionType
  options: string[] | null
  required: boolean
}

type FormData = {
  title: string
  description: string | null
  type: string
  questions: Question[]
}

export default function FormFillPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = use(params)
  const router = useRouter()

  const [form, setForm] = useState<FormData | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checkboxAnswers, setCheckboxAnswers] = useState<Record<string, string[]>>({})
  const [fileAnswers, setFileAnswers] = useState<Record<string, File>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/forms/${formId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setForm(d)
        setLoading(false)
      })
  }, [formId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validate required
    for (const q of form?.questions ?? []) {
      if (q.type === 'image') continue
      if (q.required) {
        if (q.type === 'file_upload' && !fileAnswers[q.id]) {
          setError(`"${q.label}" requires a file upload.`)
          return
        } else if (q.type === 'checkbox' && !(checkboxAnswers[q.id]?.length)) {
          setError(`"${q.label}" requires at least one selection.`)
          return
        } else if (q.type !== 'file_upload' && q.type !== 'checkbox' && !answers[q.id]?.trim()) {
          setError(`"${q.label}" is required.`)
          return
        }
      }
    }

    setSubmitting(true)

    // Upload any files to Supabase Storage
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const finalAnswers = { ...answers }
    // Serialize checkbox selections as JSON
    for (const [qId, selected] of Object.entries(checkboxAnswers)) {
      if (selected.length) finalAnswers[qId] = JSON.stringify(selected)
    }

    for (const [questionId, file] of Object.entries(fileAnswers)) {
      const ext = file.name.split('.').pop()
      const path = `${user?.id ?? 'anon'}/${formId}/${questionId}-${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('client-uploads')
        .upload(path, file, { upsert: true })
      if (uploadErr) {
        setError(`File upload failed: ${uploadErr.message}`)
        setSubmitting(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('client-uploads').getPublicUrl(uploadData.path)
      finalAnswers[questionId] = publicUrl
    }

    const res = await fetch(`/api/forms/${formId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: finalAnswers }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Submission failed')
      setSubmitting(false)
      return
    }
    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading form…</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Submitted!</h2>
          <p className="text-gray-500 text-sm">Your response has been sent to your coach.</p>
          <a href="/dashboard" className="inline-block mt-2 text-sm font-medium text-blue-600 hover:underline">
            Back to dashboard
          </a>
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-700 font-medium">{error ?? 'Form not found.'}</p>
          <a href="/dashboard" className="text-sm text-blue-600 hover:underline mt-2 block">Go to dashboard</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border p-6">
          <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
          {form.description && (
            <p className="text-gray-500 text-sm mt-2">{form.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {(form.questions ?? []).map((q) => {
            if (q.type === 'image') {
              const src = q.options?.[0]
              if (!src) return null
              return (
                <div key={q.id} className="bg-white rounded-2xl border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={q.label || 'Form image'} className="w-full object-contain max-h-80" />
                  {q.label && (
                    <p className="text-xs text-gray-500 text-center px-4 py-2 border-t">{q.label}</p>
                  )}
                </div>
              )
            }

            return (
            <div key={q.id} className="bg-white rounded-2xl border p-5 space-y-2">
              <div>
                <label className="block text-sm font-semibold text-gray-800">
                  {q.label}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {q.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{q.description}</p>
                )}
              </div>

              {q.type === 'text' && (
                <input
                  type="text"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {q.type === 'textarea' && (
                <textarea
                  rows={3}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              )}

              {q.type === 'number' && (
                <input
                  type="number"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {(q.type === 'select' || q.type === 'radio') && (
                <div className="space-y-2">
                  {(q.options ?? []).map((opt) => (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${answers[q.id] === opt ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
                        {answers[q.id] === opt && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700">{opt}</span>
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'checkbox' && (
                <div className="space-y-2">
                  {(q.options ?? []).map((opt) => {
                    const selected = checkboxAnswers[q.id] ?? []
                    const checked = selected.includes(opt)
                    return (
                      <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{opt}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setCheckboxAnswers((prev) => {
                              const cur = prev[q.id] ?? []
                              return { ...prev, [q.id]: checked ? cur.filter((o) => o !== opt) : [...cur, opt] }
                            })
                          }}
                          className="sr-only"
                        />
                      </label>
                    )
                  })}
                </div>
              )}

              {q.type === 'dropdown' && (
                <select
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select an option…</option>
                  {(q.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {q.type === 'file_upload' && (
                <div className="space-y-1.5">
                  <input
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) setFileAnswers((prev) => ({ ...prev, [q.id]: f }))
                    }}
                    className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {fileAnswers[q.id] && (
                    <p className="text-xs text-green-600">{fileAnswers[q.id].name} ready to upload</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-2xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  )
}
