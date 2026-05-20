'use client'

import { useState, useEffect, useRef } from 'react'

// ── Calendar tab ──────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string
  event_date: string
  type: string
  title: string
  content: Record<string, unknown>
  created_at?: string | null
}

type CalHabit = { id: string; name: string; type: string; target: number | null; unit: string | null; icon: string | null }
type MacroDay = { cal: number; protein: number; carbs: number; fat: number }

const EVENT_COLORS: Record<string, string> = {
  task:           'bg-rose-50 text-rose-700 border-rose-200',
  workout:        'bg-blue-50 text-blue-700 border-blue-200',
  steps:          'bg-green-50 text-green-700 border-green-200',
  note:           'bg-yellow-50 text-yellow-700 border-yellow-200',
  habit:          'bg-teal-50 text-teal-700 border-teal-200',
  autoflow:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  personal:       'bg-orange-50 text-orange-700 border-orange-200',
  travel:         'bg-sky-50 text-sky-700 border-sky-200',
  extra_activity: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  birthday:       'bg-pink-50 text-pink-700 border-pink-200',
  custom:         'bg-gray-50 text-gray-700 border-gray-200',
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date); d.setDate(d.getDate() + days); return d
}

function toDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type CalSectionExerciseRef = {
  id: string
  name: string
  category?: string
  equipment?: string
  video_url?: string | null
}

type CalWorkoutItem = {
  type: 'exercise' | 'section'
  id: string
  name?: string
  title?: string
  notes?: string
  scoreType?: string
  scoreValue?: string
  sets?: Array<{ setNumber: number; reps: string; weight: string }>
  exercises?: CalSectionExerciseRef[]
}

type CalWorkoutForDate = {
  programId: string
  programName: string
  dayName: string
  weekIdx: number
  dayIdx: number
  exerciseCount: number
  items: CalWorkoutItem[]
  dateStr: string
  result: CalendarEvent | null
}

// Handles both old format (exercises[]) and new format (items: DayItem[])
function getWorkoutsForDate(
  programs: { id: string; name: string; start_date: string; content: unknown[] }[],
  date: Date,
  events: CalendarEvent[]
) {
  const out: CalWorkoutForDate[] = []
  const dateStr = toDateStr(date)

  // Build override map: "programId-weekIdx-dayIdx" → override event_date
  const overrideMap: Record<string, string> = {}
  for (const e of events) {
    if (e.type === 'program_workout_override') {
      const c = e.content as Record<string, unknown>
      overrideMap[`${c.program_id}-${c.week_index}-${c.day_index}`] = e.event_date
    }
  }

  // Helper to add a workout from a program at a specific weekIdx/dayIdx
  function addWorkout(prog: { id: string; name: string; content: unknown[] }, weekIdx: number, dayIdx: number) {
    const week = (prog.content[weekIdx] ?? {}) as Record<string, unknown>
    const day = ((week.days ?? []) as Record<string, unknown>[])[dayIdx]
    if (!day) return
    const items = day.items as CalWorkoutItem[] | undefined
    const exes = day.exercises as unknown[] | undefined
    const count = Array.isArray(items)
      ? items.filter((it) => it.type === 'exercise').length
      : Array.isArray(exes) ? exes.length : 0
    if (count === 0 && !Array.isArray(items)) return
    if (!count && (!Array.isArray(items) || items.length === 0)) return
    const result = events.find(
      (e) =>
        e.type === 'program_workout_result' &&
        (e.content as Record<string, unknown>).program_id === prog.id &&
        (e.content as Record<string, unknown>).week_index === weekIdx &&
        (e.content as Record<string, unknown>).day_index === dayIdx
    ) ?? null
    out.push({
      programId: prog.id,
      programName: prog.name,
      dayName: (day.name as string) || `Day ${dayIdx + 1}`,
      weekIdx,
      dayIdx,
      exerciseCount: count,
      items: Array.isArray(items) ? items : [],
      dateStr,
      result,
    })
  }

  // 1. Show workouts overridden to THIS date
  for (const e of events) {
    if (e.type === 'program_workout_override' && e.event_date === dateStr) {
      const c = e.content as Record<string, unknown>
      const prog = programs.find((p) => p.id === (c.program_id as string))
      if (prog) addWorkout(prog, c.week_index as number, c.day_index as number)
    }
  }

  // 2. Show workouts that are scheduled for today (unless overridden away)
  for (const prog of programs) {
    const start = new Date(prog.start_date + 'T00:00:00')
    // Use local date components from the Date object directly — toISOString() returns UTC
    // which gives the wrong date in UTC+10 timezones (e.g. AEST midnight → previous day UTC).
    const startUTC  = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
    const targetUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    const dayOffset = Math.round((targetUTC - startUTC) / 86400000)
    if (dayOffset < 0) continue
    const weekIdx = Math.floor(dayOffset / 7)
    const dayIdx = dayOffset % 7
    const overrideKey = `${prog.id}-${weekIdx}-${dayIdx}`
    if (overrideMap[overrideKey]) continue // overridden to a different date — skip
    addWorkout(prog, weekIdx, dayIdx)
  }

  return out
}

