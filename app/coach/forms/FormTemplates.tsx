'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TEMPLATES = [
  {
    id: 'onboarding',
    title: 'Client Onboarding',
    description: '13 questions covering goals, fitness level, training availability, diet, sleep, and lifestyle.',
    type: 'Onboarding',
    color: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    icon: (
      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  {
    id: 'weekly_checkin',
    title: 'Weekly Check-In',
    description: '11 questions on nutrition, training sessions completed, energy, sleep, stress, and wins/struggles.',
    type: 'Weekly check-in',
    color: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-700',
    icon: (
      <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'monthly_review',
    title: 'Monthly Progress Review',
    description: '10 questions on measurements, progress rating, biggest wins/challenges, and goal adjustments.',
    type: 'Custom',
    color: 'bg-purple-50 border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    icon: (
      <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'initial_assessment',
    title: 'Initial Health Assessment',
    description: '12 questions covering medical history, lifestyle, previous coaching experience, and 3-month goals.',
    type: 'Onboarding',
    color: 'bg-orange-50 border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    icon: (
      <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

export default function FormTemplates() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function useTemplate(templateId: string) {
    setLoading(templateId)
    setError(null)
    try {
      const res = await fetch('/api/forms/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        setLoading(null)
        return
      }
      router.push(`/coach/forms/${data.id}/edit`)
    } catch (e) {
      setError('Network error — try again')
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-700">Start from a template</p>
        <p className="text-xs text-gray-400 mt-0.5">Pre-built forms ready to use — edit any questions after creating.</p>
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TEMPLATES.map((t) => (
          <div key={t.id} className={`rounded-2xl border p-4 space-y-3 ${t.color}`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{t.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.badge}`}>{t.type}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{t.description}</p>
              </div>
            </div>
            <button
              onClick={() => useTemplate(t.id)}
              disabled={loading === t.id}
              className="w-full bg-white border border-gray-200 text-gray-700 text-xs font-semibold py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loading === t.id ? 'Creating…' : 'Use this template →'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
