import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return Response.json([])

  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', session.user.id)
    .order('started_at', { ascending: false })
    .limit(10)

  if (!recentWorkouts?.length) return Response.json([])

  const workoutIds = recentWorkouts.map((w) => w.id)

  const { data } = await supabase
    .from('workout_exercises')
    .select('exercise_id, exercises(id, name, category, equipment, muscles, video_url)')
    .in('workout_id', workoutIds)

  if (!data) return Response.json([])

  const seen = new Set<string>()
  const recent: Array<{ id: string; name: string; category: string; equipment: string; muscles?: string; video_url: string | null }> = []
  for (const we of data) {
    if (!we.exercises || seen.has(we.exercise_id)) continue
    seen.add(we.exercise_id)
    recent.push(we.exercises as unknown as typeof recent[number])
    if (recent.length >= 8) break
  }

  // Apply coach-specific video URL overrides
  const coachId = await requireCoach()
  if (coachId && recent.length > 0) {
    const ids = recent.map((e) => e.id)
    const { data: overrides } = await supabase
      .from('coach_exercise_videos')
      .select('exercise_id, video_url')
      .eq('coach_id', coachId)
      .in('exercise_id', ids)
    if (overrides?.length) {
      const overrideMap = Object.fromEntries(overrides.map((o) => [o.exercise_id, o.video_url]))
      for (const ex of recent) {
        if (overrideMap[ex.id] !== undefined) ex.video_url = overrideMap[ex.id]
      }
    }
  }

  return Response.json(recent)
}
