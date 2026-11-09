// Auto-setup for signup-link clients completing onboarding: serve targets
// (via the existing macrosToServes formula, app/coach/clients/[clientId]/
// ClientServeGuide.tsx) and a matched meal plan from the coach's own
// template bank — wired into app/api/onboarding/complete/route.ts.

export function mapDietaryPreferenceToMealPlanGoal(pref: string | null | undefined): string {
  if (pref === 'vegan') return 'vegan'
  if (pref === 'dairy_free') return 'dairy_free'
  // "vegetarian"/"pescetarian" are no longer offered in onboarding's
  // dietary-preference picker (trimmed to omnivore/vegan/dairy_free per
  // Court's call), but kept here as a defensive bridge in case an older
  // profile still has one of these values stored.
  if (pref === 'vegetarian') return 'vegetarian'
  if (pref === 'pescetarian') return 'pescatarian'
  // none / null — the general pool.
  return 'omnivore'
}

const roundHalf = (n: number) => Math.round(n * 2) / 2

// Flat whole-day veg allowance held back from the Carbs total before
// converting the rest to carb serves — single source of truth shared by
// macrosToServes below, the Serve Guide (ClientServeGuide.tsx) and the
// meal-plan explainer (ServeCalcNote.tsx), so all three can never quote a
// different veg reservation.
export const VEG_KCAL = 150
export const VEG_RESERVE_CARB_G = Math.round(VEG_KCAL / 4)

// How many carb serves the whole-day veg reservation above is worth, in
// the same units as macrosToServes' carb_serves — a fixed amount, since
// both the reservation (150 kcal) and the serve size (20g) are constants.
// Surfaced directly in the UI (app/dashboard/MealPlanView.tsx) next to the
// daily Carbs total, so the gap between that total and the sum of what's
// shown per meal is visible at a glance instead of only inside the
// "How are these serves calculated?" explainer.
export const VEG_RESERVE_CARB_SERVES = roundHalf(VEG_RESERVE_CARB_G / 20)

// Moved here from app/coach/clients/[clientId]/ClientServeGuide.tsx (which
// now imports it) so it can also run server-side for auto-setup, without
// pulling a 'use client' component into an API route.
//
// This is a WHOLE-DAY formula specifically — it reserves carb budget for
// ~veg before converting whatever's left into carb serves. That
// reservation only makes sense once, against a full day's target. Do not
// reuse this for a single meal/recipe — see mealMacrosToServes below for
// that case; applying the daily reservation per-meal was a real bug
// (every meal under ~38g carbs showed 0 carb serves).
//
// Fruit used to be reserved out as its own fixed 2-serve allowance before
// this — removed since fruit is just carbs (20g = 1 serve, same as any
// other carb source) and tracking it separately never changed the
// macros, just added a number. Carb serves now include fruit-derived
// carbs directly.
//
// This is now the ONE formula used for every whole-day serve target,
// whether the macros behind it are a meal plan's real summed food totals
// or an abstract TDEE/profile figure (see lib/serveTargetsSync.ts) — a
// separate "backward-solve from calories" formula (targetMacrosToServes)
// used to run for the TDEE case, padding each serve with an assumed extra
// ~0.5kcal/primary-gram of "typical real food" macro crossover on top of
// the veg reservation. That padding meant a client told to hit, say, "4.5
// carb serves" against a 165g carb target was actually being pointed at
// only ~90g of real carbs (4.5 × 20g) — a ~75g/300kcal gap with nothing
// surfacing it, since the same "4.5C" label on a meal-plan-derived target
// means a literal ~90g + the 38g veg reserve ≈ 128g. Using this one
// formula everywhere means "X carb serves" always means the same real
// grams (± the veg reserve) no matter which target source produced it.
export function macrosToServes(macros: { proteinG: number; carbG: number; fatG: number }) {
  const remainingCarbG = Math.max(0, macros.carbG - VEG_RESERVE_CARB_G)
  return {
    protein_serves: roundHalf(macros.proteinG / 30),
    carb_serves: roundHalf(remainingCarbG / 20),
    fat_serves: roundHalf(macros.fatG / 10),
    veg_unlimited: true,
  }
}

// Same per-serve standard as macrosToServes (30g protein / 20g carbs /
// 10g fat = 1 serve) but WITHOUT the whole-day fruit/veg carb
// reservation — for a single meal or recipe, not a full day's target.
export function mealMacrosToServes(macros: { proteinG: number; carbG: number; fatG: number }) {
  return {
    protein_serves: roundHalf(macros.proteinG / 30),
    carb_serves: roundHalf(macros.carbG / 20),
    fat_serves: roundHalf(macros.fatG / 10),
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
