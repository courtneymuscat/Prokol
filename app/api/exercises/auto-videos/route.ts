import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

// Search YouTube for the best form/tutorial video for an exercise name.
async function searchYouTube(name: string): Promise<string | null> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return null

  const query = `${name} exercise proper form tutorial`
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '1')
  url.searchParams.set('videoDuration', 'short')
  url.searchParams.set('relevanceLanguage', 'en')
  url.searchParams.set('key', key)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null

  const data = await res.json()
  const videoId = data.items?.[0]?.id?.videoId
  if (!videoId) return null

  return `https://www.youtube.com/watch?v=${videoId}`
}

// POST — search YouTube for a batch of exercises
export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  if (!process.env.YOUTUBE_API_KEY) {
    return Response.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 })
  }

  const { exercise_ids } = await req.json() as { exercise_ids: string[] }
  if (!Array.isArray(exercise_ids) || exercise_ids.length === 0) {
    return Response.json({ error: 'exercise_ids required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: exercises } = await admin
    .from('exercises')
    .select('id, name')
    .in('id', exercise_ids)

  if (!exercises?.length) return Response.json({ results: [] })

  const results: { id: string; name: string; url: string | null }[] = []
  for (const ex of exercises) {
    const url = await searchYouTube(ex.name)
    results.push({ id: ex.id, name: ex.name, url })
    await new Promise(r => setTimeout(r, 200))
  }

  return Response.json({ results })
}

// PATCH — save an approved video URL to the global exercises table
export async function PATCH(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { exercise_id, video_url } = await req.json()
  const url = video_url?.trim() || null

  // Use admin client to bypass RLS — exercises table has no UPDATE policy for user sessions
  const admin = createAdminClient()
  const { error } = await admin
    .from('exercises')
    .update({ video_url: url })
    .eq('id', exercise_id)

  if (error) {
    console.error('auto-video save error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
