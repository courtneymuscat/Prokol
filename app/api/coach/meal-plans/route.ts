import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('meal_plans')
    .insert({ ...body, coach_id: coachId })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
