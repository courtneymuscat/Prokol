import { createClient } from '@/lib/supabase/server'
import { syncRecipeFood } from '@/lib/clientRecipeFoodSync'
import type { NextRequest } from 'next/server'

// Named my-recipes, not recipes — /api/client/recipes already exists and
// means something different: the *coach's* recipe library as seen by the
// client (used by the meal-plan recipe-swap picker). This is the client's
// own recipes, kept separate from Saved Meals (meals/meal_items, a flat
// whole-meal log) per their own explicit choice to keep the two concepts
// apart rather than merge them.

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

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('client_recipes')
    .select('id, name, category, servings, total_grams, total_calories, total_protein, total_carbs, total_fat, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

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

  const { data: recipe, error: recipeError } = await supabase
    .from('client_recipes')
    .insert({
      user_id: user.id,
      name: name.trim(),
      category: category || null,
      instructions: instructions || null,
      servings: servingsClean,
      ...totals,
    })
    .select('id')
    .single()

  if (recipeError || !recipe) return Response.json({ error: recipeError?.message ?? 'Failed to create recipe' }, { status: 500 })

  const { error: ingredientsError } = await supabase.from('client_recipe_ingredients').insert(
    ingredients.map((i, idx) => ({
      recipe_id: recipe.id,
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

  if (ingredientsError) {
    // Roll back the orphaned recipe row rather than leaving an empty shell.
    await supabase.from('client_recipes').delete().eq('id', recipe.id)
    return Response.json({ error: ingredientsError.message }, { status: 500 })
  }

  await syncRecipeFood(supabase, {
    recipeId: recipe.id,
    userId: user.id,
    name: name.trim(),
    servings: servingsClean,
    totalGrams: totals.total_grams,
    totalCalories: totals.total_calories,
    totalProtein: totals.total_protein,
    totalCarbs: totals.total_carbs,
    totalFat: totals.total_fat,
  })

  return Response.json({ id: recipe.id })
}
