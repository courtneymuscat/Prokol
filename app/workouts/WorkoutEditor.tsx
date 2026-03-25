'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ExerciseSearch, { type Exercise } from './ExerciseSearch'
import type { ScoreType } from './ActiveWorkout'

type SectionDisplay = {
  id: string
  title: string
  notes: string
  scoreType: ScoreType
  scoreValue: string
  linkedExercise: Exercise | null
}

type SetDisplay = {
  id: string
  set_number: number
  weight_lbs: number | null
  reps: number | null
  duration_seconds: number | null
  calories: number | null
}

type ExerciseDisplay = {
  weId: string
  exerciseId: string
  name: string
  category: string
  equipment: string
  sets: SetDisplay[]
  notes: string
}

type Props = {
  workoutId: string
  onClose: () => void
  onSaved: () => void
}

export default function WorkoutEditor({ workoutId, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [exercises, setExercises] = useState<ExerciseDisplay[]>([])
  const [sections, setSections] = useState<SectionDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { load() }, [workoutId])

  async function load() {
    const { data: w } = await supabase
      .from('workouts')
      .select('name, started_at, notes')
      .eq('id', workoutId)
      .single()
    if (!w) return
    setName(w.name)
    setDate(w.started_at)
    try {
      const parsed = JSON.parse((w as Record<string, unknown>).notes as string ?? '')
      if (Array.isArray(parsed)) {
        setSections(parsed.map((s: Record<string, unknown>) => ({
          id: `s-${Date.now()}-${Math.random()}`,
          title: String(s.title ?? ''),
          notes: String(s.notes ?? ''),
          scoreType: (s.scoreType as ScoreType) ?? 'time',
          scoreValue: String(s.scoreValue ?? ''),
          linkedExercise: (s.linkedExercise as Exercise | null) ?? null,
        })))
      }
    } catch { /* no sections or column missing */ }

    const { data: weRows } = await supabase
      .from('workout_exercises')
      .select('id, order_index, exercises(id, name, category, equipment)')
      .eq('workout_id', workoutId)
      .order('order_index')

    if (!weRows?.length) { setLoading(false); return }

    const weIds = weRows.map((r) => r.id)

    // Load exercise notes separately — resilient to column not existing
    const notesMap: Record<string, string> = {}
    try {
      const { data: notesRows } = await supabase
        .from('workout_exercises')
        .select('id, notes')
        .in('id', weIds)
      if (notesRows) {
        for (const r of notesRows) {
          if ((r as Record<string, unknown>).notes) notesMap[r.id] = (r as Record<string, unknown>).notes as string
        }
      }
    } catch { /* notes column missing — skip */ }
    const { data: sets } = await supabase
      .from('exercise_sets')
      .select('id, workout_exercise_id, set_number, weight_lbs, reps, duration_seconds, calories')
      .in('workout_exercise_id', weIds)
      .order('set_number')

    setExercises(
      weRows.map((we) => {
        const ex = (we.exercises as unknown) as { id: string; name: string; category: string; equipment: string } | null
        return {
          weId: we.id,
          exerciseId: ex?.id ?? '',
          name: ex?.name ?? '',
          category: ex?.category ?? '',
          equipment: ex?.equipment ?? '',
          notes: notesMap[we.id] ?? '',
          sets: (sets ?? [])
            .filter((s) => s.workout_exercise_id === we.id)
            .map((s) => ({
              id: s.id,
              set_number: s.set_number,
              weight_lbs: s.weight_lbs,
              reps: s.reps,
              duration_seconds: s.duration_seconds,
              calories: s.calories,
            })),
        }
      }),
    )
    setLoading(false)
  }

  async function updateSet(setId: string, field: string, value: string) {
    const num = value === '' ? null : parseFloat(value)
    await supabase.from('exercise_sets').update({ [field]: num }).eq('id', setId)
    setExercises((prev) =>
      prev.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: field === 'weight_lbs' ? num : num } : s)),
      })),
    )
  }

  async function deleteSet(weId: string, setId: string) {
    await supabase.from('exercise_sets').delete().eq('id', setId)
    setExercises((prev) =>
      prev.map((ex) =>
        ex.weId === weId ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) } : ex,
      ),
    )
  }

  async function addSet(weId: string) {
    const ex = exercises.find((e) => e.weId === weId)
    if (!ex) return
    const lastSet = ex.sets[ex.sets.length - 1]
    const nextNum = (lastSet?.set_number ?? 0) + 1
    const { data } = await supabase
      .from('exercise_sets')
      .insert({
        workout_exercise_id: weId,
        set_number: nextNum,
        weight_lbs: lastSet?.weight_lbs ?? null,
        reps: lastSet?.reps ?? null,
        duration_seconds: lastSet?.duration_seconds ?? null,
        calories: lastSet?.calories ?? null,
        completed: true,
      })
      .select('id')
      .single()
    if (!data) return
    setExercises((prev) =>
      prev.map((e) =>
        e.weId === weId
          ? { ...e, sets: [...e.sets, { id: data.id, set_number: nextNum, weight_lbs: lastSet?.weight_lbs ?? null, reps: lastSet?.reps ?? null, duration_seconds: lastSet?.duration_seconds ?? null, calories: lastSet?.calories ?? null }] }
          : e,
      ),
    )
  }

  async function removeExercise(weId: string) {
    await supabase.from('workout_exercises').delete().eq('id', weId)
    setExercises((prev) => prev.filter((e) => e.weId !== weId))
  }

  async function updateNotes(weId: string, notes: string) {
    await supabase.from('workout_exercises').update({ notes: notes || null }).eq('id', weId)
  }

  async function addExercise(exercise: Exercise) {
    setShowAddExercise(false)
    const { data } = await supabase
      .from('workout_exercises')
      .insert({ workout_id: workoutId, exercise_id: exercise.id, order_index: exercises.length })
      .select('id')
      .single()
    if (!data) return
    setExercises((prev) => [
      ...prev,
      { weId: data.id, exerciseId: exercise.id, name: exercise.name, category: exercise.category, equipment: exercise.equipment, sets: [], notes: '' },
    ])
  }

  function addSection() {
    setSections((prev) => [...prev, {
      id: `s-${Date.now()}`,
      title: '',
      notes: '',
      scoreType: 'time',
      scoreValue: '',
      linkedExercise: null,
    }])
  }

  function updateSection(id: string, field: keyof SectionDisplay, value: string) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s))
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id))
  }

  async function save() {
    setSaving(true)
    const notes = sections.length > 0
      ? JSON.stringify(sections.map(({ title, notes: n, scoreType, scoreValue, linkedExercise }) => ({
          title, notes: n, scoreType, scoreValue, linkedExercise,
        })))
      : null
    const payload: Record<string, unknown> = { name, started_at: date }
    if (notes !== null) payload.notes = notes
    await supabase.from('workouts').update(payload).eq('id', workoutId)
    onSaved()
  }

  async function deleteWorkout() {
    await supabase.from('workouts').delete().eq('id', workoutId)
    onSaved()
  }

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">Loading...</p>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <input
          type="date"
          value={date ? date.slice(0, 10) : ''}
          onChange={(e) => setDate(e.target.value ? new Date(e.target.value).toISOString() : date)}
          className="text-sm text-gray-500 bg-transparent border-none outline-none cursor-pointer flex-1"
        />
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-xs text-red-400 hover:text-red-600 font-medium flex-shrink-0"
        >
          Delete
        </button>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">Delete this workout?</p>
          <p className="text-xs text-red-600">This will permanently remove the workout and all logged sets.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
              Cancel
            </button>
            <button onClick={deleteWorkout} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Editable title */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Workout Title</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-2xl font-semibold text-gray-900 bg-transparent border-b-2 border-gray-200 focus:border-blue-400 outline-none w-full placeholder:text-gray-300"
          placeholder="e.g. Monday Push, Leg Day..."
        />
      </div>

      {/* Exercises */}
      {exercises.map((ex) => {
        const isCardio = ex.category === 'cardio'
        return (
          <div key={ex.weId} className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{ex.name}</p>
                <p className="text-xs text-gray-400 capitalize mt-0.5">{ex.category} · {ex.equipment}</p>
              </div>
              <button
                onClick={() => removeExercise(ex.weId)}
                className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0"
                title="Remove movement"
              >×</button>
            </div>

            {/* Column headers */}
            <div className={`grid gap-2 text-xs text-gray-400 font-medium px-1 ${isCardio ? 'grid-cols-[24px_1fr_1fr_36px]' : 'grid-cols-[24px_1fr_1fr_36px]'}`}>
              <span className="text-center">#</span>
              <span className="text-center">{isCardio ? 'Calories' : 'Weight'}</span>
              <span className="text-center">{isCardio ? 'Time (sec)' : 'Reps'}</span>
              <span />
            </div>

            {/* Set rows — always editable */}
            {ex.sets.length === 0 && (
              <p className="text-xs text-gray-400 italic">No sets yet — add one below</p>
            )}
            {ex.sets.map((set) => (
              <div key={set.id} className="grid grid-cols-[24px_1fr_1fr_36px] gap-2 items-center">
                <span className="text-sm text-gray-400 text-center">{set.set_number}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  defaultValue={isCardio ? (set.calories ?? '') : (set.weight_lbs ?? '')}
                  onBlur={(e) => updateSet(set.id, isCardio ? 'calories' : 'weight_lbs', e.target.value)}
                  placeholder="—"
                  className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  defaultValue={isCardio ? (set.duration_seconds ?? '') : (set.reps ?? '')}
                  onBlur={(e) => updateSet(set.id, isCardio ? 'duration_seconds' : 'reps', e.target.value)}
                  placeholder="—"
                  className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
                <button
                  onClick={() => deleteSet(ex.weId, set.id)}
                  className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-red-400 text-xl"
                >×</button>
              </div>
            ))}

            <button
              onClick={() => addSet(ex.weId)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >+ Add Set</button>

            {/* Notes */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1">Notes</p>
              <textarea
                value={ex.notes}
                onChange={(e) => setExercises((prev) => prev.map((e2) => e2.weId === ex.weId ? { ...e2, notes: e.target.value } : e2))}
                onBlur={(e) => updateNotes(ex.weId, e.target.value)}
                placeholder="e.g. Weight felt heavy today, used bands..."
                rows={2}
                className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300"
              />
            </div>
          </div>
        )
      })}

      {/* Add movement */}
      {showAddExercise ? (
        <ExerciseSearch onSelect={addExercise} onClose={() => setShowAddExercise(false)} />
      ) : (
        <button
          onClick={() => setShowAddExercise(true)}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          + Add Movement
        </button>
      )}

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.id} className="bg-white rounded-xl border border-purple-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">
              Section
            </span>
            <input
              value={section.title}
              onChange={(e) => updateSection(section.id, 'title', e.target.value)}
              placeholder="Section title (e.g. Warm Up, Metcon, Notes)"
              className="flex-1 text-sm font-semibold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-gray-300 min-w-0"
            />
            <button
              onClick={() => removeSection(section.id)}
              className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0"
            >×</button>
          </div>
          <textarea
            value={section.notes}
            onChange={(e) => updateSection(section.id, 'notes', e.target.value)}
            placeholder="Add notes, instructions, or reminders..."
            rows={3}
            className="w-full text-sm text-gray-700 border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 placeholder:text-gray-300"
          />
          {/* Score */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</p>
            <div className="flex gap-1.5 flex-wrap">
              {(['time', 'reps', 'rounds', 'weight', 'distance', 'calories', 'custom'] as ScoreType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSections((prev) => prev.map((s) => s.id === section.id ? { ...s, scoreType: t, scoreValue: '' } : s))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${section.scoreType === t ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {t === 'rounds' ? 'Rounds+Reps' : t}
                </button>
              ))}
            </div>
            <input
              type={section.scoreType === 'custom' ? 'text' : 'number'}
              value={section.scoreValue}
              onChange={(e) => setSections((prev) => prev.map((s) => s.id === section.id ? { ...s, scoreValue: e.target.value } : s))}
              placeholder={section.scoreType === 'custom' ? 'e.g. 21-15-9, Rx...' : '0'}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-300"
            />
          </div>
        </div>
      ))}

      <button
        onClick={addSection}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-purple-200 rounded-xl py-3 text-sm text-purple-400 hover:border-purple-400 hover:text-purple-600 transition-colors"
      >
        + Add Section
      </button>

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        <button
          onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
