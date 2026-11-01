import type { SupabaseClient } from '@supabase/supabase-js'
import { targetMacrosToServes, macrosToServes } from './autoAssignNutrition'

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
function sumPlanMacros(content: unknown): { calories: number; protein: number; carbs: number; fat: number } {
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

/**
 * Recomputes and upserts a client's Food Cheat Sheet serve targets from
 * whatever their daily target ACTUALLY currently resolves to — the same
 * way the client's own dashboard resolves it (app/dashboard/page.tsx):
 * TDEE-saved profile fields by default, or an active meal plan's summed
 * content when coach_clients.targets_source is 'meal_plan'. Re-resolved
 * fresh from the DB every call rather than trusting whichever route
 * triggered the sync, so it stays correct no matter which of the several
 * places a client's effective target can change (saving TDEE targets,
 * switching targets_source, assigning or editing a meal plan) was the one
 * that actually fired.
 *
 * The two sources use different serve math on purpose: a meal plan has
 * real food with real gram totals, so its serves come from macrosToServes
 * — the exact same real-grams-÷-serve-size formula (incl. the veg carb
 * reservation) the meal plan's own "Total serves" display already uses —
 * so the two numbers always agree. TDEE-only targets have no real food to
 * measure, just an abstract calorie/macro figure, so those use
 * targetMacrosToServes instead, which solves carbs backwards from the
 * calorie budget so the real-food serve estimate still lands on the
 * stated target (see that function's own comment for why).
 *
 * Preserves any notes the coach already wrote on client_serve_targets;
 * always overwrites the serve counts themselves. No-ops when there isn't
 * a full calorie + protein/fat breakdown to work from (e.g. a meal plan
 * with only a calorie target and no food items or per-slot macros yet) —
 * same "don't guess" precedent as the pre-existing profile-macro sync in
 * the meal-plan routes.
 */
export async function syncServeTargetsForClient(
  admin: SupabaseClient,
  clientId: string,
  coachId: string,
): Promise<void> {
  const { data: rel } = await admin
    .from('coach_clients')
    .select('targets_source, targets_meal_plan_id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .maybeSingle()

  let calories = 0
  let protein = 0
  let carbs = 0
  let fat = 0
  let fromRealFood = false

  if (rel?.targets_source === 'meal_plan' && rel.targets_meal_plan_id) {
    const { data: plan } = await admin
      .from('client_meal_plans')
      .select('content, total_calories')
      .eq('id', rel.targets_meal_plan_id)
      .maybeSingle()
    if (plan) {
      const summed = sumPlanMacros(plan.content)
      calories = summed.calories > 0 ? summed.calories : (plan.total_calories ?? 0)
      protein = summed.protein
      carbs = summed.carbs
      fat = summed.fat
      fromRealFood = summed.calories > 0
    }
  } else {
    const { data: profile } = await admin
      .from('profiles')
      .select('target_calories, target_protein, target_fat')
      .eq('id', clientId)
      .maybeSingle()
    calories = profile?.target_calories ?? 0
    protein = profile?.target_protein ?? 0
    fat = profile?.target_fat ?? 0
  }

  if (!(calories > 0 && (protein > 0 || fat > 0))) return

  const serves = fromRealFood
    ? macrosToServes({ proteinG: protein, carbG: carbs, fatG: fat })
    : targetMacrosToServes({ proteinG: protein, fatG: fat, targetCals: calories })

  const { data: existing } = await admin
    .from('client_serve_targets')
    .select('notes')
    .eq('client_id', clientId)
    .maybeSingle()

  await admin.from('client_serve_targets').upsert({
    client_id: clientId,
    coach_id: coachId,
    protein_serves: serves.protein_serves,
    carb_serves: serves.carb_serves,
    fat_serves: serves.fat_serves,
    fruit_serves: 0,
    veg_unlimited: serves.veg_unlimited,
    notes: existing?.notes ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })
}
