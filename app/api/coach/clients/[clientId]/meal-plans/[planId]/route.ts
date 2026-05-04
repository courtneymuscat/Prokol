import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type MealFood = { calories?: number; protein?: number; carbs?: number; fat?: number }
type MealSlot = { foods?: MealFood[] }

function computeMacros(content: unknown) {
  let calories = 0, protein = 0, carbs = 0, fat = 0
  for (const slot of (Array.isArray(content) ? content : []) as MealSlot[]) {
    for (const food of (Array.isArray(slot?.foods) ? slot.foods : []) as MealFood[]) {
      calories += Number(food?.calories) || 0
      protein  += Number(food?.protein)  || 0
      carbs    += Number(food?.carbs)    || 0
      fat      += Number(food?.fat)      || 0
    }
  }
  return {
    target_calories: Math.round(calories),
    target_protein:  Math.round(protein),
    target_carbs:    Math.round(carbs),
    target_fat:      Math.round(fat),
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; planId: string }> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_meal_plans')
    .select('*')
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; planId: string }> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { name, content, status, total_calories, start_date, end_date, notes, coach_notes, show_macros } = body
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updates.name = name
  if (content !== undefined) updates.content = content
  if (total_calories !== undefined) updates.total_calories = total_calories
  if (start_date !== undefined) updates.start_date = start_date
  if (end_date !== undefined) updates.end_date = end_date ?? null
  if (notes !== undefined) updates.notes = notes ?? null
  if (coach_notes !== undefined) updates.coach_notes = coach_notes ?? null
  if (show_macros !== undefined) updates.show_macros = show_macros

  // Auto-expire: if end_date is being set to a past date, force inactive
  const today = new Date().toISOString().split('T')[0]
  if (status !== undefined) {
    updates.status = status
  } else if (end_date && end_date < today) {
    updates.status = 'inactive'
  }

  let { data, error } = await supabase
    .from('client_meal_plans')
    .update(updates)
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .select()
    .single()

  // Graceful fallback: strip unknown columns if migration hasn't run yet
  if (error && (error.message?.includes('end_date') || error.message?.includes('notes') || error.message?.includes('coach_notes'))) {
    const { end_date: _ed, notes: _n, coach_notes: _cn, ...coreUpdates } = updates
    const retry = await supabase
      .from('client_meal_plans')
      .update(coreUpdates)
      .eq('id', planId)
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error || !data) return Response.json({ error: error?.message ?? 'Not found' }, { status: 400 })

  // Sync client's daily targets whenever content or calorie target changes on an active plan
  const planIsActive = (status ?? data.status) === 'active'
  if (planIsActive && (content !== undefined || total_calories !== undefined)) {
    const macros = computeMacros(data.content)
    const admin = createAdminClient()
    if (macros.target_calories > 0) {
      // Full sync from food items
      await admin.from('profiles').update(macros).eq('id', clientId)
    } else if ((data.total_calories ?? 0) > 0) {
      // No food items yet — sync calorie target only
      await admin.from('profiles').update({ target_calories: data.total_calories }).eq('id', clientId)
    }
  }

  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; planId: string }> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('client_meal_plans')
    .delete()
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
