import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; workoutId: string }> }

// GET /api/coach/clients/[clientId]/workouts/[workoutId]
// Returns full workout detail (exercises + sets + sections) for a client's personal workout.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { clientId, workoutId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify coach manages this client
  const { data: rel } = await admin
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()

  if (!rel) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  // Fetch the workout
  const { data: workout, error: wErr } = await admin
    .from('workouts')
    .select('id, name, started_at, ended_at, notes')
    .eq('id', workoutId)
    .eq('user_id', clientId)
    .single()

  if (wErr || !workout) return Response.json({ error: 'Not found' }, { status: 404 })

  // Fetch exercises
  const { data: weRows } = await admin
    .from('workout_exercises')
    .select('id, order_index, notes, exercises(id, name, category, equipment)')
    .eq('workout_id', workoutId)
    .order('order_index')

  const weIds = (weRows ?? []).map((r) => r.id)

  const { data: sets } = weIds.length
    ? await admin
        .from('exercise_sets')
        .select('workout_exercise_id, set_number, weight_lbs, reps, duration_seconds, calories')
        .in('workout_exercise_id', weIds)
        .order('set_number')
    : { data: [] }

  const exercises = (weRows ?? []).map((we) => {
    const ex = (we.exercises as unknown) as { id: string; name: string; category: string; equipment: string } | null
    return {
      weId: we.id,
      name: ex?.name ?? '',
      category: ex?.category ?? '',
      notes: (we.notes as string | null) ?? null,
      sets: (sets ?? [])
        .filter((s) => s.workout_exercise_id === we.id)
        .map((s) => ({
          setNumber: s.set_number,
          weightLbs: s.weight_lbs,
          reps: s.reps,
          durationSeconds: s.duration_seconds,
          calories: s.calories,
        })),
    }
  })

  // Parse freestyle sections from workout notes
  let sections: Array<{ title: string; notes: string; scoreType: string; scoreValue: string }> = []
  try {
    if (workout.notes) {
      const parsed = JSON.parse(workout.notes as string)
      if (Array.isArray(parsed)) sections = parsed
    }
  } catch { /* no sections */ }

  const duration = workout.ended_at
    ? Math.round((new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime()) / 60000)
    : null

  return Response.json({ ...workout, duration_min: duration, exercises, sections })
}
