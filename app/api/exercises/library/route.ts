import { createClient } from '@/lib/supabase/server'
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

  let query = supabase
    .from('exercises')
    .select('id, name, category, equipment, muscles, video_url')
    .order('name')
    .range(offset, offset + limit - 1)

  if (q && q.length >= 2) query = query.ilike('name', `%${q}%`)
  if (category && category !== 'all') query = query.eq('category', category)
  if (hasVideo === 'true') query = query.not('video_url', 'is', null)
  if (hasVideo === 'false') query = query.is('video_url', null)

  const { data } = await query
  return Response.json(data ?? [])
}
