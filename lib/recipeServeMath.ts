// Pure serve-count math, split out from lib/recipeServes.ts so it can be
// imported safely from client components (the editor recomputes this live
// as ingredients are added/removed) without also pulling in that file's
// server-only admin-client/env-secret usage into the client bundle.

export type ServeInfo = {
  category: string
  protein_per_serve: number | null
  carbs_per_serve: number | null
  fat_per_serve: number | null
}

// How many of that category's serves this ingredient's own gram-amount of
// the matching macro represents — protein serves measured in protein grams,
// carb/fruit serves in carb grams, fat serves in fat grams. Deliberately NOT
// derived from the free-text serving_desc field ("135g raw"), which isn't a
// clean number to divide by. veg/free/condiment categories have no
// meaningful per-serve count (unlimited/reference-only), so return null.
export function computeServeCount(
  ingredient: { protein: number; carbs: number; fat: number },
  serve: ServeInfo | undefined,
): number | null {
  if (!serve) return null
  switch (serve.category) {
    case 'protein':
      return serve.protein_per_serve ? ingredient.protein / serve.protein_per_serve : null
    case 'carb':
    case 'fruit':
      return serve.carbs_per_serve ? ingredient.carbs / serve.carbs_per_serve : null
    case 'fat':
      return serve.fat_per_serve ? ingredient.fat / serve.fat_per_serve : null
    default:
      return null
  }
}

export type ServeTotals = {
  protein: number | null
  carb: number | null
  fat: number | null
  fruit: number | null
}

// Recipe-level "this dish is approx. X protein serves, Y carb serves…" —
// sums each ingredient's own serve_count into its category bucket. Fruit
// stays a separate bucket from carb (matching client_serve_targets having
// distinct protein/carb/fat/fruit/veg targets, not folding fruit into carbs)
// even though both are computed from carb grams. A bucket stays null (not
// zero) if no ingredient in the recipe matched that category at all, so the
// UI can distinguish "this recipe has no fat-category ingredient" from
// "this recipe's fat ingredients come to 0 serves."
export function aggregateServeTotals(
  ingredients: Array<{ food_name: string; protein: number; carbs: number; fat: number }>,
  serveMap: Record<string, ServeInfo>,
): ServeTotals {
  const totals = { protein: 0, carb: 0, fat: 0, fruit: 0 }
  const matched: Record<keyof typeof totals, boolean> = { protein: false, carb: false, fat: false, fruit: false }

  for (const ingredient of ingredients) {
    const serve = serveMap[ingredient.food_name.toLowerCase()]
    const count = computeServeCount(ingredient, serve)
    if (count == null || !serve) continue
    const bucket = serve.category as keyof typeof totals
    if (bucket in totals) {
      totals[bucket] += count
      matched[bucket] = true
    }
  }

  return {
    protein: matched.protein ? totals.protein : null,
    carb: matched.carb ? totals.carb : null,
    fat: matched.fat ? totals.fat : null,
    fruit: matched.fruit ? totals.fruit : null,
  }
}
