import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

interface FoodItem {
  food_id?: string
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  swapped_from?: FoodItem
  [key: string]: unknown
}

interface Meal {
  foods: FoodItem[]
  [key: string]: unknown
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { meal_index, food_index, new_food } = body as {
    meal_index: number
    food_index: number
    new_food: FoodItem
  }

  // Fetch the plan and verify ownership
  const { data: plan, error: fetchError } = await supabase
    .from('client_meal_plans')
    .select('*')
    .eq('id', planId)
    .eq('client_id', user.id)
    .single()

  if (fetchError || !plan) return Response.json({ error: 'Not found' }, { status: 404 })

  const content: Meal[] = Array.isArray(plan.content) ? [...plan.content] : []

  if (!content[meal_index]) {
    return Response.json({ error: 'Invalid meal_index' }, { status: 400 })
  }

  const meal = { ...content[meal_index], foods: [...(content[meal_index].foods ?? [])] }

  if (!meal.foods[food_index]) {
    return Response.json({ error: 'Invalid food_index' }, { status: 400 })
  }

  const original = meal.foods[food_index]
  meal.foods[food_index] = { ...new_food, swapped_from: original }
  content[meal_index] = meal

  const { data, error } = await supabase
    .from('client_meal_plans')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('client_id', user.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
