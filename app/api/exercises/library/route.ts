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
  const limit = Math.min(Number(searchParams.get('limit') ?? 30), 100)
  const offset = Number(searchParams.get('offset') ?? 0)

  const supabase = await createClient()
  const admin = createAdminClient()

  // Base query — apply has_video against global video_url in DB for correct pagination
  let query = supabase
    .from('exercises')
    .select('id, name, category, equipment, muscles, video_url')
    .order('name')
    .range(offset, offset + limit - 1)

  if (q && q.length >= 2) query = query.ilike('name', `%${q}%`)
  if (category && category !== 'all') query = query.eq('category', category)
  if (hasVideo === 'true')  query = query.not('video_url', 'is', null)
  if (hasVideo === 'false') query = query.is('video_url', null)

  const { data: exercises } = await query
  if (!exercises?.length) return Response.json([])

  // Fetch this coach's per-exercise video overrides and merge
  const exerciseIds = exercises.map(e => e.id)
  const { data: overrides } = await admin
    .from('coach_exercise_videos')
    .select('exercise_id, video_url')
    .eq('coach_id', coachId)
    .in('exercise_id', exerciseIds)

  const overrideMap = Object.fromEntries(
    (overrides ?? []).map(o => [o.exercise_id, o.video_url])
  )

  // Merge: coach override takes precedence over global URL
  const merged = exercises.map(ex => ({
    id: ex.id,
    name: ex.name,
    category: ex.category,
    equipment: ex.equipment,
    muscles: ex.muscles,
    video_url: ex.id in overrideMap ? overrideMap[ex.id] : ex.video_url,
  }))

  return Response.json(merged)
}
