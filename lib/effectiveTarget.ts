import type { SupabaseClient } from '@supabase/supabase-js'

type MealFood = { calories?: number; protein?: number; carbs?: number; fat?: number }
type MealSlot = {
  foods?: MealFood[]
  target_calories?: number | null
  target_protein?: number | null
  target_carbs?: number | null
  target_fat?: number | null
}

// Same per-slot summing shape as the (independently duplicated) computeMacros
// in meal-plans/route.ts, [planId]/route.ts, and app/dashboard/page.tsx.
export function sumPlanMacros(content: unknown): { calories: number; protein: number; carbs: number; fat: number } {
  let calories = 0, protein = 0, carbs = 0, fat = 0
  for (const slot of (Array.isArray(content) ? content : []) as MealSlot[]) {
    const foods = (Array.isArray(slot?.foods) ? slot.foods : []) as MealFood[]
    if (foods.length > 0) {
      for (const food of foods) {
        calories += Number(food?.calories) || 0
        protein  += Number(food?.protein)  || 0
        carbs    += Number(food?.carbs)    || 0
        fat      += Number(food?.fat)      || 0
      }
    } else {
      calories += Number(slot?.target_calories) || 0
      protein  += Number(slot?.target_protein)  || 0
      carbs    += Number(slot?.target_carbs)    || 0
      fat      += Number(slot?.target_fat)      || 0
    }
  }
  return { calories, protein, carbs, fat }
}

export type EffectiveTarget = {
  calories: number
  protein: number
  carbs: number
  fat: number
  // true when these numbers come from a real meal plan's actual food
  // totals (so macrosToServes — real grams ÷ serve size — is the right
  // conversion); false when they're an abstract TDEE/profile figure with
  // no real food behind it (so targetMacrosToServes' backward-solved
  // estimate is the right one instead). See lib/autoAssignNutrition.ts.
  fromRealFood: boolean
}

/**
 * Resolves what a client's daily calorie/macro target ACTUALLY currently
 * is — the single source of truth used by the client's own dashboard
 * (app/dashboard/page.tsx), the coach-facing TDEE & Targets card
 * (app/api/coach/clients/[clientId]/tdee/route.ts), and the Serve Guide
 * sync (lib/serveTargetsSync.ts), so all three can never show different
 * numbers for the same client again.
 *
 * Defaults to the TDEE-saved profile fields; switches to an active meal
 * plan's real summed food totals when coach_clients.targets_source is
 * 'meal_plan' — mirroring exactly how the client's dashboard already
 * overrides profile.target_calories in memory. Previously this override
 * only existed in that one file, so anywhere else that read
 * profiles.target_calories directly (the coach's own TDEE card included)
 * could show stale numbers left over from before a coach switched a
 * client onto meal-plan-driven targets.
 */
export async function resolveEffectiveTarget(
  admin: SupabaseClient,
  clientId: string,
  coachId: string,
): Promise<EffectiveTarget> {
  const { data: rel } = await admin
    .from('coach_clients')
    .select('targets_source, targets_meal_plan_id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (rel?.targets_source === 'meal_plan' && rel.targets_meal_plan_id) {
    const { data: plan } = await admin
      .from('client_meal_plans')
      .select('content, total_calories')
      .eq('id', rel.targets_meal_plan_id)
      .maybeSingle()
    if (plan) {
      const summed = sumPlanMacros(plan.content)
      return summed.calories > 0
        ? { ...summed, fromRealFood: true }
        : { calories: plan.total_calories ?? 0, protein: 0, carbs: 0, fat: 0, fromRealFood: false }
    }
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fromRealFood: false }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('target_calories, target_protein, target_carbs, target_fat')
    .eq('id', clientId)
    .maybeSingle()
  return {
    calories: profile?.target_calories ?? 0,
    protein: profile?.target_protein ?? 0,
    carbs: profile?.target_carbs ?? 0,
    fat: profile?.target_fat ?? 0,
    fromRealFood: false,
  }
}
