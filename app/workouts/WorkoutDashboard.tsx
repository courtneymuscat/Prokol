'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ActiveWorkout from './ActiveWorkout'
import WorkoutEditor from './WorkoutEditor'
import type { Exercise } from './ExerciseSearch'

type WorkoutSummary = {
  id: string
  name: string
  started_at: string
  ended_at: string | null
  exercises: Exercise[]
  duration_min: number | null
}

export default function WorkoutDashboard({ canUploadVideo = false }: { canUploadVideo?: boolean }) {
  const [view, setView] = useState<'dashboard' | 'active' | 'edit'>('dashboard')
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [cloneTemplate, setCloneTemplate] = useState<{ name: string; exercises: Exercise[]; sections: import('./ActiveWorkout').FreestyleSection[] } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    fetchWorkouts()
  }, [])

  async function fetchWorkouts() {
    setLoading(true)
    const supabase = createClient()

    const { data: wData } = await supabase
      .from('workouts')
      .select('id, name, started_at, ended_at')
      .order('started_at', { ascending: false })
      .limit(20)

    if (!wData) { setLoading(false); return }

    const ids = wData.map((w) => w.id)

    const { data: weData } = await supabase
      .from('workout_exercises')
      .select('workout_id, order_index, exercises(id, name, category, equipment)')
      .in('workout_id', ids)
      .order('order_index')

    const summaries: WorkoutSummary[] = wData.map((w) => {
      const exRows = (weData ?? [])
        .filter((we) => we.workout_id === w.id)
        .map((we) => (we.exercises as unknown) as Exercise | null)
        .filter(Boolean) as Exercise[]
      const duration = w.ended_at
        ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000)
        : null
      return { ...w, exercises: exRows, duration_min: duration }
    })

    setWorkouts(summaries)
    setLoading(false)
  }

  async function handleClone(workout: WorkoutSummary) {
    const supabase = createClient()
    let sections: import('./ActiveWorkout').FreestyleSection[] = []
    try {
      const { data } = await supabase
        .from('workouts')
        .select('notes')
        .eq('id', workout.id)
        .single()
      if (data?.notes) {
        const parsed = JSON.parse(data.notes)
        if (Array.isArray(parsed)) {
          sections = parsed.map((s: Record<string, unknown>) => ({
            type: 'freestyle' as const,
            id: `fs-${Date.now()}-${Math.random()}`,
            title: String(s.title ?? ''),
            notes: String(s.notes ?? ''),
            linkedExercise: (s.linkedExercise as Exercise | null) ?? null,
            scoreType: (s.scoreType as import('./ActiveWorkout').ScoreType) ?? 'time',
            scoreValue: String(s.scoreValue ?? ''),
          }))
        }
      }
    } catch { /* notes column missing or malformed — skip sections */ }
    setCloneTemplate({ name: workout.name, exercises: workout.exercises, sections })
    setView('active')
  }

  function handleFinish() {
    setCloneTemplate(null)
    setView('dashboard')
    fetchWorkouts()
  }

  if (view === 'active') {
    return (
      <ActiveWorkout
        onFinish={handleFinish}
        onBack={() => { setCloneTemplate(null); setView('dashboard') }}
        template={cloneTemplate ?? undefined}
        canUploadVideo={canUploadVideo}
      />
    )
  }

  if (view === 'edit' && editingId) {
    return (
      <WorkoutEditor
        workoutId={editingId}
        onClose={() => { setEditingId(null); setView('dashboard') }}
        onSaved={() => { setEditingId(null); setView('dashboard'); fetchWorkouts() }}
      />
    )
  }

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const thisWeek = workouts.filter((w) => w.ended_at && new Date(w.started_at) >= weekStart)
  const completedWorkouts = workouts.filter((w) => w.ended_at)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Workouts</h2>
          <p className="text-sm text-gray-500 mt-1">
            {thisWeek.length} this week · {completedWorkouts.length} total
          </p>
        </div>
        <button
          onClick={() => { setCloneTemplate(null); setView('active') }}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
        >
          + Start Workout
        </button>
      </div>

      {completedWorkouts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="This week" value={String(thisWeek.length)} />
          <StatCard
            label="Avg duration"
            value={
              completedWorkouts.filter((w) => w.duration_min).length > 0
                ? `${Math.round(
                    completedWorkouts.filter((w) => w.duration_min).reduce((a, w) => a + (w.duration_min ?? 0), 0) /
                    completedWorkouts.filter((w) => w.duration_min).length,
                  )} min`
                : '—'
            }
          />
          <StatCard label="Total" value={String(completedWorkouts.length)} />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">History</h3>
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : completedWorkouts.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500 text-sm font-medium">No workouts yet</p>
            <p className="text-gray-400 text-sm mt-1">Hit Start Workout to begin your first session</p>
          </div>
        ) : (
          completedWorkouts.map((w) => (
            <WorkoutCard
              key={w.id}
              workout={w}
              onClone={() => handleClone(w)}
              onEdit={() => { setEditingId(w.id); setView('edit') }}
            />
          ))
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-3 text-center">
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

type WorkoutDetail = {
  exercises: {
    weId: string
    name: string
    category: string
    exerciseNotes: string | null
    sets: { set_number: number; weight_lbs: number | null; reps: number | null; duration_seconds: number | null; calories: number | null }[]
  }[]
  sections: { title: string; notes: string; scoreType: string; scoreValue: string }[]
}

function formatSetLine(set: WorkoutDetail['exercises'][0]['sets'][0]): string {
  const parts = [
    set.weight_lbs != null ? `${set.weight_lbs}` : null,
    set.reps != null ? `${set.reps} reps` : null,
    set.duration_seconds != null ? `${set.duration_seconds}s` : null,
    set.calories != null ? `${set.calories} cal` : null,
  ].filter(Boolean)
  return parts.join(' × ') || '—'
}

function WorkoutCard({ workout, onClone, onEdit }: { workout: WorkoutSummary; onClone: () => void; onEdit: () => void }) {
  const supabase = createClient()
  const date = new Date(workout.started_at)
  const names = workout.exercises.map((e) => e.name)
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<WorkoutDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadDetail = useCallback(async () => {
    if (detail) return
    setLoadingDetail(true)

    const { data: weRows } = await supabase
      .from('workout_exercises')
      .select('id, order_index, exercises(name, category)')
      .eq('workout_id', workout.id)
      .order('order_index')

    const weIds = (weRows ?? []).map((r) => r.id)

    const notesMap: Record<string, string | null> = {}
    try {
      const { data: notesRows } = await supabase
        .from('workout_exercises').select('id, notes').in('id', weIds)
      if (notesRows) for (const r of notesRows) notesMap[r.id] = (r as Record<string, unknown>).notes as string | null ?? null
    } catch { /* notes column missing */ }

    const { data: sets } = weIds.length
      ? await supabase.from('exercise_sets')
          .select('workout_exercise_id, set_number, weight_lbs, reps, duration_seconds, calories')
          .in('workout_exercise_id', weIds).order('set_number')
      : { data: [] }

    let sections: WorkoutDetail['sections'] = []
    try {
      const { data: w } = await supabase.from('workouts').select('notes').eq('id', workout.id).single()
      if ((w as Record<string, unknown>)?.notes) {
        const parsed = JSON.parse((w as Record<string, unknown>).notes as string)
        if (Array.isArray(parsed)) sections = parsed
      }
    } catch { /* no sections */ }

    setDetail({
      exercises: (weRows ?? []).map((we) => {
        const ex = (we.exercises as unknown) as { name: string; category: string } | null
        return {
          weId: we.id,
          name: ex?.name ?? '',
          category: ex?.category ?? '',
          exerciseNotes: notesMap[we.id] ?? null,
          sets: (sets ?? []).filter((s) => s.workout_exercise_id === we.id),
        }
      }),
      sections,
    })
    setLoadingDetail(false)
  }, [workout.id, detail])

  function toggle() {
    if (!expanded && !detail) loadDetail()
    setExpanded((v) => !v)
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header row — always visible */}
      <button onClick={toggle} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">{workout.name}</p>
              <svg
                className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {workout.duration_min ? ` · ${workout.duration_min} min` : ''}
              {' · '}{workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
            </p>
            {!expanded && names.length > 0 && (
              <p className="text-sm text-gray-500 mt-1.5 truncate">
                {names.slice(0, 5).join(', ')}
                {names.length > 5 ? ` +${names.length - 5} more` : ''}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              onClick={onClone}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Clone
            </button>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {loadingDetail && <p className="text-xs text-gray-400">Loading...</p>}
          {detail && (
            <>
              {detail.exercises.map((ex) => (
                <div key={ex.weId} className="space-y-1.5">
                  <p className="text-sm font-semibold text-gray-800">{ex.name}
                    <span className="text-xs font-normal text-gray-400 ml-1.5 capitalize">{ex.category}</span>
                  </p>
                  {ex.sets.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {ex.sets.map((s) => (
                        <span key={s.set_number} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-gray-700">
                          <span className="text-gray-400 mr-1">{s.set_number}.</span>{formatSetLine(s)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No sets recorded</p>
                  )}
                  {ex.exerciseNotes && (
                    <p className="text-xs text-gray-500 italic">"{ex.exerciseNotes}"</p>
                  )}
                </div>
              ))}
              {detail.sections.map((s, i) => (
                <div key={i} className="border-t border-gray-100 pt-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide">Section</span>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
