import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

type HistoryEntry = {
  workoutName: string
  date: string
  notes: string | null
  sets: {
    set_number: number
    weight_lbs: number | null
    reps: number | null
    duration_seconds: number | null
    calories: number | null
  }[]
}

export async function GET(req: NextRequest) {
  const exerciseId = req.nextUrl.searchParams.get('exerciseId')
  if (!exerciseId) return Response.json([])

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json([])

  const userId = session.user.id
  const history: HistoryEntry[] = []

  // ── Source 1: freestyle workouts (workout_exercises + exercise_sets) ─────────
  const { data: userWorkouts } = await supabase
    .from('workouts')
    .select('id, name, started_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(30)

  if (userWorkouts?.length) {
    const workoutIds = userWorkouts.map((w) => w.id)

    const { data: weRows } = await supabase
      .from('workout_exercises')
      .select('id, workout_id')
      .eq('exercise_id', exerciseId)
      .in('workout_id', workoutIds)

    if (weRows?.length) {
      const weIds = weRows.map((r) => r.id)

      const notesMap: Record<string, string | null> = {}
      try {
        const { data: notesRows } = await supabase
          .from('workout_exercises')
          .select('id, notes')
          .in('id', weIds)
        if (notesRows) {
          for (const r of notesRows) {
            notesMap[r.id] = (r as Record<string, unknown>).notes as string | null ?? null
          }
        }
      } catch { /* notes column missing */ }

      const { data: sets } = await supabase
        .from('exercise_sets')
        .select('workout_exercise_id, set_number, weight_lbs, reps, duration_seconds, calories')
        .in('workout_exercise_id', weIds)
        .order('set_number')

      const workoutMap = Object.fromEntries(userWorkouts.map((w) => [w.id, w]))

      for (const we of weRows) {
        const workout = workoutMap[we.workout_id]
        const weSets = (sets ?? [])
          .filter((s) => s.workout_exercise_id === we.id)
          .map(({ set_number, weight_lbs, reps, duration_seconds, calories }) => ({
            set_number, weight_lbs, reps, duration_seconds, calories,
          }))
        if (weSets.length > 0) {
          history.push({
            workoutName: workout?.name ?? 'Workout',
            date: workout?.started_at ?? '',
            notes: notesMap[we.id] ?? null,
            sets: weSets,
          })
        }
      }
    }
  }

  // ── Source 2: coached program sessions (calendar_events) ─────────────────────
  // Coached clients save workouts to calendar_events as program_workout_result.
  // The content JSON has an exercises array: [{ id, name, sets: [{weight, reps}], clientNote }]
  const { data: programResults } = await supabase
    .from('calendar_events')
    .select('event_date, content')
    .eq('client_id', userId)
    .eq('type', 'program_workout_result')
    .order('event_date', { ascending: false })
    .limit(30)

  if (programResults?.length) {
    for (const event of programResults) {
      const content = event.content as Record<string, unknown> | null
      if (!content) continue

      const exercises = (content.exercises ?? []) as Array<{
        id: string
        name?: string
        sets?: Array<{ weight?: string; reps?: string; duration?: string; calories?: string }>
        clientNote?: string
      }>

      const match = exercises.find((e) => e.id === exerciseId)
      if (!match) continue

      const rawSets = match.sets ?? []
      if (rawSets.length === 0) continue

      const mappedSets = rawSets.map((s, i) => ({
        set_number: i + 1,
        weight_lbs: s.weight ? (parseFloat(s.weight) || null) : null,
        reps: s.reps ? (parseInt(s.reps, 10) || null) : null,
        duration_seconds: s.duration ? (parseInt(s.duration, 10) || null) : null,
        calories: s.calories ? (parseFloat(s.calories) || null) : null,
      }))

      const dayName = (content.day_name as string | null) ?? null
      const programName = (content.program_name as string | null) ?? null
      const workoutName = [dayName, programName].filter(Boolean).join(' — ') || 'Program workout'

      history.push({
        workoutName,
        date: (content.completed_at as string | null) ?? event.event_date,
        notes: match.clientNote ?? null,
        sets: mappedSets,
      })
    }
  }

  // Sort combined history most-recent first, cap at 5
  history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return Response.json(history.slice(0, 5))
}
