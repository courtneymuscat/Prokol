'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProgramDay = {
  name?: string
  exercises: Array<{ name: string; sets: number; reps: string; notes?: string }>
}

type ProgramWeek = { days: ProgramDay[] }

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
  title: string
  content: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Monday = 0 offset
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function differenceInDays(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((a.getTime() - b.getTime()) / msPerDay)
}

interface WorkoutForDate {
  programName: string
  day: ProgramDay
}

function getWorkoutsForDate(programs: ClientProgram[], date: Date): WorkoutForDate[] {
  const results: WorkoutForDate[] = []
  for (const program of programs) {
    const startDate = new Date(program.start_date)
    startDate.setHours(0, 0, 0, 0)
    const dayIndex = differenceInDays(date, startDate)
    if (dayIndex < 0) continue
    const weekIndex = Math.floor(dayIndex / 7)
    const dayOfWeek = dayIndex % 7
    const weeks = program.content ?? []
    const week = weeks[weekIndex]
    if (!week) continue
    const day = week.days?.[dayOfWeek]
    if (day && day.exercises && day.exercises.length > 0) {
      results.push({ programName: program.name, day })
    }
  }
  return results
}

// ─── Event colour helpers ─────────────────────────────────────────────────────

function eventColour(type: string): string {
  switch (type) {
    case 'workout': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'steps':   return 'bg-green-100 text-green-800 border-green-200'
    case 'note':    return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:        return 'bg-purple-100 text-purple-800 border-purple-200'
  }
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  date: Date
  workouts: WorkoutForDate[]
  events: CalendarEvent[]
  isToday: boolean
  isPast: boolean
  compact?: boolean
}

function DayCell({ date, workouts, events, isToday, isPast, compact }: DayCellProps) {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  // date.getDay() Sunday=0, Mon=1..Sat=6 → remap to Mon=0..Sun=6
  const dayNameIndex = date.getDay() === 0 ? 6 : date.getDay() - 1
  const dayName = dayNames[dayNameIndex]
  const empty = workouts.length === 0 && events.length === 0

  return (
    <div
      className={[
        'rounded-xl border p-3 flex flex-col gap-2 min-h-[120px] transition-all',
        isToday
          ? 'border-blue-400 bg-blue-50/60 shadow-sm'
          : 'border-gray-200 bg-white',
        isPast && !isToday ? 'opacity-50' : '',
        compact ? 'min-h-[100px]' : '',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
          {dayName}
        </span>
        <span
          className={[
            'w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold',
            isToday ? 'bg-blue-500 text-white' : 'text-gray-700',
          ].join(' ')}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 flex-1">
        {empty && (
          <span className="text-xs text-gray-300 italic mt-1">Rest day</span>
        )}

        {workouts.map((w, i) => (
          <div
            key={i}
            className="rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-1.5"
          >
            <p className="text-xs font-semibold text-indigo-700 truncate">
              {w.day.name ?? w.programName}
            </p>
            <p className="text-[11px] text-indigo-500 mt-0.5">
              {w.day.exercises.length} exercise{w.day.exercises.length !== 1 ? 's' : ''}
            </p>
          </div>
        ))}

        {events.map((ev) => (
          <div
            key={ev.id}
            className={`rounded-lg border px-2 py-1 text-xs font-medium truncate ${eventColour(ev.type)}`}
          >
            {ev.title}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrainingCalendar() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [programs, setPrograms] = useState<ClientProgram[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const weekEnd = addDays(weekStart, 6)

  const fetchData = useCallback(async (wStart: Date, wEnd: Date) => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const weekStartStr = toDateStr(wStart)
      const weekEndStr = toDateStr(wEnd)

      const [programsResult, eventsResult] = await Promise.all([
        supabase
          .from('client_programs')
          .select('id, name, start_date, content, status')
          .eq('client_id', user.id)
          .eq('status', 'active'),
        supabase
          .from('calendar_events')
          .select('*')
          .eq('client_id', user.id)
          .gte('event_date', weekStartStr)
          .lte('event_date', weekEndStr),
      ])

      setPrograms(programsResult.data ?? [])
      setEvents(eventsResult.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(weekStart, weekEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  const goToPrevWeek = () => setWeekStart(prev => addDays(prev, -7))
  const goToNextWeek = () => setWeekStart(prev => addDays(prev, 7))
  const goToThisWeek = () => setWeekStart(startOfWeek(new Date()))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const monthLabel = weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isCurrentWeek = toDateStr(weekStart) === toDateStr(startOfWeek(new Date()))

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Training Calendar</h2>
          <span className="text-sm text-gray-400">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {!isCurrentWeek && (
            <button
              onClick={goToThisWeek}
              className="text-xs px-2.5 py-1 rounded-lg text-blue-600 hover:bg-blue-50 font-medium transition-colors"
            >
              Today
            </button>
          )}
          <button
            onClick={goToPrevWeek}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextWeek}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Next week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {error && (
          <div className="text-sm text-red-500 text-center py-6">{error}</div>
        )}

        {loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 min-h-[120px] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Desktop: 7-column week grid */}
            <div className="hidden md:grid md:grid-cols-7 gap-3">
              {weekDays.map((date) => {
                const dateStr = toDateStr(date)
                const dayWorkouts = getWorkoutsForDate(programs, date)
                const dayEvents = events.filter(e => e.event_date === dateStr)
                const isToday = toDateStr(date) === toDateStr(today)
                const isPast = date < today && !isToday
                return (
                  <DayCell
                    key={dateStr}
                    date={date}
                    workouts={dayWorkouts}
                    events={dayEvents}
                    isToday={isToday}
                    isPast={isPast}
                  />
                )
              })}
            </div>

            {/* Mobile: vertical day list */}
            <div className="md:hidden flex flex-col gap-3">
              {weekDays.map((date) => {
                const dateStr = toDateStr(date)
                const dayWorkouts = getWorkoutsForDate(programs, date)
                const dayEvents = events.filter(e => e.event_date === dateStr)
                const isToday = toDateStr(date) === toDateStr(today)
                const isPast = date < today && !isToday
                return (
                  <DayCell
                    key={dateStr}
                    date={date}
                    workouts={dayWorkouts}
                    events={dayEvents}
                    isToday={isToday}
                    isPast={isPast}
                    compact
                  />
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
