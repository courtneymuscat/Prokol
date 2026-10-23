// Auto-setup for signup-link clients completing onboarding: serve targets
// (via the existing macrosToServes formula, app/coach/clients/[clientId]/
// ClientServeGuide.tsx) and a matched meal plan from the coach's own
// template bank — wired into app/api/onboarding/complete/route.ts.

export function mapDietaryPreferenceToMealPlanGoal(pref: string | null | undefined): string {
  if (pref === 'vegan') return 'vegan'
  if (pref === 'vegetarian') return 'vegetarian'
  // Deliberate spelling bridge — profiles.dietary_preference uses
  // "pescetarian", meal_plans.goal uses "pescatarian" (see
  // app/coach/meal-plans/[id]/MealPlanEditor.tsx's DIET_OPTIONS).
  if (pref === 'pescetarian') return 'pescatarian'
  // none / gluten_free / dairy_free / null — no finer-grained meal-plan
  // tag exists for these yet, so they fall back to the general pool.
  return 'omnivore'
}

// Moved here from app/coach/clients/[clientId]/ClientServeGuide.tsx (which
// now imports it) so it can also run server-side for auto-setup, without
// pulling a 'use client' component into an API route.
export function macrosToServes(macros: { proteinG: number; carbG: number; fatG: number }) {
  const roundHalf = (n: number) => Math.round(n * 2) / 2
  const fruit_serves = 2
  // Reserve carb budget for fruit (2 × 20g) and veg (~150 kcal ÷ 4 kcal/g ≈ 38g carbs)
  const vegCarbG = Math.round(150 / 4)
  const remainingCarbG = Math.max(0, macros.carbG - fruit_serves * 20 - vegCarbG)
  return {
    protein_serves: roundHalf(macros.proteinG / 30),
    carb_serves: roundHalf(remainingCarbG / 20),
    fat_serves: roundHalf(macros.fatG / 10),
    fruit_serves,
    veg_unlimited: true,
  }
}

export function pickBestMealPlan<T extends { goal: string; total_calories: number }>(
  candidates: T[],
  targetCalories: number,
  dietGoal: string,
): T | null {
  // Strict diet match only — silently cross-matching a vegan client into
  // an omnivore plan is a real dietary-integrity problem, not just a
  // rough edge. No match means no auto-assignment (same as today's
  // baseline: calorie/macro targets only, no plan) rather than guessing.
  const dietMatches = candidates.filter((c) => c.goal === dietGoal)
  if (!dietMatches.length) return null
  return dietMatches.reduce((best, c) =>
    Math.abs(c.total_calories - targetCalories) < Math.abs(best.total_calories - targetCalories) ? c : best
  )
}
