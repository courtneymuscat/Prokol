import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim()
  const category = searchParams.get('category')
  const hasVideo = searchParams.get('has_video')
  const hasHowTo = searchParams.get('has_how_to')
  const limit = Math.min(Number(searchParams.get('limit') ?? 30), 100)
  const offset = Number(searchParams.get('offset') ?? 0)

  const supabase = await createClient()
  const admin = createAdminClient()

  // Build the base query with exact count for pagination
  let query = supabase
    .from('exercises')
    .select('id, name, category, equipment, muscles, video_url, how_to', { count: 'exact' })
    .order('name')
    .range(offset, offset + limit - 1)

  if (q && q.length >= 2) query = query.ilike('name', `%${q}%`)
  if (category && category !== 'all') query = query.eq('category', category)
  if (hasVideo === 'true')  query = query.not('video_url', 'is', null)
  if (hasVideo === 'false') query = query.is('video_url', null)
  if (hasHowTo === 'true')  query = query.not('how_to', 'is', null)
  if (hasHowTo === 'false') query = query.is('how_to', null)

  const { data: exercises, count } = await query
  if (!exercises?.length) return Response.json({ exercises: [], total: count ?? 0 })

  const exerciseIds = exercises.map(e => e.id)

  // Fetch this coach's per-exercise overrides for both video and how-to
  const [{ data: videoOverrides }, { data: howToOverrides }] = await Promise.all([
    admin
      .from('coach_exercise_videos')
      .select('exercise_id, video_url')
      .eq('coach_id', coachId)
      .in('exercise_id', exerciseIds),
    admin
      .from('coach_exercise_how_tos')
      .select('exercise_id, how_to')
      .eq('coach_id', coachId)
      .in('exercise_id', exerciseIds),
  ])

  const videoOverrideMap = Object.fromEntries(
    (videoOverrides ?? []).map(o => [o.exercise_id, o.video_url])
  )
  const howToOverrideMap = Object.fromEntries(
    (howToOverrides ?? []).map(o => [o.exercise_id, o.how_to])
  )

  // Coach override takes precedence over global for both video and how-to
  const merged = exercises.map(ex => ({
    id: ex.id,
    name: ex.name,
    category: ex.category,
    equipment: ex.equipment,
    muscles: ex.muscles,
    video_url: ex.id in videoOverrideMap ? videoOverrideMap[ex.id] : ex.video_url,
    how_to: ex.id in howToOverrideMap ? howToOverrideMap[ex.id] : (ex.how_to ?? null),
  }))

  return Response.json({ exercises: merged, total: count ?? 0 })
}
