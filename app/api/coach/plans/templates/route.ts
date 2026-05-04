import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_plan_templates')
    .select('id, name, description, phases, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, phases } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_plan_templates')
    .insert({ coach_id: coachId, name: name.trim(), description: description ?? null, phases: phases ?? [] })
    .select('id, name, description, phases, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
