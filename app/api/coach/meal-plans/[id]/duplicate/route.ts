import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // Fetch the original meal plan (must belong to this coach)
  const { data: original, error: fetchError } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', id)
    .eq('coach_id', coachId)
    .single()

  if (fetchError || !original) return Response.json({ error: 'Not found' }, { status: 404 })

  // Allow caller to override the name
  let customName: string | undefined
  try {
    const body = await req.json()
    customName = body?.name
  } catch {
    // no body — that's fine
  }

  const { id: _id, created_at: _created, updated_at: _updated, ...rest } = original
  const duplicate = {
    ...rest,
    name: customName ?? `Copy of ${original.name}`,
    coach_id: coachId,
  }

  const { data, error } = await supabase
    .from('meal_plans')
    .insert(duplicate)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
