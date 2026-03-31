'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Schedule = {
  id: string
  title: string
  form_id: string
  day_of_week: number
  repeat_type: string
  start_date: string
}

type Submission = {
  form_id: string
  submitted_at: string
}

function repeatLabel(repeatType: string): string {
  switch (repeatType) {
    case 'weekly': return 'Weekly check-in'
    case 'biweekly': return 'Bi-weekly check-in'
    case 'monthly': return 'Monthly check-in'
    case 'once': return 'One-time check-in'
    default: return 'Check-in'
  }
}

function isDue(schedule: Schedule, submissions: Submission[], todayDow: number, todayStr: string): boolean {
  const { day_of_week, repeat_type, start_date, form_id } = schedule

  const submissionsForForm = submissions
    .filter((s) => s.form_id === form_id)
    .map((s) => new Date(s.submitted_at).getTime())

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  if (repeat_type === 'once') {
    return todayStr === start_date && submissionsForForm.length === 0
  }

  if (todayDow !== day_of_week) return false

  const lookback =
    repeat_type === 'biweekly' ? 14 * day :
    repeat_type === 'monthly' ? 28 * day :
    7 * day

  const recentSubmission = submissionsForForm.find((t) => now - t < lookback)
  return !recentSubmission
}

export default function ScheduledCheckIns() {
  const [dueSchedules, setDueSchedules] = useState<Schedule[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/client/checkin-schedules')
        if (!res.ok) return
        const schedules: Schedule[] = await res.json()
        if (!schedules.length) { setReady(true); return }

        const formIds = schedules.map((s) => s.form_id)
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setReady(true); return }

        const { data: subs } = await supabase
          .from('form_submissions')
          .select('form_id, submitted_at')
          .eq('user_id', session.user.id)
          .in('form_id', formIds)
          .order('submitted_at', { ascending: false })

        const submissions: Submission[] = subs ?? []

        const today = new Date()
        const todayDow = today.getDay()
        const todayStr = today.toISOString().split('T')[0]

        const due = schedules.filter((s) => isDue(s, submissions, todayDow, todayStr))
        setDueSchedules(due)
      } finally {
        setReady(true)
      }
    }
    load()
  }, [])

  if (!ready || dueSchedules.length === 0) return null

  return (
    <section>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Check-ins Due</p>
      {dueSchedules.map((s) => (
        <a
          href={`/forms/${s.form_id}`}
          key={s.id}
          className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 hover:bg-amber-100 transition-colors group mb-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{s.title}</p>
              <p className="text-xs text-amber-700 mt-0.5">{repeatLabel(s.repeat_type)} · Due today</p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg">Fill in →</span>
        </a>
      ))}
    </section>
  )
}
