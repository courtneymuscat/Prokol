'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

type QuestionType = 'text' | 'textarea' | 'scale' | 'yesno' | 'choice'

type Question = {
  id: string
  type: QuestionType
  label: string
  required: boolean
  options?: string[]
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
  existing_submission: { id: string; answers: Record<string, string>; submitted_at: string } | null
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
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/client/autoflows/${flowId}/${step}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setData(d)
        if (d.existing_submission) {
          setAnswers(d.existing_submission.answers ?? {})
        }
      })
      .finally(() => setLoading(false))
  }, [flowId, step])

  async function submit() {
    if (!data) return
    const allQuestions = [...data.core_questions, ...data.questions]
    const missing = allQuestions.filter(q => q.required && !answers[q.id]?.trim())
    if (missing.length > 0) {
      setError(`Please answer all required questions (${missing.length} remaining).`)
      return
    }
    setError(null)
    setSubmitting(true)
    const res = await fetch(`/api/client/autoflows/${flowId}/${step}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
    setSubmitting(false)
    if (res.ok) {
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
        <a href="/dashboard" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          ← Dashboard
        </a>
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

        {allQuestions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <label className="block text-sm font-medium text-gray-900">
              {i + 1}. {q.label}
              {q.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <QuestionInput
              q={q}
              value={answers[q.id] ?? ''}
              onChange={v => setAnswers({ ...answers, [q.id]: v })}
            />
          </div>
        ))}

        {allQuestions.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-400">No questions for this step.</p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 px-1">{error}</p>
        )}

        {allQuestions.length > 0 && (
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
