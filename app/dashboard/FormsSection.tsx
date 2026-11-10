'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type PendingForm = {
  id: string
  title: string
  type: string
  description: string | null
}

const TYPE_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  weekly_checkin: 'Weekly check-in',
  custom: 'Custom',
}

const TYPE_COLORS: Record<string, string> = {
  onboarding: 'bg-teal-50 text-teal-600',
  weekly_checkin: 'bg-blue-50 text-blue-600',
  custom: 'bg-gray-100 text-gray-600',
}

export default function FormsSection() {
  const [forms, setForms] = useState<PendingForm[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      // Get active forms assigned to this client via coach_clients relationship
      // We fetch active forms from coaches this client is linked to
      const { data: coachLinks } = await supabase
        .from('coach_clients')
        .select('coach_id')
        .eq('client_id', session.user.id)
        .eq('status', 'active')

      const coachIds = (coachLinks ?? []).map((r) => r.coach_id)
      if (!coachIds.length) { setLoading(false); return }

      const { data: allForms } = await supabase
        .from('forms')
        .select('id, title, type, description')
        .in('coach_id', coachIds)
        .eq('is_active', true)

      if (!allForms?.length) { setLoading(false); return }

      // Get already-submitted form IDs to check what's pending
      const { data: subs } = await supabase
        .from('form_submissions')
        .select('form_id, submitted_at')
        .eq('client_id', session.user.id)
        .order('submitted_at', { ascending: false })

      const submittedThisWeek = new Set<string>()
      const submittedEver = new Set<string>()

      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      for (const s of subs ?? []) {
        submittedEver.add(s.form_id)
        if (new Date(s.submitted_at) > oneWeekAgo) {
          submittedThisWeek.add(s.form_id)
        }
      }

      // Filter: onboarding = show if never submitted, weekly_checkin/custom = show if not submitted this week
      const pending = allForms.filter((f) => {
        if (f.type === 'onboarding') return !submittedEver.has(f.id)
        return !submittedThisWeek.has(f.id)
      })

      setForms(pending)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Forms</h3>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
          <div className="h-4 w-1/2 bg-gray-100 rounded-full mb-2" />
          <div className="h-3 w-1/3 bg-gray-50 rounded-full" />
        </div>
      </section>
    )
  }

  if (forms.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Forms</h3>
        <a href="/forms/history" className="text-sm text-blue-600 hover:underline">View history</a>
      </div>
      <div className="space-y-3">
        {forms.map((form) => (
          <a
            key={form.id}
            href={`/forms/${form.id}`}
            className="flex items-center justify-between bg-white rounded-2xl border border-blue-100 p-4 hover:bg-blue-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{form.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[form.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {TYPE_LABELS[form.type] ?? form.type}
                  </span>
                </div>
                {form.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{form.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Pending</span>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
