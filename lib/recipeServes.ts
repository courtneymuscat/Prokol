import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOrgSharedUserId } from '@/lib/org'

export type { ServeInfo, ServeTotals } from '@/lib/recipeServeMath'
export { computeServeCount, aggregateServeTotals } from '@/lib/recipeServeMath'

import type { ServeInfo } from '@/lib/recipeServeMath'

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
