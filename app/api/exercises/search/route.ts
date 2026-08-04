import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const category = req.nextUrl.searchParams.get('category')
  if (!q || q.length < 2) return Response.json([])

  const supabase = await createClient()

  let query = supabase
    .from('exercises')
    .select('id, name, category, equipment, muscles, video_url')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(20)

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  const { data } = await query
  const results: Array<{ id: string; name: string; category: string; equipment: string; muscles?: string; video_url: string | null }> = data ?? []

  // Apply coach-specific video URL overrides
  if (results.length > 0) {
    const coachId = await requireCoach()
    if (coachId) {
      const ids = results.map((e) => e.id)
      const { data: overrides } = await supabase
        .from('coach_exercise_videos')
        .select('exercise_id, video_url')
        .eq('coach_id', coachId)
        .in('exercise_id', ids)
      if (overrides?.length) {
        const overrideMap = Object.fromEntries(overrides.map((o) => [o.exercise_id, o.video_url]))
        for (const ex of results) {
          if (overrideMap[ex.id] !== undefined) ex.video_url = overrideMap[ex.id]
        }
      }
    }
  }

  return Response.json(results)
}
