'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

type QuestionType = 'text' | 'textarea' | 'scale' | 'yesno' | 'choice' | 'note'

type Question = {
  id: string
  type: QuestionType
  label: string
  required: boolean
  description?: string
  options?: string[]
}

type Resource = {
  id: string
  name: string
  description: string | null
  type: 'link' | 'video' | 'pdf' | 'document'
  url: string | null
}

type Task = {
  id: string
  label: string
  link_type?: 'resource' | 'form' | 'url' | null
  link_url?: string | null
  link_label?: string | null
}

type StepData = {
  flow_id: string
  flow_name: string
  step_number: number
  total_steps: number
  type: string
  title: string
  description: string | null
  core_questions: Question[]
  questions: Question[]
  resources: Resource[]
  tasks: Task[]
  linked_form: { id: string; title: string } | null
  existing_submission: { id: string; answers: Record<string, string>; submitted_at: string } | null
}

const RESOURCE_TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  link:     { icon: '🔗', label: 'Link',     color: 'bg-blue-50 border-blue-200 text-blue-800' },
  video:    { icon: '🎬', label: 'Video',    color: 'bg-purple-50 border-purple-200 text-purple-800' },
  pdf:      { icon: '📄', label: 'PDF',      color: 'bg-red-50 border-red-200 text-red-800' },
  document: { icon: '📝', label: 'Document', color: 'bg-gray-50 border-gray-200 text-gray-800' },
}

function ScaleInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${value === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function QuestionInput({
  q,
  value,
  onChange,
}: {
  q: Question
  value: string
  onChange: (v: string) => void
}) {
  if (q.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={4}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
      />
    )
  }
  if (q.type === 'scale') {
    return <ScaleInput value={value} onChange={onChange} />
  }
  if (q.type === 'yesno') {
    return (
      <div className="flex gap-2">
        {['Yes', 'No'].map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-5 py-2 rounded-xl text-sm font-medium border transition-colors ${value === opt ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
          >
            {opt}
          </button>
        ))}
      </div>
    )
  }
  if (q.type === 'choice') {
    return (
      <div className="flex flex-col gap-1.5">
        {(q.options ?? []).map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`text-left px-3 py-2 rounded-xl text-sm border transition-colors ${value === opt ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}
          >
            {opt}
          </button>
        ))}
      </div>
    )
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
    />
  )
}

export default function AutoflowStepPage({ params }: { params: Promise<{ flowId: string; step: string }> }) {
  const { flowId, step } = use(params)
  const router = useRouter()

  const [data, setData] = useState<StepData | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Warn on tab close / refresh when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => {
    fetch(`/api/client/autoflows/${flowId}/${step}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setData(d)
        if (d.existing_submission) {
          const saved = d.existing_submission.answers ?? {}
          setAnswers(saved)
          // Restore checked tasks from saved answers
          const checked = new Set<string>()
          for (const [k, v] of Object.entries(saved)) {
            if (k.startsWith('task_') && v === 'done') checked.add(k.slice(5))
          }
          setCheckedTasks(checked)
        }
      })
      .finally(() => setLoading(false))
  }, [flowId, step])

  function setAnswer(id: string, value: string) {
    setAnswers(prev => ({ ...prev, [id]: value }))
    setIsDirty(true)
  }

  function toggleTask(id: string, checked: boolean) {
    setCheckedTasks(prev => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
    setIsDirty(true)
  }

  function confirmLeave(href: string) {
    if (!isDirty || confirm('You have unsaved answers. Leave without submitting?')) {
      window.location.href = href
    }
  }

  async function submit() {
    if (!data) return
    const allQuestions = [...data.core_questions, ...data.questions]
    const missing = allQuestions.filter(q => q.type !== 'note' && q.required && !answers[q.id]?.trim())
    if (missing.length > 0) {
      setError(`Please answer all required questions (${missing.length} remaining).`)
      return
    }
    setError(null)
    setSubmitting(true)
    // Merge task completion into answers
    const taskAnswers: Record<string, string> = {}
    for (const task of (data.tasks ?? [])) {
      taskAnswers[`task_${task.id}`] = checkedTasks.has(task.id) ? 'done' : 'skipped'
    }
    const res = await fetch(`/api/client/autoflows/${flowId}/${step}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: { ...answers, ...taskAnswers } }),
    })
    setSubmitting(false)
    if (res.ok) {
      setIsDirty(false)
      setSubmitted(true)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to submit.')
    }
  }

  const stepNum = parseInt(step)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  if (submitted) {
    const nextStep = stepNum + 1
    const hasNext = data && nextStep <= data.total_steps
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Submitted!</h1>
        <p className="text-sm text-gray-500 mt-2">
          {data?.flow_name} — Step {stepNum} of {data?.total_steps}
        </p>
        <div className="flex gap-3 mt-6">
          <a href="/dashboard" className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Back to dashboard
          </a>
          {hasNext && (
            <a
              href={`/autoflows/${flowId}/${nextStep}`}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Next step →
            </a>
          )}
        </div>
      </div>
    )
  }

  if (!data) return null

  const allQuestions = [...data.core_questions, ...data.questions]
  const isResubmit = !!data.existing_submission

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <button
          onClick={() => confirmLeave('/dashboard')}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Dashboard
        </button>
        <div className="mt-2">
          <p className="text-xs text-gray-500">{data.flow_name}</p>
          <h1 className="text-lg font-bold text-gray-900">{data.title || `Step ${data.step_number}`}</h1>
        </div>
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mt-3">
          {Array.from({ length: data.total_steps }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i + 1 === stepNum ? 'w-4 bg-gray-900' : i + 1 < stepNum ? 'w-1.5 bg-gray-400' : 'w-1.5 bg-gray-200'}`}
            />
          ))}
          <span className="text-[11px] text-gray-400 ml-1">{stepNum}/{data.total_steps}</span>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-4 pt-5">
        {data.description && (
          <p className="text-sm text-gray-600 bg-white rounded-xl border border-gray-100 px-4 py-3">{data.description}</p>
        )}

        {isResubmit && (
          <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-2">
            You&apos;ve already submitted this step. Submitting again will update your response.
          </p>
        )}

        {/* Resources */}
        {data.resources && data.resources.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Resources</p>
            {data.resources.map(r => {
              const meta = RESOURCE_TYPE_META[r.type] ?? RESOURCE_TYPE_META.document
              return (
                <div key={r.id} className={`bg-white rounded-xl border p-3.5 flex items-start gap-3 ${meta.color}`}>
                  <span className="text-xl flex-shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{r.name}</p>
                    {r.description && <p className="text-xs mt-0.5 opacity-75">{r.description}</p>}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs font-semibold underline opacity-90 hover:opacity-100">
                        Open {meta.label} →
                      </a>
                    )}
                    {!r.url && <p className="text-xs mt-1 opacity-50 italic">No link provided — ask your coach.</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Linked form */}
        {data.linked_form && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">📋</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Form to complete</p>
              <p className="text-sm font-semibold text-amber-900">{data.linked_form.title}</p>
              <a href={`/forms/${data.linked_form.id}`}
                className="inline-block mt-2 text-xs font-semibold text-amber-800 underline hover:text-amber-900">
                Fill out form →
              </a>
            </div>
          </div>
        )}

        {/* Tasks */}
        {data.tasks && data.tasks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks</p>
            <div className="space-y-2">
              {data.tasks.map(task => (
                <div key={task.id} className="space-y-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checkedTasks.has(task.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300 group-hover:border-gray-500'}`}>
                      {checkedTasks.has(task.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input type="checkbox" checked={checkedTasks.has(task.id)} className="sr-only"
                      onChange={e => toggleTask(task.id, e.target.checked)} />
                    <span className={`text-sm transition-colors ${checkedTasks.has(task.id) ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.label}
                    </span>
                  </label>
                  {task.link_type && task.link_url && (
                    <div className="pl-8">
                      <a
                        href={task.link_url}
                        target={task.link_type === 'form' ? '_self' : '_blank'}
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                      >
                        {task.link_type === 'resource' ? '📚' : task.link_type === 'form' ? '📋' : '🔗'}
                        {task.link_label || task.link_url}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Questions + Notes */}
        {(() => {
          let questionIndex = 0
          return allQuestions.map(q => {
            if (q.type === 'note') {
              return (
                <div key={q.id} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2.5">
                  <span className="text-base flex-shrink-0 mt-0.5">💬</span>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{q.label || <em className="opacity-50">No note text.</em>}</p>
                </div>
              )
            }
            questionIndex++
            const idx = questionIndex
            return (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <label className="block text-sm font-medium text-gray-900">
                  {idx}. {q.label}
                  {q.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {q.description && (
                  <p className="text-xs text-gray-500">{q.description}</p>
                )}
                <QuestionInput
                  q={q}
                  value={answers[q.id] ?? ''}
                  onChange={v => setAnswer(q.id, v)}
                />
              </div>
            )
          })
        })()}

        {allQuestions.length === 0 && !data.tasks?.length && !data.resources?.length && !data.linked_form && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-400">No content for this step yet.</p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 px-1">{error}</p>
        )}

        {(allQuestions.some(q => q.type !== 'note') || (data.tasks ?? []).length > 0) && (
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : isResubmit ? 'Update response' : 'Submit'}
          </button>
        )}
      </main>
    </div>
  )
}
