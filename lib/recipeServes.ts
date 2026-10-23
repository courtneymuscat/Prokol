import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOrgSharedUserId } from '@/lib/org'

export type ServeInfo = {
  category: string
  protein_per_serve: number | null
  carbs_per_serve: number | null
  fat_per_serve: number | null
}

// Same org-shared resolution as /api/client/food-serves: an invited coach
// inside an org sees the org owner's cheat sheet, not an empty one of their
// own.
export async function getCoachServeMap(coachId: string): Promise<Record<string, ServeInfo>> {
  const admin = createAdminClient()
  const { userId: serveOwnerId } = await resolveOrgSharedUserId(coachId)

  const { data: tags } = await admin
    .from('coach_food_serves')
    .select('food_name, serve_category, protein_per_serve, carbs_per_serve, fat_per_serve')
    .eq('coach_id', serveOwnerId)

  const map: Record<string, ServeInfo> = {}
  for (const t of tags ?? []) {
    map[(t.food_name as string).toLowerCase()] = {
      category: t.serve_category as string,
      protein_per_serve: t.protein_per_serve ?? null,
      carbs_per_serve: t.carbs_per_serve ?? null,
      fat_per_serve: t.fat_per_serve ?? null,
    }
  }
  return map
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