// ── Coach workout result viewer ───────────────────────────────────────────────

type SavedExercise = {
  id: string
  name: string
  sets: Array<{ weight: string; reps: string }>
  videoPath?: string
  clientNote?: string
  coachNote?: string
  swappedTo?: { id: string; name: string; category?: string; equipment?: string; video_url?: string | null }
}

function CoachVideoPlayer({ path, clientId }: { path: string; clientId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/workouts/video-url?path=${encodeURIComponent(path)}&clientId=${clientId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.url) setUrl(j.url) })
      .finally(() => setLoading(false))
  }, [path, clientId])
  if (loading) return <div className="h-8 flex items-center text-xs text-gray-400">Loading video…</div>
  if (!url) return <div className="text-xs text-red-400">Could not load video</div>
  return <video src={url} controls playsInline className="w-full rounded-lg mt-1 max-h-48 bg-black" />
}

function CoachWorkoutModal({ workout, clientId, clientTimezone, onClose }: {
  workout: CalWorkoutForDate
  clientId: string
  clientTimezone: string | null
  onClose: () => void
}) {
  const result = workout.result
  const savedSections = result
    ? ((result.content.sections ?? []) as Array<{ id: string; title: string; scoreType: string; scoreValue: string; coachNote?: string }>)
    : []
  const savedExercises = result
    ? ((result.content.exercises ?? []) as SavedExercise[])
    : []

  const [coachNotes, setCoachNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(savedExercises.filter((e) => e.coachNote).map((e) => [e.id, e.coachNote!]))
  )
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  async function saveFeedback() {
    if (!result) return
    setSavingFeedback(true)
    setFeedbackError(null)
    try {
      const exerciseFeedback = Object.entries(coachNotes).map(([id, coachNote]) => ({ id, coachNote }))
      const res = await fetch(`/api/workouts/program-session/${result.id}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseFeedback }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
      }
      setFeedbackSaved(true)
      setTimeout(() => setFeedbackSaved(false), 2500)
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : 'Failed to save feedback')
    } finally {
      setSavingFeedback(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{workout.programName}</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{workout.dayName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(workout.dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {result && (() => {
              const completedTime = result.created_at
                ? new Intl.DateTimeFormat('en-AU', {
                    hour: 'numeric', minute: '2-digit', hour12: true,
                    timeZone: clientTimezone ?? undefined,
                  }).format(new Date(result.created_at))
                : null
              const tzLabel = clientTimezone ? clientTimezone.split('/').pop()?.replace(/_/g, ' ') : null
              return (
                <div className="flex flex-col gap-0.5 mt-2">
                  <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5 w-fit">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-semibold text-green-700">
                      Completed {new Date(result.event_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  {completedTime && (
                    <p className="text-[11px] text-gray-400 pl-1">
                      Logged at {completedTime}{tzLabel ? ` (${tzLabel})` : ''}
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!result && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-400 text-center">
              Client hasn't logged this workout yet.
            </div>
          )}

          {workout.items.map((item) => {
            if (item.type === 'section') {
              const hasScore = item.scoreType && item.scoreType !== 'none'
              const savedScore = savedSections.find((s) => s.id === item.id)
              return (
                <div key={item.id} className="bg-indigo-50 rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{item.title}</span>
                    {hasScore && (
                      <span className="text-[10px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase">{item.scoreType}</span>
                    )}
                  </div>
                  {item.notes && <p className="text-xs text-indigo-800 whitespace-pre-line leading-relaxed">{item.notes}</p>}
                  {/* Reference exercises listed by the coach for this section */}
                  {(item.exercises?.length ?? 0) > 0 && (
                    <div className="space-y-1 pt-0.5">
                      {(item.exercises ?? []).map((ex) => (
                        <div key={ex.id} className="flex items-center gap-2 bg-white/70 border border-indigo-100 rounded-lg px-2.5 py-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-indigo-900 truncate">{ex.name}</p>
                            {(ex.category || ex.equipment) && (
                              <p className="text-[10px] text-indigo-600/70 capitalize">
                                {[ex.category, ex.equipment].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          {ex.video_url && (
                            <a
                              href={ex.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 transition-colors"
                              title="Watch demo"
                            >
                              <svg className="w-3 h-3 text-red-600 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {hasScore && result && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-gray-500">Client score:</span>
                      <span className="text-sm font-bold text-indigo-700">{savedScore?.scoreValue || '—'}</span>
                    </div>
                  )}
                  {savedScore?.coachNote && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mt-1">
                      <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5">Your feedback</p>
                      <p className="text-xs text-amber-900">{savedScore.coachNote}</p>
                    </div>
                  )}
                </div>
              )
            }

            const savedEx = savedExercises.find((e) => e.id === item.id)
            const swappedTo = savedEx?.swappedTo
            return (
              <div key={item.id} className="border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-sm font-semibold text-gray-800">{swappedTo?.name ?? item.name}</p>
                {swappedTo && (
                  <p className="text-[10px] text-blue-600">
                    ⇄ Client swapped from <span className="italic">{item.name}</span>
                  </p>
                )}
                {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                <p className="text-xs text-gray-400">Target: {item.sets?.length ?? 0} sets × {item.sets?.[0]?.reps ?? '—'}</p>

                {savedEx && savedEx.sets.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {savedEx.sets.map((s, si) => (
                      <p key={si} className="text-xs text-gray-600">
                        Set {si + 1}: {s.weight ? `${s.weight} kg × ` : ''}{s.reps} reps
                      </p>
                    ))}
                  </div>
                )}
                {result && !savedEx && <p className="text-xs text-gray-300 italic">No sets logged</p>}

                {/* Client uploaded video */}
                {savedEx?.videoPath && (
                  <CoachVideoPlayer path={savedEx.videoPath} clientId={clientId} />
                )}

                {/* Client note */}
                {savedEx?.clientNote && (
                  <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Client note</p>
                    <p className="text-xs text-gray-600">{savedEx.clientNote}</p>
                  </div>
                )}

                {/* Coach feedback input */}
                {result && (
                  <div className="pt-1">
                    <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-1">Feedback</p>
                    <textarea
                      value={coachNotes[item.id] ?? savedEx?.coachNote ?? ''}
                      onChange={(e) => setCoachNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Add feedback for this exercise…"
                      rows={2}
                      className="w-full text-xs border border-amber-100 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-300 placeholder:text-gray-300 bg-amber-50"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-4 border-t space-y-2">
          {feedbackError && (
            <p className="text-xs text-red-500 text-center">{feedbackError}</p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              Close
            </button>
            {result && (
              <button onClick={saveFeedback} disabled={savingFeedback}
                className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {savingFeedback ? 'Saving…' : feedbackSaved ? 'Saved ✓' : 'Save Feedback'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Coach personal workout viewer ─────────────────────────────────────────────

type PersonalWorkoutDetail = {
  id: string
  name: string
  started_at: string
  ended_at: string | null
  duration_min: number | null
  exercises: Array<{
    weId: string
    name: string
    category: string
    notes: string | null
    sets: Array<{ setNumber: number; weightLbs: number | null; reps: number | null; durationSeconds: number | null; calories: number | null }>
  }>
  sections: Array<{ title: string; notes: string; scoreType: string; scoreValue: string }>
}

function CoachPersonalWorkoutModal({ event, clientId, onClose }: {
  event: CalendarEvent
  clientId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<PersonalWorkoutDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const workoutId = (event.content as Record<string, unknown>)?.workout_id as string | undefined

  useEffect(() => {
    if (!workoutId) { setLoading(false); return }
    fetch(`/api/coach/clients/${clientId}/workouts/${workoutId}`)
      .then((r) => r.ok ? r.json() : r.json().then((b: { error?: string }) => { throw new Error(b.error ?? 'Failed') }))
      .then((d) => setDetail(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [workoutId, clientId])

  function fmtSet(s: PersonalWorkoutDetail['exercises'][0]['sets'][0]): string {
    const parts: string[] = []
    if (s.weightLbs != null) parts.push(`${s.weightLbs} kg`)
    if (s.reps != null) parts.push(`${s.reps} reps`)
    if (s.durationSeconds != null) parts.push(`${s.durationSeconds}s`)
    if (s.calories != null) parts.push(`${s.calories} cal`)
    return parts.join(' × ') || '—'
  }

  const dateDisplay = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Personal workout</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{event.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{dateDisplay}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}
          {error && <p className="text-sm text-red-500 text-center py-4">{error}</p>}
          {!loading && !error && !workoutId && (
            <p className="text-sm text-gray-400 text-center py-4">No workout data linked.</p>
          )}
          {detail && (
            <>
              {detail.duration_min != null && (
                <p className="text-xs text-gray-400">{detail.duration_min} min</p>
              )}
              {detail.exercises.map((ex) => (
                <div key={ex.weId} className="border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-sm font-semibold text-gray-800">{ex.name}
                    <span className="text-xs font-normal text-gray-400 ml-1.5 capitalize">{ex.category}</span>
                  </p>
                  {ex.sets.length > 0 ? (
                    <div className="space-y-0.5">
                      {ex.sets.map((s) => (
                        <p key={s.setNumber} className="text-xs text-gray-600">
                          Set {s.setNumber}: {fmtSet(s)}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No sets recorded</p>
                  )}
                  {ex.notes && <p className="text-xs text-gray-500 italic">"{ex.notes}"</p>}
                </div>
              ))}
              {detail.sections.map((s, i) => (
                <div key={i} className="bg-teal-50 rounded-xl px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Section</span>
                    {s.title && <p className="text-sm font-semibold text-gray-800">{s.title}</p>}
                  </div>
                  {s.notes && <p className="text-sm text-gray-600">{s.notes}</p>}
                  {s.scoreValue && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium capitalize">{s.scoreType}:</span> {s.scoreValue}
                    </p>
                  )}
                </div>
              ))}
              {detail.exercises.length === 0 && detail.sections.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No exercises recorded.</p>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t">
          <button onClick={onClose} className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function getMonthGridDays(monthStart: Date): Date[] {
  const firstDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)
  const lastDay  = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const gridStart = getWeekStart(firstDay)
  const lastDow = lastDay.getDay()
  const gridEnd = addDays(lastDay, lastDow === 0 ? 0 : 7 - lastDow)
  const days: Date[] = []
  let cur = new Date(gridStart)
  while (cur <= gridEnd) { days.push(new Date(cur)); cur = addDays(cur, 1) }
  return days
}


export default function CalendarTab({ clientId }: { clientId: string }) {
  const [calView, setCalView] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [monthStart, setMonthStart] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [programs, setPrograms] = useState<{ id: string; name: string; start_date: string; content: unknown[] }[]>([])
  const [foodByDate, setFoodByDate] = useState<Record<string, MacroDay>>({})
  const [habits, setHabits] = useState<CalHabit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientTimezone, setClientTimezone] = useState<string | null>(null)
  const datePickerRef = useRef<HTMLInputElement>(null)
  const [addingEvent, setAddingEvent] = useState<string | null>(null)
  const [newEvent, setNewEvent] = useState({ type: 'task', title: '', content: '', repeat: 'none', endDate: '' })
  const [saving, setSaving] = useState(false)
  const [deletingSeriesId, setDeletingSeriesId] = useState<string | null>(null)
  const [viewingWorkout, setViewingWorkout] = useState<CalWorkoutForDate | null>(null)
  const [viewingPersonalWorkout, setViewingPersonalWorkout] = useState<CalendarEvent | null>(null)
  const [viewingAutoflow, setViewingAutoflow] = useState<{ title: string; flowId: string; stepNumber: number } | null>(null)
  const [autoflowStepData, setAutoflowStepData] = useState<{ core_questions: { id: string; label: string; type: string }[]; questions: { id: string; label: string; type: string }[]; response: { answers: Record<string, string>; submitted_at: string } | null } | null>(null)
  const [autoflowLoading, setAutoflowLoading] = useState(false)
  const [dragEventId, setDragEventId] = useState<string | null>(null)
  const [dragWorkout, setDragWorkout] = useState<{ programId: string; weekIdx: number; dayIdx: number } | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  async function openAutoflowStep(evt: CalendarEvent) {
    const flowId = evt.content.flow_id as string
    const stepNumber = evt.content.step_number as number
    if (!flowId || !stepNumber) return
    setViewingAutoflow({ title: evt.title, flowId, stepNumber })
    setAutoflowStepData(null)
    setAutoflowLoading(true)
    const d = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`).then(r => r.json())
    if (!d.error) {
      const step = (d.steps ?? []).find((s: { step_number: number }) => s.step_number === stepNumber)
      const tpl = d.autoflow_templates as { core_questions: { id: string; label: string; type: string }[] } | null
      setAutoflowStepData({
        core_questions: tpl?.core_questions ?? [],
        questions: step?.questions ?? [],
        response: step?.response ?? null,
      })
    }
    setAutoflowLoading(false)
  }

  const weekEnd = addDays(weekStart, 6)
  const monthGridDays = getMonthGridDays(monthStart)
  const rangeStart = calView === 'week' ? weekStart : monthGridDays[0]
  const rangeEnd   = calView === 'week' ? weekEnd   : monthGridDays[monthGridDays.length - 1]

  async function loadData(start: Date, end: Date) {
    setLoading(true); setError(null)
    try {
      const res = await fetch(
        `/api/coach/clients/${clientId}/calendar?start_date=${toDateStr(start)}&end_date=${toDateStr(end)}`
      )
      if (!res.ok) { setError('Failed to load calendar'); return }
      const data = await res.json()
      setEvents(data.events ?? [])
      setPrograms(data.programs ?? [])
      setFoodByDate(data.foodByDate ?? {})
      setHabits(data.habits ?? [])
      if (data.clientTimezone) setClientTimezone(data.clientTimezone)
    } catch {
      setError('Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData(rangeStart, rangeEnd) }, [calView, weekStart, monthStart]) // eslint-disable-line react-hooks/exhaustive-deps

  function prevPeriod() {
    if (calView === 'week') setWeekStart((d) => addDays(d, -7))
    else setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function nextPeriod() {
    if (calView === 'week') setWeekStart((d) => addDays(d, 7))
    else setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }
  function goToToday() {
    const now = new Date()
    setWeekStart(getWeekStart(now))
    setMonthStart(new Date(now.getFullYear(), now.getMonth(), 1))
  }
  function switchView(v: 'week' | 'month') {
    if (v === 'month') setMonthStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1))
    else setWeekStart(getWeekStart(monthStart))
    setCalView(v)
  }

  function handleDatePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return
    const [y, m, d] = e.target.value.split('-').map(Number)
    const picked = new Date(y, m - 1, d)
    if (calView === 'week') {
      setWeekStart(getWeekStart(picked))
    } else {
      setMonthStart(new Date(y, m - 1, 1))
    }
  }

  const datePickerValue = calView === 'week' ? toDateStr(weekStart) : toDateStr(monthStart)

  async function saveEvent(date: string) {
    if (!newEvent.title.trim()) return
    setSaving(true)
    // Date range is only supported for travel for now. Only send end_date if
    // it's strictly after the start so the API takes the single-event path
    // for same-day "trips".
    const usingRange = newEvent.type === 'travel' && !!newEvent.endDate && newEvent.endDate > date
    const res = await fetch(`/api/coach/clients/${clientId}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_date: date,
        end_date: usingRange ? newEvent.endDate : undefined,
        type: newEvent.type,
        title: newEvent.title,
        content: newEvent.content ? { note: newEvent.content } : {},
        repeat_rule: !usingRange && newEvent.repeat !== 'none' ? newEvent.repeat : undefined,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      // API returns { events: [...] } for recurring or range, or a single event
      const created = Array.isArray(data.events) ? data.events : [data]
      setEvents((prev) => [...prev, ...created])
    }
    setAddingEvent(null); setNewEvent({ type: 'task', title: '', content: '', repeat: 'none', endDate: '' }); setSaving(false)
  }

  async function deleteEvent(id: string) {
    const evt = events.find(e => e.id === id)
    const recurrenceId = evt?.content?.recurrence_id as string | undefined
    if (recurrenceId) {
      // Show series delete prompt
      setDeletingSeriesId(id)
      return
    }
    await fetch(`/api/coach/clients/${clientId}/calendar/${id}`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  async function deleteOnlyThis(id: string) {
    await fetch(`/api/coach/clients/${clientId}/calendar/${id}`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setDeletingSeriesId(null)
  }

  async function deleteAllFuture(id: string) {
    const evt = events.find(e => e.id === id)
    const recurrenceId = evt?.content?.recurrence_id as string | undefined
    const today = toDateStr(new Date())
    const toDelete = events.filter(e =>
      (e.id === id || (recurrenceId && (e.content?.recurrence_id as string) === recurrenceId)) &&
      e.event_date >= today
    )
    await Promise.all(toDelete.map(e =>
      fetch(`/api/coach/clients/${clientId}/calendar/${e.id}`, { method: 'DELETE' })
    ))
    setEvents((prev) => prev.filter(e => !toDelete.some(d => d.id === e.id)))
    setDeletingSeriesId(null)
  }

  async function moveEvent(id: string, newDate: string) {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, event_date: newDate } : e))
    await fetch(`/api/coach/clients/${clientId}/calendar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date: newDate }),
    })
  }

  function handleDragStart(e: React.DragEvent, eventId: string) {
    setDragEventId(eventId)
    e.dataTransfer.effectAllowed = 'move'
  }

  async function moveWorkout(programId: string, weekIdx: number, dayIdx: number, newDate: string) {
    // Find existing override event for this workout
    const existing = events.find(
      (e) =>
        e.type === 'program_workout_override' &&
        (e.content as Record<string, unknown>).program_id === programId &&
        (e.content as Record<string, unknown>).week_index === weekIdx &&
        (e.content as Record<string, unknown>).day_index === dayIdx
    )
    if (existing) {
      setEvents((prev) => prev.map((e) => e.id === existing.id ? { ...e, event_date: newDate } : e))
      await fetch(`/api/coach/clients/${clientId}/calendar/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_date: newDate }),
      })
    } else {
      const res = await fetch(`/api/coach/clients/${clientId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_date: newDate,
          type: 'program_workout_override',
          title: '',
          content: { program_id: programId, week_index: weekIdx, day_index: dayIdx },
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setEvents((prev) => [...prev, created])
      }
    }
  }

  function handleDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(dateStr)
  }

  function handleDrop(e: React.DragEvent, dateStr: string) {
    e.preventDefault()
    if (dragEventId) moveEvent(dragEventId, dateStr)
    else if (dragWorkout) moveWorkout(dragWorkout.programId, dragWorkout.weekIdx, dragWorkout.dayIdx, dateStr)
    setDragEventId(null)
    setDragWorkout(null)
    setDragOverDate(null)
  }

  function handleDragEnd() {
    setDragEventId(null)
    setDragWorkout(null)
    setDragOverDate(null)
  }

  const today = toDateStr(new Date())

  const periodLabel = calView === 'week'
    ? `${weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : monthStart.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="space-y-4">
      {/* Nav bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={goToToday} className="text-xs font-semibold text-blue-600 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100">Today</button>
          <button onClick={nextPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button
            onClick={() => datePickerRef.current?.showPicker()}
            className="text-sm font-semibold text-gray-700 ml-1 hover:text-blue-600 transition-colors cursor-pointer"
            title="Jump to date"
          >
            {periodLabel}
          </button>
          <input
            ref={datePickerRef}
            type="date"
            className="sr-only"
            value={datePickerValue}
            onChange={handleDatePickerChange}
          />
        </div>
        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          <button onClick={() => switchView('week')}
            className={`px-3 py-1.5 transition-colors ${calView === 'week' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            Week
          </button>
          <button onClick={() => switchView('month')}
            className={`px-3 py-1.5 transition-colors ${calView === 'month' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            Month
          </button>
        </div>
      </div>

      {/* Habits legend */}
      {habits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {habits.map((h) => (
            <span key={h.id} className="text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-100 rounded-full px-2 py-0.5">
              {h.icon ?? '✅'} {h.name}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading calendar…</p>
      ) : error ? (
        <p className="text-sm text-red-500 text-center py-10">{error}</p>
      ) : calView === 'week' ? (
        /* ── Week grid ── */
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
            const dateStr = toDateStr(day)
            const isToday = dateStr === today
            const isPast = dateStr < today
            const dayEvents = events.filter((e) => e.event_date === dateStr && e.type !== 'program_workout_result' && e.type !== 'program_workout_override')
            const workouts = getWorkoutsForDate(programs, day, events)
            const macros = foodByDate[dateStr]
            const hasContent = workouts.length > 0 || dayEvents.length > 0 || macros

            return (
              <div
                key={dateStr}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDrop={(e) => handleDrop(e, dateStr)}
                onDragLeave={() => setDragOverDate(null)}
                className={`rounded-xl border p-2 min-h-[150px] flex flex-col gap-1 transition-colors ${
                  dragOverDate === dateStr ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-300' :
                  isToday ? 'border-blue-400 bg-blue-50/40' : isPast ? 'bg-gray-50/50 border-gray-100' : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">{day.toLocaleDateString('en-AU', { weekday: 'short' })}</p>
                    <button
                    onClick={() => { setMonthStart(new Date(day.getFullYear(), day.getMonth(), 1)); switchView('month') }}
                    title="View in month"
                    className={`text-sm font-bold leading-none transition-colors ${isToday ? 'text-blue-600' : 'text-gray-800 hover:text-blue-500'}`}
                  >{day.getDate()}</button>
                  </div>
                  <button onClick={() => setAddingEvent(dateStr)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-300 hover:text-gray-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>
                {workouts.map((w, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragWorkout({ programId: w.programId, weekIdx: w.weekIdx, dayIdx: w.dayIdx }) }}
                    onDragEnd={handleDragEnd}
                    className={`w-full text-left text-[10px] rounded-md px-1.5 py-1 font-medium transition-colors cursor-grab active:cursor-grabbing ${dragWorkout?.programId === w.programId && dragWorkout?.weekIdx === w.weekIdx && dragWorkout?.dayIdx === w.dayIdx ? 'opacity-40' : ''} ${
                      w.result ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}
                  >
                    <button className="w-full text-left" onClick={() => setViewingWorkout(w)}>
                      <div className="flex items-center gap-1">
                        <p className="truncate font-semibold flex-1">💪 {w.dayName}</p>
                        {w.result && <svg className="w-3 h-3 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <p className="opacity-70 truncate">{w.programName} · {w.result ? `done ${new Date(w.result.event_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : `${w.exerciseCount} ex`}</p>
                    </button>
                  </div>
                ))}
                {macros && (
                  <div className="text-[10px] bg-orange-50 text-orange-700 border border-orange-100 rounded-md px-1.5 py-1 space-y-0.5">
                    <p className="font-semibold">{Math.round(macros.cal)} kcal</p>
                    <p className="opacity-80">P {Math.round(macros.protein)}g · C {Math.round(macros.carbs)}g · F {Math.round(macros.fat)}g</p>
                  </div>
                )}
                {habits.length > 0 && (
                  <div className="text-[10px] bg-teal-50 text-teal-600 border border-teal-100 rounded-md px-1.5 py-0.5 font-medium">
                    {habits.length} habit{habits.length !== 1 ? 's' : ''}
                  </div>
                )}
                {dayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, evt.id)}
                    onDragEnd={handleDragEnd}
                    className={`text-[10px] rounded-md px-1.5 py-0.5 font-medium truncate border flex items-center justify-between gap-0.5 group cursor-grab active:cursor-grabbing ${dragEventId === evt.id ? 'opacity-40' : ''} ${EVENT_COLORS[evt.type] ?? EVENT_COLORS.custom}`}
                  >
                    {evt.type === 'autoflow' ? (
                      <button onClick={() => openAutoflowStep(evt)} className="truncate text-left hover:underline flex-1">⚡ {evt.title}</button>
                    ) : evt.type === 'workout' ? (
                      <button onClick={() => setViewingPersonalWorkout(evt)} className="truncate text-left hover:underline flex-1">💪 {evt.title}</button>
                    ) : (
                      <span className="truncate flex-1">{evt.title}</span>
                    )}
                    <button onClick={() => deleteEvent(evt.id)} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                {!hasContent && habits.length === 0 && (
                  <p className="text-[10px] text-gray-300 mt-auto text-center pb-1">Rest</p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Month grid ── */
        <div>
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {DAY_HEADERS.map((d) => (
              <p key={d} className="text-[10px] font-semibold text-gray-400 uppercase text-center py-1">{d}</p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {monthGridDays.map((day) => {
              const dateStr = toDateStr(day)
              const isToday = dateStr === today
              const isCurrentMonth = day.getMonth() === monthStart.getMonth()
              const dayEvents = events.filter((e) => e.event_date === dateStr && e.type !== 'program_workout_result' && e.type !== 'program_workout_override')
              const workouts = getWorkoutsForDate(programs, day, events)
              const macros = foodByDate[dateStr]

              return (
                <div
                key={dateStr}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDrop={(e) => handleDrop(e, dateStr)}
                onDragLeave={() => setDragOverDate(null)}
                className={`min-h-[90px] p-1.5 flex flex-col gap-0.5 transition-colors ${
                  dragOverDate === dateStr ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' :
                  isToday ? 'bg-blue-50' : isCurrentMonth ? 'bg-white' : 'bg-gray-50/60'
                }`}
              >
                  {/* Date number + add button */}
                  <div className="flex items-center justify-between mb-0.5">
                    <button
                      onClick={() => { setWeekStart(getWeekStart(day)); switchView('week') }}
                      title="View this week"
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                        isToday ? 'bg-blue-500 text-white' : isCurrentMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                    <button onClick={() => setAddingEvent(dateStr)} className="w-4 h-4 flex items-center justify-center text-gray-200 hover:text-gray-400">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>

                  {/* Workouts */}
                  {workouts.map((w, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragWorkout({ programId: w.programId, weekIdx: w.weekIdx, dayIdx: w.dayIdx }) }}
                      onDragEnd={handleDragEnd}
                      className={`w-full text-left text-[9px] leading-tight rounded px-1 py-0.5 font-semibold truncate cursor-grab active:cursor-grabbing ${dragWorkout?.programId === w.programId && dragWorkout?.weekIdx === w.weekIdx && dragWorkout?.dayIdx === w.dayIdx ? 'opacity-40' : ''} ${
                        w.result ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <button className="w-full text-left truncate" onClick={() => setViewingWorkout(w)}>
                        {w.result ? '✓ ' : ''}{w.dayName}
                      </button>
                    </div>
                  ))}

                  {/* Macros dot */}
                  {macros && (
                    <div className="text-[9px] bg-orange-50 text-orange-600 rounded px-1 py-0.5 font-semibold truncate">
                      {Math.round(macros.cal)} kcal
                    </div>
                  )}

                  {/* Custom events */}
                  {dayEvents.slice(0, 2).map((evt) => (
                    <div
                      key={evt.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, evt.id)}
                      onDragEnd={handleDragEnd}
                      className={`text-[9px] rounded px-1 py-0.5 font-medium truncate cursor-grab active:cursor-grabbing ${dragEventId === evt.id ? 'opacity-40' : ''} ${EVENT_COLORS[evt.type] ?? EVENT_COLORS.custom}`}
                    >
                      {evt.type === 'autoflow' ? (
                        <button onClick={() => openAutoflowStep(evt)} className="w-full text-left hover:opacity-80 truncate">⚡ {evt.title}</button>
                      ) : evt.type === 'workout' ? (
                        <button onClick={() => setViewingPersonalWorkout(evt)} className="w-full text-left hover:opacity-80 truncate">💪 {evt.title}</button>
                      ) : evt.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="text-[9px] text-gray-400 px-1">+{dayEvents.length - 2} more</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Autoflow step modal */}
      {viewingAutoflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <p className="text-[11px] text-orange-500 font-semibold uppercase tracking-wide mb-0.5">Autoflow step</p>
                <h3 className="text-sm font-bold text-gray-900 leading-snug">{viewingAutoflow.title}</h3>
              </div>
              <button onClick={() => { setViewingAutoflow(null); setAutoflowStepData(null) }} className="text-gray-400 hover:text-gray-600 ml-3 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {autoflowLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : autoflowStepData ? (
                <>
                  {/* Submission status */}
                  {autoflowStepData.response ? (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <p className="text-xs text-green-700 font-medium">Submitted {new Date(autoflowStepData.response.submitted_at).toLocaleDateString()}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>
                      <p className="text-xs text-gray-500">Not yet submitted</p>
                    </div>
                  )}

                  {/* Core questions */}
                  {autoflowStepData.core_questions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Core questions (every step)</p>
                      {autoflowStepData.core_questions.map((q, i) => (
                        <div key={q.id ?? i} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                          <p className="text-xs text-gray-700">{i + 1}. {q.label}</p>
                          {autoflowStepData.response?.answers?.[q.id] && (
                            <p className="text-xs font-medium text-gray-900 mt-1 pl-3 border-l-2 border-gray-300">{String(autoflowStepData.response.answers[q.id])}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step questions */}
                  {autoflowStepData.questions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Step questions</p>
                      {autoflowStepData.questions.map((q, i) => (
                        <div key={q.id ?? i} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                          <p className="text-xs text-gray-700">{i + 1}. {q.label}</p>
                          {autoflowStepData.response?.answers?.[q.id] && (
                            <p className="text-xs font-medium text-gray-900 mt-1 pl-3 border-l-2 border-gray-300">{String(autoflowStepData.response.answers[q.id])}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {autoflowStepData.core_questions.length === 0 && autoflowStepData.questions.length === 0 && (
                    <p className="text-xs text-gray-400">No questions configured for this step.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">Could not load step data.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workout results modal */}
      {viewingPersonalWorkout && (
        <CoachPersonalWorkoutModal event={viewingPersonalWorkout} clientId={clientId} onClose={() => setViewingPersonalWorkout(null)} />
      )}
      {viewingWorkout && (
        <CoachWorkoutModal workout={viewingWorkout} clientId={clientId} clientTimezone={clientTimezone} onClose={() => setViewingWorkout(null)} />
      )}

      {/* Add event modal */}
      {addingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Add Event — {new Date(addingEvent + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
              <button onClick={() => setAddingEvent(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <select value={newEvent.type} onChange={(e) => setNewEvent((n) => ({ ...n, type: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <optgroup label="Coach events">
                <option value="task">📌 Task</option>
                <option value="note">📝 Note</option>
                <option value="workout">💪 Workout</option>
                <option value="steps">👟 Steps Goal</option>
                <option value="habit">✅ Habit</option>
                <option value="custom">⚡ Custom</option>
              </optgroup>
              <optgroup label="Client events (on their behalf)">
                <option value="personal">🎉 Personal / Social</option>
                <option value="travel">✈️ Travel / Away</option>
                <option value="extra_activity">🏃 Extra Activity</option>
              </optgroup>
            </select>
            <input type="text" value={newEvent.title} onChange={(e) => setNewEvent((n) => ({ ...n, title: e.target.value }))}
              placeholder={
                newEvent.type === 'task' ? 'e.g. Weigh in, Submit check-in…' :
                newEvent.type === 'personal' ? 'Birthday dinner, date night…' :
                newEvent.type === 'travel' ? 'Holiday, trip, going away…' :
                newEvent.type === 'extra_activity' ? 'Walk, swim, bike ride…' :
                newEvent.type === 'steps' ? '10,000 steps today' :
                newEvent.type === 'workout' ? 'Upper body session' :
                'Title'
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
            <textarea value={newEvent.content} onChange={(e) => setNewEvent((n) => ({ ...n, content: e.target.value }))}
              placeholder={
                newEvent.type === 'travel' ? 'Where are you going? Any context for the coach…' :
                newEvent.type === 'personal' ? 'Any notes for the coach…' :
                'Notes (optional)'
              } rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />

            {/* Travel-only: end date so the trip spans multiple days. */}
            {newEvent.type === 'travel' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Return date <span className="text-gray-300">(optional)</span></label>
                <input
                  type="date"
                  value={newEvent.endDate}
                  min={addingEvent}
                  onChange={(e) => setNewEvent((n) => ({ ...n, endDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {newEvent.endDate && newEvent.endDate > addingEvent && (
                  <p className="text-[11px] text-gray-400">
                    {`Marks every day from ${new Date(addingEvent + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} to ${new Date(newEvent.endDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}.`}
                  </p>
                )}
              </div>
            )}

            {/* Repeat — hidden when travel has a date range (mutually exclusive). */}
            {!(newEvent.type === 'travel' && newEvent.endDate && newEvent.endDate > addingEvent) && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Repeat</label>
                <select value={newEvent.repeat} onChange={(e) => setNewEvent((n) => ({ ...n, repeat: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="none">Does not repeat</option>
                  <option value="weekly">Every week</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Every month</option>
                </select>
                {newEvent.repeat !== 'none' && (
                  <p className="text-[11px] text-gray-400">
                    {newEvent.repeat === 'weekly' && `Repeats every ${new Date(addingEvent + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long' })} for 1 year`}
                    {newEvent.repeat === 'biweekly' && `Repeats every 2 weeks on ${new Date(addingEvent + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long' })} for 1 year`}
                    {newEvent.repeat === 'monthly' && `Repeats on the ${new Date(addingEvent + 'T00:00:00').getDate()}th of each month for 1 year`}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setAddingEvent(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
              <button onClick={() => saveEvent(addingEvent)} disabled={!newEvent.title.trim() || saving}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving
                  ? 'Saving…'
                  : (newEvent.type === 'travel' && newEvent.endDate && newEvent.endDate > addingEvent)
                    ? 'Add trip'
                    : newEvent.repeat !== 'none'
                      ? 'Add recurring'
                      : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Series delete prompt */}
      {deletingSeriesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Delete recurring event</h3>
            <p className="text-sm text-gray-500">This is part of a recurring series. What would you like to delete?</p>
            <div className="space-y-2">
              <button onClick={() => deleteOnlyThis(deletingSeriesId)}
                className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                This event only
              </button>
              <button onClick={() => deleteAllFuture(deletingSeriesId)}
                className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50">
                This and all future events in series
              </button>
              <button onClick={() => setDeletingSeriesId(null)}
                className="w-full text-gray-400 py-2 text-sm hover:text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
