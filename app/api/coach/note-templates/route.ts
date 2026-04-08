import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('note_templates')
    .select('id, name, body, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: true })

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, body } = await req.json()
  if (!name?.trim() || !body?.trim()) {
    return Response.json({ error: 'Name and body are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('note_templates')
    .insert({ coach_id: coachId, name: name.trim(), body: body.trim() })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
