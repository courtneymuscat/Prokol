import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('forms')
    .select('id, title, description, type, is_active, created_at')
    .eq('coach_id', coachId)
    .eq('is_client_copy', false)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { title, description, type } = await req.json()
  if (!title) return Response.json({ error: 'Title required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('forms')
    .insert({ coach_id: coachId, title, description: description ?? null, type: type ?? 'weekly_checkin' })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}
