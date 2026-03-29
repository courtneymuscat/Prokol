import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

/** Verify the coach actually owns this client relationship */
async function verifyAccess(coachId: string, clientId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()
  return !!data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()

  const [checkIns, workoutsRaw, weightLogs, foodLogs] = await Promise.all([
    supabase
      .from('check_ins')
      .select('id, created_at, sleep_hours, sleep_quality, energy_level, rhr, hrv, notes, coach_feedback, reviewed_by_coach')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('workouts')
      .select('id, name, started_at, ended_at')
      .eq('user_id', clientId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(20),

    supabase
      .from('weight_logs')
      .select('logged_at, weight_lbs, weight_unit')
      .eq('user_id', clientId)
      .order('logged_at', { ascending: false })
      .limit(30),

    supabase
      .from('food_logs')
      .select('id, log_date, meal_type, food_name, calories, protein, carbs, fat, scan_image_url')
      .eq('user_id', clientId)
      .order('log_date', { ascending: false })
      .limit(50),
  ])

  // Fetch exercise details for workouts
  const workoutIds = (workoutsRaw.data ?? []).map((w) => w.id)
  const workoutExercises = workoutIds.length
    ? await supabase
        .from('workout_exercises')
        .select('workout_id, order_index, notes, video_url, exercises(id, name, category)')
        .in('workout_id', workoutIds)
        .order('order_index')
    : { data: [] }

  const workouts = (workoutsRaw.data ?? []).map((w) => ({
    ...w,
    exercises: ((workoutExercises.data ?? []) as unknown as Array<{
      workout_id: string
      order_index: number
      notes: string | null
      video_url: string | null
      exercises: { id: string; name: string; category: string } | null
    }>)
      .filter((we) => we.workout_id === w.id)
      .map((we) => ({
        name: we.exercises?.name ?? '',
        category: we.exercises?.category ?? '',
        notes: we.notes ?? null,
        video_url: we.video_url ?? null,
      })),
  }))

  return Response.json({
    checkIns: checkIns.data ?? [],
    workouts,
    weightLogs: weightLogs.data ?? [],
    foodLogs: foodLogs.data ?? [],
  })
}

/** Remove client from coach's roster */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  await supabase
    .from('coach_clients')
    .update({ status: 'removed' })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)

  return Response.json({ ok: true })
}
