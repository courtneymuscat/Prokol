// Pure math for recipe-to-recipe swapping inside a meal plan: scale the
// entire replacement recipe uniformly so its total calories match what it's
// replacing (protein/carbs/fat follow proportionally), rather than
// recomputing each ingredient's grams independently — recipe_ingredients
// rows don't carry a per-100g basis the way a single searched food does, so
// a single whole-recipe scale factor is both the simplest and the most
// faithful way to preserve the dish's own internal macro ratios.

export function computeRecipeSwapScale(originalCalories: number, newRecipeCalories: number): number {
  if (!newRecipeCalories || newRecipeCalories <= 0) return 1
  if (!originalCalories || originalCalories <= 0) return 1
  return originalCalories / newRecipeCalories
}

export function scaleRecipeIngredients<
  T extends { grams: number; calories: number; protein: number; carbs: number; fat: number },
>(ingredients: T[], scale: number): T[] {
  return ingredients.map((i) => ({
    ...i,
    grams: Math.max(1, Math.round(i.grams * scale)),
    calories: Math.round(i.calories * scale),
    protein: Math.round(i.protein * scale * 10) / 10,
    carbs: Math.round(i.carbs * scale * 10) / 10,
    fat: Math.round(i.fat * scale * 10) / 10,
  }))
}
