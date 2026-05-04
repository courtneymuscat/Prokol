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
  id: string
  form_id: string
  submitted_at: string
}

type DueAutoflowStep = {
  flow_id: string
  flow_name: string
  step_number: number
  title: string
  due_date: string
  show_as_checkin_prompt: boolean
  tasks: Array<{ id: string; label: string; completed: boolean }>
  resources: Array<{ id: string; name: string; type: string; url: string | null }>
  linked_form: { id: string; title: string } | null
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function repeatLabel(repeatType: string): string {
  switch (repeatType) {
    case 'weekly': return 'Weekly'
    case 'biweekly': return 'Every 2 weeks'
    case 'monthly': return 'Monthly'
    case 'once': return 'One-time'
    default: return 'Scheduled'
  }
}

function lookbackMs(repeatType: string): number {
  const day = 24 * 60 * 60 * 1000
  if (repeatType === 'biweekly') return 14 * day
  if (repeatType === 'monthly') return 28 * day
  return 7 * day
}

function isDue(schedule: Schedule, submissions: Submission[], todayDow: number, todayStr: string): boolean {
  const { day_of_week, repeat_type, start_date, form_id } = schedule
  const subs = submissions.filter((s) => s.form_id === form_id).map((s) => new Date(s.submitted_at).getTime())
  const now = Date.now()

  if (repeat_type === 'once') {
    return todayStr === start_date && subs.length === 0
  }
  if (todayDow !== day_of_week) return false
  return !subs.find((t) => now - t < lookbackMs(repeat_type))
}

function getRecentSubmission(schedule: Schedule, submissions: Submission[]): Submission | null {
  const now = Date.now()
  const lb = lookbackMs(schedule.repeat_type)
  return submissions.find(
    (s) => s.form_id === schedule.form_id && now - new Date(s.submitted_at).getTime() < lb
  ) ?? null
}

function getNextDueDate(schedule: Schedule, submissions: Submission[], today: Date): Date | null {
  const { day_of_week, repeat_type, start_date, form_id } = schedule
  const day = 24 * 60 * 60 * 1000

  if (repeat_type === 'once') {
    const alreadyDone = submissions.some((s) => s.form_id === form_id)
    if (alreadyDone) return null
    return new Date(start_date + 'T00:00:00')
  }

  const lb = lookbackMs(repeat_type)
  const subs = submissions.filter((s) => s.form_id === form_id).map((s) => new Date(s.submitted_at).getTime())

  const todayMidnight = new Date(today)
  todayMidnight.setHours(0, 0, 0, 0)

  for (let i = 1; i <= 90; i++) {
    const d = new Date(todayMidnight.getTime() + i * day)
    if (d.getDay() === day_of_week) {
      const recentSub = subs.find((t) => d.getTime() - t < lb)
      if (!recentSub) return d
    }
  }
  return null
}

function formatDate(d: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diff === 1) return 'Tomorrow'
  if (diff <= 6) return DAY_NAMES[d.getDay()]
  return d.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
}

type Props = { onEmpty?: (empty: boolean) => void }

