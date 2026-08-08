import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const category = req.nextUrl.searchParams.get('category')
  if (!q || q.length < 2) return Response.json([])

  const supabase = await createClient()

  let query = supabase
    .from('exercises')
    .select('id, name, category, equipment, muscles, video_url, how_to')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(20)

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  const { data } = await query
  const results: Array<{ id: string; name: string; category: string; equipment: string; muscles?: string; video_url: string | null; how_to?: string | null }> = data ?? []

  if (results.length > 0) {
    const coachId = await requireCoach()
    if (coachId) {
      const ids = results.map((e) => e.id)
      const admin = createAdminClient()
      const [{ data: videoOverrides }, { data: howToOverrides }] = await Promise.all([
        admin
          .from('coach_exercise_videos')
          .select('exercise_id, video_url')
          .eq('coach_id', coachId)
          .in('exercise_id', ids),
        admin
          .from('coach_exercise_how_tos')
          .select('exercise_id, how_to')
          .eq('coach_id', coachId)
          .in('exercise_id', ids),
      ])
      if (videoOverrides?.length) {
        const map = Object.fromEntries(videoOverrides.map((o) => [o.exercise_id, o.video_url]))
        for (const ex of results) {
          if (map[ex.id] !== undefined) ex.video_url = map[ex.id]
        }
      }
      if (howToOverrides?.length) {
        const map = Object.fromEntries(howToOverrides.map((o) => [o.exercise_id, o.how_to]))
        for (const ex of results) {
          if (map[ex.id] !== undefined) ex.how_to = map[ex.id]
        }
      }
    }
  }

  return Response.json(results)
}
