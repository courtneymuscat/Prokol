import type { SupabaseClient } from '@supabase/supabase-js'

// Mirrors a client's own recipe into a personal entry in `foods` so it
// becomes searchable/addable (by weight, with a one-tap quick-serving
// pill) in any other meal through the existing FoodSearch/MealFoodRow UI
// — no changes needed there. Used by app/api/client/my-recipes/route.ts
// (create) and [recipeId]/route.ts (edit) after every totals recompute.
//
// `source_client_recipe_id` marks the row as recipe-derived; callers of
// /api/foods/search filter on it so a recipe only ever surfaces in its
// owner's own search, unlike plain custom foods (which — pre-existing,
// unrelated to this feature — are visible to every user today).
export async function syncRecipeFood(
  supabase: SupabaseClient,
  opts: {
    recipeId: string
    userId: string
    name: string
    servings: number | null
    totalGrams: number
    totalCalories: number
    totalProtein: number
    totalCarbs: number
    totalFat: number
  },
): Promise<void> {
  const { recipeId, userId, name, servings, totalGrams, totalCalories, totalProtein, totalCarbs, totalFat } = opts
  const factor = totalGrams > 0 ? 100 / totalGrams : 0

  const foodRow = {
    user_id: userId,
    name,
    calories_per_100g: Math.round(totalCalories * factor),
    protein_per_100g: Math.round(totalProtein * factor * 10) / 10,
    carbs_per_100g: Math.round(totalCarbs * factor * 10) / 10,
    fat_per_100g: Math.round(totalFat * factor * 10) / 10,
    serving_quantity: servings ? Math.round((totalGrams / servings) * 10) / 10 : null,
    serving_size: servings ? '1 serving' : null,
    source_client_recipe_id: recipeId,
  }

  const { data: existing } = await supabase
    .from('foods')
    .select('id')
    .eq('source_client_recipe_id', recipeId)
    .maybeSingle()

  if (existing) {
    await supabase.from('foods').update(foodRow).eq('id', existing.id)
  } else {
    await supabase.from('foods').insert(foodRow)
  }
}
