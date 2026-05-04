'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SignaturePad from '../SignaturePad'

type QuestionType = 'text' | 'textarea' | 'number' | 'scale' | 'yesno' | 'select' | 'radio' | 'checkbox' | 'dropdown' | 'file_upload' | 'image' | 'signature'

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
  const [signatureAnswers, setSignatureAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [existingSubmissionId, setExistingSubmissionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [formRes, subRes] = await Promise.all([
          fetch(`/api/forms/${formId}`),
          fetch(`/api/forms/${formId}/my-submission`),
        ])
        const formData = await formRes.json()
        if (formData.error) { setError(formData.error); return }
        setForm(formData)

        if (subRes.ok) {
          const subData = await subRes.json()
          if (subData.submission_id) {
            setExistingSubmissionId(subData.submission_id)
            setIsEditing(true)
            const preAnswers: Record<string, string> = {}
            const preCheckbox: Record<string, string[]> = {}
            const preSig: Record<string, string> = {}
            const sigQIds = new Set((formData.questions ?? []).filter((q: { type: string }) => q.type === 'signature').map((q: { id: string }) => q.id))
            for (const [qId, val] of Object.entries(subData.answers as Record<string, string>)) {
              if (sigQIds.has(qId)) { preSig[qId] = val; continue }
              try {
                const parsed = JSON.parse(val)
                if (Array.isArray(parsed)) { preCheckbox[qId] = parsed; continue }
              } catch { /* not JSON */ }
              preAnswers[qId] = val
            }
            setAnswers(preAnswers)
            setCheckboxAnswers(preCheckbox)
            setSignatureAnswers(preSig)
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
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
        } else if (q.type === 'signature' && !signatureAnswers[q.id]) {
          setError(`"${q.label}" requires a signature.`)
          return
        } else if (q.type !== 'file_upload' && q.type !== 'checkbox' && q.type !== 'signature' && !answers[q.id]?.trim()) {
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
    // Include signature data URLs directly
    for (const [qId, dataUrl] of Object.entries(signatureAnswers)) {
      if (dataUrl) finalAnswers[qId] = dataUrl
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
      body: JSON.stringify({ answers: finalAnswers, submission_id: existingSubmissionId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Submission failed')
      setSubmitting(false)
      return
    }
    setSubmitted(true)
    setSubmitting(false)
    fetch('/api/push/notify-checkin', { method: 'POST' }).catch(() => {})
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
          <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Response updated!' : 'Submitted!'}</h2>
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
          {isEditing && (
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editing your previous response — submit to update it.
            </div>
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

              {q.type === 'scale' && (
                <div className="flex items-center gap-2 flex-wrap">
                  {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                      className={`w-10 h-10 rounded-xl text-sm font-semibold border transition-colors ${answers[q.id] === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'yesno' && (
                <div className="flex gap-3">
                  {['Yes', 'No'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      className={`px-8 py-2.5 rounded-xl text-sm font-medium border transition-colors ${answers[q.id] === opt ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
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

              {q.type === 'signature' && (
                <SignaturePad
                  value={signatureAnswers[q.id] ?? ''}
                  onChange={(dataUrl) =>
                    setSignatureAnswers((prev) => ({ ...prev, [q.id]: dataUrl }))
                  }
                />
              )}
            </div>
          )})}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-2xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? (isEditing ? 'Updating…' : 'Submitting…') : (isEditing ? 'Update response' : 'Submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
