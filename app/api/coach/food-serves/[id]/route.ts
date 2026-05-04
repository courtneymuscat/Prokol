import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { NextResponse } from 'next/server'

// PATCH /api/coach/food-serves/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const supabase = await createClient()

  const allowed = ['serve_category', 'subcategory', 'secondary_categories', 'serving_desc', 'household_measure', 'calories_per_serve', 'protein_per_serve', 'carbs_per_serve', 'fat_per_serve']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabase
    .from('coach_food_serves')
    .update(update)
    .eq('id', id)
    .eq('coach_id', coachId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ food: data })
}

// DELETE /api/coach/food-serves/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('coach_food_serves')
    .delete()
    .eq('id', id)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
