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
  const { name, goal, total_calories, content, is_generic } = body

  const { push_to_clients } = body

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) patch.name = name
  if (goal !== undefined) patch.goal = goal
  if (total_calories !== undefined) patch.total_calories = total_calories
  if (content !== undefined) patch.content = content
  if (typeof is_generic === 'boolean') patch.is_generic = is_generic

  const { data, error } = await supabase
    .from('meal_plans')
    .update(patch)
    .eq('id', id)
    .eq('coach_id', coachId)
    .select()
    .single()

  if (error || !data) return Response.json({ error: error?.message ?? 'Not found' }, { status: 400 })

  // Propagate to existing client assignments if requested
  if (push_to_clients) {
    const clientUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) clientUpdates.name = name
    if (content !== undefined) clientUpdates.content = content
    if (total_calories !== undefined) clientUpdates.total_calories = total_calories
    await supabase
      .from('client_meal_plans')
      .update(clientUpdates)
      .eq('meal_plan_id', id)
      .eq('coach_id', coachId)
  }

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
