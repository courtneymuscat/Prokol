import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_supplements')
    .select('*')
    .or(`coach_id.is.null,coach_id.eq.${coachId}`)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, default_dosage, benefits, brand_url, considerations } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_supplements')
    .insert({ coach_id: coachId, name: name.trim(), default_dosage, benefits, brand_url, considerations })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
