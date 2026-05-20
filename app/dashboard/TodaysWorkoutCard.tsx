'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Mirrors the program-day shape used elsewhere in the dashboard. Loose typing
// — we only read what we need to render the summary card.
type DayItem = {
  type?: string
  name?: string
  title?: string
  sets?: unknown[]
}
type ProgramDay = { name?: string; items?: DayItem[]; exercises?: unknown[] }
type ProgramWeek = { days?: ProgramDay[] }
type ClientProgram = {
  id: string
  name: string
  start_date: string
  content: ProgramWeek[]
  status: string
}
type CalendarEvent = {
  id: string
  event_date: string
  type: string
  content: Record<string, unknown>
}

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function differenceInDays(a: Date, b: Date) {
  const aUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const bUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((aUTC - bUTC) / 86400000)
}

type TodaysWorkout = {
  programId: string
  programName: string
  day: ProgramDay
  exerciseCount: number
  completed: boolean
}

export default function TodaysWorkoutCard() {
  const [workout, setWorkout] = useState<TodaysWorkout | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = toDateStr(today)

        const [programsRes, eventsRes] = await Promise.all([
          supabase
            .from('client_programs')
            .select('id, name, start_date, content, status')
            .eq('client_id', user.id)
            .in('status', ['active', 'completed']),
          supabase
            .from('calendar_events')
            .select('id, event_date, type, content')
            .eq('client_id', user.id)
            .eq('type', 'program_workout_result'),
        ])
        if (cancelled) return

        const programs = (programsRes.data ?? []) as ClientProgram[]
        const events = (eventsRes.data ?? []) as CalendarEvent[]

        // Find today's scheduled workout across all active programs. We only
        // surface today — missed days from yesterday silently drop off.
        for (const prog of programs) {
          const start = new Date(prog.start_date + 'T00:00:00')
          const dayOffset = differenceInDays(today, start)
          if (dayOffset < 0) continue
          const weekIdx = Math.floor(dayOffset / 7)
          const dayIdx = dayOffset % 7
          const week = prog.content?.[weekIdx]
          const day = week?.days?.[dayIdx]
          if (!day) continue
          const items = (day.items ?? []) as DayItem[]
          const exerciseCount = items.filter((i) => i?.type === 'exercise').length
          const hasContent = items.length > 0 || ((day.exercises as unknown[] | undefined)?.length ?? 0) > 0
          if (!hasContent) continue

          // Was today's workout already logged? Match by program/week/day,
          // not date — a workout moved to today from a different date still
          // counts as completed.
          const completed = events.some((e) => {
            const c = e.content
            return (
              c.program_id === prog.id &&
              c.week_index === weekIdx &&
              c.day_index === dayIdx &&
              e.event_date === todayStr
            )
          })

          setWorkout({
            programId: prog.id,
            programName: prog.name,
            day,
            exerciseCount,
            completed,
          })
          return
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!ready || !workout) return null

  const dayName = workout.day.name?.trim() || 'Today\'s workout'

  return (
    <section>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Today&apos;s workout</p>
      <a
        href="/calendar?openToday=1"
        className="block bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:border-indigo-200 hover:shadow-sm transition-all active:opacity-80"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            {workout.completed ? (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{dayName}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{workout.programName}</p>
            <p className="text-[11px] text-gray-500 mt-1.5">
              {workout.completed
                ? 'Completed — tap to review'
                : workout.exerciseCount > 0
                  ? `${workout.exerciseCount} exercise${workout.exerciseCount === 1 ? '' : 's'} · tap to start`
                  : 'Tap to view'}
            </p>
          </div>
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </a>
    </section>
  )
}
