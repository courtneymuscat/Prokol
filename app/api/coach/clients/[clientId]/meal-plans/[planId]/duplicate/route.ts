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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; planId: string }> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: original, error: fetchError } = await supabase
    .from('client_meal_plans')
    .select('*')
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .single()

  if (fetchError || !original) return Response.json({ error: 'Not found' }, { status: 404 })

  let body: { name?: string; start_date?: string; end_date?: string } = {}
  try { body = await req.json() } catch { /* no body */ }

  const { id: _id, created_at: _c, updated_at: _u, ...rest } = original
  const duplicate = {
    ...rest,
    name: body.name ?? `Copy of ${original.name}`,
    start_date: body.start_date ?? original.start_date,
    end_date: body.end_date ?? null,
    status: 'active',
  }

  let { data, error } = await supabase
    .from('client_meal_plans')
    .insert(duplicate)
    .select()
    .single()

  // Fallback: if end_date column doesn't exist yet, retry without it
  if (error && error.message?.includes('end_date')) {
    const { end_date: _removed, ...duplicateWithoutEndDate } = duplicate
    const retry = await supabase
      .from('client_meal_plans')
      .insert(duplicateWithoutEndDate)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Sync client's daily targets to match the duplicated plan
  const macros = computeMacros(data.content)
  const admin = createAdminClient()
  if (macros.target_calories > 0) {
    await admin.from('profiles').update(macros).eq('id', clientId)
  } else if ((data.total_calories ?? 0) > 0) {
    await admin.from('profiles').update({ target_calories: data.total_calories }).eq('id', clientId)
  }

  return Response.json(data)
}
