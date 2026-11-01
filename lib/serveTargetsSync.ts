import type { SupabaseClient } from '@supabase/supabase-js'
import { targetMacrosToServes, macrosToServes } from './autoAssignNutrition'
import { resolveEffectiveTarget } from './effectiveTarget'

/**
 * Recomputes and upserts a client's Food Cheat Sheet serve targets from
 * whatever their daily target ACTUALLY currently resolves to (see
 * resolveEffectiveTarget) — TDEE-saved profile fields by default, or an
 * active meal plan's real summed food totals when
 * coach_clients.targets_source is 'meal_plan'. Re-resolved fresh from the
 * DB every call rather than trusting whichever route triggered the sync,
 * so it stays correct no matter which of the several places a client's
 * effective target can change (saving TDEE targets, switching
 * targets_source, assigning or editing a meal plan) was the one that
 * actually fired.
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
  const { calories, protein, carbs, fat, fromRealFood } = await resolveEffectiveTarget(admin, clientId, coachId)

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