export default function ScheduledCheckIns({ onEmpty }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [due, setDue] = useState<Set<string>>(new Set())
  const [completed, setCompleted] = useState<Record<string, Submission>>({}) // scheduleId → recent submission
  const [nextDates, setNextDates] = useState<Record<string, Date | null>>({})
  const [dueFlowSteps, setDueFlowSteps] = useState<DueAutoflowStep[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        // Fetch form-based schedules and due autoflow steps in parallel
        const [schedRes, flowRes] = await Promise.all([
          fetch('/api/client/checkin-schedules'),
          fetch('/api/client/autoflows/due'),
        ])

        if (flowRes.ok) {
          const steps: DueAutoflowStep[] = await flowRes.json()
          setDueFlowSteps(Array.isArray(steps) ? steps : [])
        }

        if (!schedRes.ok) { setReady(true); return }
        const allSchedules: Schedule[] = await schedRes.json()
        if (!allSchedules.length) { setReady(true); return }

        const formIds = allSchedules.map((s) => s.form_id)
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setReady(true); return }

        // Fix: column is client_id, not user_id
        const { data: subs } = await supabase
          .from('form_submissions')
          .select('id, form_id, submitted_at')
          .eq('client_id', session.user.id)
          .in('form_id', formIds)
          .order('submitted_at', { ascending: false })

        const submissions: Submission[] = subs ?? []
        const today = new Date()
        const todayDow = today.getDay()
        const todayStr = today.toISOString().split('T')[0]

        const dueSet = new Set<string>()
        const completedMap: Record<string, Submission> = {}
        const nextMap: Record<string, Date | null> = {}

        for (const s of allSchedules) {
          if (isDue(s, submissions, todayDow, todayStr)) {
            dueSet.add(s.id)
          } else {
            const recent = getRecentSubmission(s, submissions)
            if (recent) {
              completedMap[s.id] = recent
            } else {
              nextMap[s.id] = getNextDueDate(s, submissions, today)
            }
          }
        }

        // Hide once-type schedules that are completed (no next date and not due)
        const visible = allSchedules.filter((s) =>
          dueSet.has(s.id) || completedMap[s.id] || nextMap[s.id] !== null
        )

        setSchedules(visible)
        setDue(dueSet)
        setCompleted(completedMap)
        setNextDates(nextMap)
      } finally {
        setReady(true)
      }
    }
    load()
  }, [])

  const checkinFlowSteps = dueFlowSteps.filter(s => s.show_as_checkin_prompt)
  const isEmpty = schedules.length === 0 && checkinFlowSteps.length === 0

  useEffect(() => {
    if (ready) onEmpty?.(isEmpty)
  }, [ready, isEmpty]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || isEmpty) return null

  return (
    <section>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Check-ins</p>

      {/* Due autoflow steps (check-in prompt only) */}
      {dueFlowSteps.filter(s => s.show_as_checkin_prompt).map((step) => (
        <a
          key={`${step.flow_id}-${step.step_number}`}
          href={`/autoflows/${step.flow_id}/${step.step_number}`}
          className="flex items-center justify-between rounded-2xl px-5 py-4 hover:opacity-90 transition-colors group mb-3" style={{ backgroundColor: 'rgba(29,158,117,0.07)', border: '1px solid rgba(29,158,117,0.18)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(29,158,117,0.12)' }}>
              <svg className="w-5 h-5" style={{ color: '#1D9E75' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {step.title || `Step ${step.step_number}`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#1D9E75' }}>
                {step.flow_name} · Due today
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: '#1D9E75' }}>Fill in →</span>
        </a>
      ))}

      {schedules.map((s) => {
        const isDueToday = due.has(s.id)
        const recentSub = completed[s.id]
        const next = nextDates[s.id]

        if (isDueToday) {
          return (
            <a
              href={`/forms/${s.form_id}`}
              key={s.id}
              className="flex items-center justify-between rounded-2xl px-5 py-4 hover:opacity-90 transition-colors group mb-3" style={{ backgroundColor: 'rgba(29,158,117,0.07)', border: '1px solid rgba(29,158,117,0.18)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" style={{ color: '#1D9E75' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#1D9E75' }}>{repeatLabel(s.repeat_type)} · Due today</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: '#1D9E75' }}>Fill in →</span>
            </a>
          )
        }

        if (recentSub) {
          const submittedAt = new Date(recentSub.submitted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
          return (
            <div
              key={s.id}
              className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                  <p className="text-xs text-green-700 mt-0.5">Completed · {submittedAt}</p>
                </div>
              </div>
              <a
                href={`/forms/${s.form_id}`}
                className="text-xs font-medium text-green-700 hover:text-green-900 underline underline-offset-2 flex-shrink-0 ml-3"
              >
                Edit response
              </a>
            </div>
          )
        }

        return (
          <div
            key={s.id}
            className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 mb-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {repeatLabel(s.repeat_type)}
                  {s.repeat_type !== 'once' && ` · Every ${DAY_NAMES[s.day_of_week]}`}
                </p>
              </div>
            </div>
            {next && (
              <span className="text-xs font-medium text-gray-500 flex-shrink-0 ml-3">
                Next: {formatDate(next)}
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}
