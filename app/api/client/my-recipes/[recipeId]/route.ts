import { createClient } from '@/lib/supabase/server'
import { syncRecipeFood } from '@/lib/clientRecipeFoodSync'
import type { NextRequest } from 'next/server'

type IngredientInput = {
  food_id?: string | null
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

function sumTotals(ingredients: IngredientInput[]) {
  return ingredients.reduce(
    (acc, i) => ({
      total_grams: acc.total_grams + (i.grams || 0),
      total_calories: acc.total_calories + (i.calories || 0),
      total_protein: acc.total_protein + (i.protein || 0),
      total_carbs: acc.total_carbs + (i.carbs || 0),
      total_fat: acc.total_fat + (i.fat || 0),
    }),
    { total_grams: 0, total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 },
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: recipe, error } = await supabase
    .from('client_recipes')
    .select('id, name, category, instructions, servings, total_grams, total_calories, total_protein, total_carbs, total_fat')
    .eq('id', recipeId)
    .eq('user_id', user.id)
    .single()

  if (error || !recipe) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: ingredients } = await supabase
    .from('client_recipe_ingredients')
    .select('id, food_id, food_name, grams, calories, protein, carbs, fat, sort_order')
    .eq('recipe_id', recipeId)
    .order('sort_order', { ascending: true })

  return Response.json({ ...recipe, ingredients: ingredients ?? [] })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: existing } = await supabase
    .from('client_recipes')
    .select('id')
    .eq('id', recipeId)
    .eq('user_id', user.id)
    .single()
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, category, instructions, servings } = body as {
    name?: string
    category?: string | null
    instructions?: string | null
    servings?: number | null
  }
  const ingredients = (body.ingredients ?? []) as IngredientInput[]

  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
  if (!ingredients.length) return Response.json({ error: 'At least one ingredient required' }, { status: 400 })

  const totals = sumTotals(ingredients)
  const servingsClean = typeof servings === 'number' && servings > 0 ? Math.round(servings) : null

  const { error: updateError } = await supabase
    .from('client_recipes')
    .update({
      name: name.trim(),
      category: category || null,
      instructions: instructions || null,
      servings: servingsClean,
      ...totals,
    })
    .eq('id', recipeId)
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  // Full replace, matching the coach recipe editor's existing
  // content-replacement convention rather than diffing individual rows.
  await supabase.from('client_recipe_ingredients').delete().eq('recipe_id', recipeId)
  const { error: ingredientsError } = await supabase.from('client_recipe_ingredients').insert(
    ingredients.map((i, idx) => ({
      recipe_id: recipeId,
      food_id: i.food_id || null,
      food_name: i.food_name,
      grams: i.grams,
      calories: i.calories,
      protein: i.protein,
      carbs: i.carbs,
      fat: i.fat,
      sort_order: idx,
    })),
  )
  if (ingredientsError) return Response.json({ error: ingredientsError.message }, { status: 500 })

  await syncRecipeFood(supabase, {
    recipeId,
    userId: user.id,
    name: name.trim(),
    servings: servingsClean,
    totalGrams: totals.total_grams,
    totalCalories: totals.total_calories,
    totalProtein: totals.total_protein,
    totalCarbs: totals.total_carbs,
    totalFat: totals.total_fat,
  })

  return Response.json({ ok: true })
}

// Hard delete — unlike coach recipes (archived to keep history intact for
// meal plans that may reference them), a client's own recipe has nothing
// else referencing it, so this matches the SavedMeals delete precedent.
// The linked `foods` row and ingredient rows cascade via FK.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('client_recipes')
    .delete()
    .eq('id', recipeId)
    .eq('user_id', user.id)
    .select('id')
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
