import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeRecipeSwapScale, scaleRecipeIngredients } from '@/lib/recipeSwap'
import type { NextRequest } from 'next/server'

interface FoodItem {
  food_id?: string
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  recipe_id?: string
  recipe_name?: string
  swapped_from?: unknown
  [key: string]: unknown
}

interface Meal {
  foods: FoodItem[]
  [key: string]: unknown
}

// PATCH /api/client/meal-plans/[planId]/swap-recipe — Mode A substitution:
// swap an entire recipe-group (every consecutive food sharing the same
// recipe_id) for a different recipe from the coach's library (incl.
// platform-wide recipes), one of the client's own "My Recipes"
// (client_recipes), or one of their Saved Meals — scaled so its total
// calories match what it's replacing. Sibling to swap/route.ts (same
// ownership-check-then-update-content pattern) — that route handles
// single-food swaps, this one handles whole-recipe swaps.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { meal_index, recipe_id, new_recipe_id, new_saved_meal_id, new_client_recipe_id } = body as {
    meal_index: number
    recipe_id: string
    new_recipe_id?: string
    new_saved_meal_id?: string
    new_client_recipe_id?: string
  }
  if (!new_recipe_id && !new_saved_meal_id && !new_client_recipe_id) {
    return Response.json({ error: 'A replacement recipe or saved meal is required' }, { status: 400 })
  }

  const { data: plan, error: fetchError } = await supabase
    .from('client_meal_plans')
    .select('*')
    .eq('id', planId)
    .eq('client_id', user.id)
    .single()
  if (fetchError || !plan) return Response.json({ error: 'Not found' }, { status: 404 })

  const content: Meal[] = Array.isArray(plan.content) ? [...plan.content] : []
  if (!content[meal_index]) return Response.json({ error: 'Invalid meal_index' }, { status: 400 })

  const meal = { ...content[meal_index], foods: [...(content[meal_index].foods ?? [])] }

  const groupIndices = meal.foods
    .map((f, i) => (f.recipe_id === recipe_id ? i : -1))
    .filter((i) => i !== -1)
  if (!groupIndices.length) return Response.json({ error: 'Recipe not found in this meal' }, { status: 400 })

  const firstIndex = groupIndices[0]
  const lastIndex = groupIndices[groupIndices.length - 1]
  // Recipe ingredients are always inserted as a contiguous block — if
  // something has reordered them since, bail rather than guess.
  if (lastIndex - firstIndex + 1 !== groupIndices.length) {
    return Response.json({ error: 'Recipe group is not contiguous' }, { status: 400 })
  }

  const originalGroup = groupIndices.map((i) => meal.foods[i])
  const originalCalories = originalGroup.reduce((sum, f) => sum + (f.calories || 0), 0)

  let newId: string
  let newName: string
  let newTotalCalories: number
  let newIngredientsRaw: { food_id?: string | null; food_name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }[]
  let recipeSource: 'library' | 'saved_meal' | 'my_recipe'

  if (new_recipe_id) {
    // Admin client — the client reading another coach-owned recipe's
    // ingredients would otherwise be blocked by recipes'/recipe_ingredients'
    // coach_id = auth.uid() RLS policies.
    const admin = createAdminClient()
    const { data: newRecipe } = await admin
      .from('recipes')
      .select('id, coach_id, name, total_calories, is_global')
      .eq('id', new_recipe_id)
      .single()
    if (!newRecipe) return Response.json({ error: 'Replacement recipe not found' }, { status: 404 })

    // Ownership check — a client can only swap in a recipe from their own
    // active coach, or one flagged is_global (the platform Meal Library).
    // Previously missing entirely: any client could swap in any coach's
    // recipe by id, global or not.
    const { data: ownRel } = await admin
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    const allowed = newRecipe.is_global || (ownRel && ownRel.coach_id === newRecipe.coach_id)
    if (!allowed) return Response.json({ error: 'Replacement recipe not found' }, { status: 404 })

    const { data: newIngredients } = await admin
      .from('recipe_ingredients')
      .select('food_id, food_name, grams, calories, protein, carbs, fat, sort_order')
      .eq('recipe_id', new_recipe_id)
      .order('sort_order', { ascending: true })
    if (!newIngredients?.length) return Response.json({ error: 'Replacement recipe has no ingredients' }, { status: 400 })

    newId = newRecipe.id
    newName = newRecipe.name
    newTotalCalories = newRecipe.total_calories
    newIngredientsRaw = newIngredients
    recipeSource = 'library'
  } else if (new_client_recipe_id) {
    // The client's own "My Recipes" (client_recipes) — RLS already scopes
    // these strictly to user_id = auth.uid(), so the regular session client
    // is enough, same as the saved-meal branch below.
    const { data: myRecipe } = await supabase
      .from('client_recipes')
      .select('id, name, total_calories')
      .eq('id', new_client_recipe_id)
      .eq('user_id', user.id)
      .single()
    if (!myRecipe) return Response.json({ error: 'Replacement recipe not found' }, { status: 404 })

    const { data: myIngredients } = await supabase
      .from('client_recipe_ingredients')
      .select('food_id, food_name, grams, calories, protein, carbs, fat, sort_order')
      .eq('recipe_id', new_client_recipe_id)
      .order('sort_order', { ascending: true })
    if (!myIngredients?.length) return Response.json({ error: 'Replacement recipe has no ingredients' }, { status: 400 })

    newId = myRecipe.id
    newName = myRecipe.name
    newTotalCalories = myRecipe.total_calories
    newIngredientsRaw = myIngredients
    recipeSource = 'my_recipe'
  } else {
    // Saved meal — the client's own, so the regular (RLS-scoped) client is
    // enough; no need to reach for the admin client here.
    const { data: savedMeal } = await supabase
      .from('meals')
      .select('id, name')
      .eq('id', new_saved_meal_id)
      .eq('user_id', user.id)
      .single()
    if (!savedMeal) return Response.json({ error: 'Saved meal not found' }, { status: 404 })

    const { data: items } = await supabase
      .from('meal_items')
      .select('food_id, food_name, grams, calories, protein, carbs, fat')
      .eq('meal_id', new_saved_meal_id)
    if (!items?.length) return Response.json({ error: 'That saved meal has no food items' }, { status: 400 })

    newId = savedMeal.id
    newName = savedMeal.name
    newTotalCalories = items.reduce((sum, i) => sum + (i.calories || 0), 0)
    newIngredientsRaw = items
    recipeSource = 'saved_meal'
  }

  const scale = computeRecipeSwapScale(originalCalories, newTotalCalories)
  const scaled = scaleRecipeIngredients(newIngredientsRaw, scale)

  const newFoods: FoodItem[] = scaled.map((i, idx) => ({
    food_id: i.food_id ?? undefined,
    food_name: i.food_name,
    grams: i.grams,
    calories: i.calories,
    protein: i.protein,
    carbs: i.carbs,
    fat: i.fat,
    recipe_id: newId,
    recipe_name: newName,
    recipe_source: recipeSource,
    ...(idx === 0 ? { swapped_from: originalGroup } : {}),
  }))

  meal.foods.splice(firstIndex, groupIndices.length, ...newFoods)
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
