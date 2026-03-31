import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', id)
    .eq('coach_id', coachId)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { name, goal, total_calories, content } = body

  const { data, error } = await supabase
    .from('meal_plans')
    .update({ name, goal, total_calories, content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', coachId)
    .select()
    .single()

  if (error || !data) return Response.json({ error: error?.message ?? 'Not found' }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('id', id)
    .eq('coach_id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
