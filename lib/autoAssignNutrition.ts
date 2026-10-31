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

// Per-serve calorie/macro assumptions for the Daily Serve Targets model —
// single source of truth shared between the coach-facing breakdown
// (ClientServeGuide.tsx's ServeMathBreakdown, which imports these) and
// targetMacrosToServes below, so the "how we calculated this" explainer
// and the actual conversion math can never drift apart. Each serve bundles
// a bit more than its primaryG*4-or-9 pure-macro calories — real lean
// meat/eggs carry a little fat, grains/legumes a little protein, etc. —
// which is exactly why a naive gram/serve-size division (the old
// macrosToServes below) overshoots a calorie target once this padding and
// the veg reservation are both counted; see targetMacrosToServes.
export const SERVE_BUDGET = {
  protein: { kcal: 135, primaryG: 30, primaryMacro: 'P' as const, extras: '+ ~3g fat typical in lean meat/eggs' },
  carb:    { kcal:  90, primaryG: 20, primaryMacro: 'C' as const, extras: '+ ~3g protein typical in grains/legumes (includes fruit — same 20g carb unit)' },
  fat:     { kcal:  95, primaryG: 10, primaryMacro: 'F' as const, extras: '+ small protein/carbs in nuts/seeds' },
}
export const VEG_KCAL = 150

// How many carb serves the whole-day veg reservation below is worth, in
// the same units as macrosToServes' carb_serves — a fixed amount, since
// both the reservation (150 kcal) and the serve size (20g) are constants.
// Surfaced directly in the UI (app/dashboard/MealPlanView.tsx) next to the
// daily Carbs total, so the gap between that total and the sum of what's
// shown per meal is visible at a glance instead of only inside the
// "How are these serves calculated?" explainer.
export const VEG_RESERVE_CARB_SERVES = roundHalf(Math.round(150 / 4) / 20)

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
export function macrosToServes(macros: { proteinG: number; carbG: number; fatG: number }) {
  // Reserve carb budget for veg (~150 kcal ÷ 4 kcal/g ≈ 38g carbs)
  const vegCarbG = Math.round(150 / 4)
  const remainingCarbG = Math.max(0, macros.carbG - vegCarbG)
  return {
    protein_serves: roundHalf(macros.proteinG / 30),
    carb_serves: roundHalf(remainingCarbG / 20),
    fat_serves: roundHalf(macros.fatG / 10),
    veg_unlimited: true,
  }
}

// Converts a whole-day calorie/macro TARGET into serve counts whose
// real-food kcal total (via SERVE_BUDGET + VEG_KCAL above) actually
// reproduces that target, instead of overshooting it by ~150-250kcal the
// way macrosToServes does. Protein and fat serves are still driven
// directly off their own gram targets (clinical protein-per-kg /
// fat-per-kg choices, not up for negotiation) — carbs is solved backwards
// from whatever calorie budget is left once protein, fat, and the flat
// veg reservation have taken their (padded) share, mirroring how
// calcMacros (TDEESection.tsx) already treats carbs as "whatever calories
// are left over" once protein and fat are fixed.
//
// Derivation: each serve type's padding is exactly 0.5kcal per primary
// gram (protein 15kcal padding / 30g = 0.5; carb 10/20 = 0.5; fat 5/10 =
// 0.5), so kcalEstimate = 4·primaryC + (4.5·proteinG + 9.5·fatG) +
// 0.5·primaryC + VEG_KCAL — solving that for primaryC (as carb_serves ·
// SERVE_BUDGET.carb.kcal, which already folds in its own 0.5·primaryG
// padding) gives the formula below.
export function targetMacrosToServes(macros: { proteinG: number; fatG: number; targetCals: number }) {
  const proteinServes = roundHalf(macros.proteinG / SERVE_BUDGET.protein.primaryG)
  const fatServes = roundHalf(macros.fatG / SERVE_BUDGET.fat.primaryG)
  const remainingForCarbs = macros.targetCals - proteinServes * SERVE_BUDGET.protein.kcal - fatServes * SERVE_BUDGET.fat.kcal - VEG_KCAL
  const carbServes = Math.max(0, roundHalf(remainingForCarbs / SERVE_BUDGET.carb.kcal))
  return { protein_serves: proteinServes, carb_serves: carbServes, fat_serves: fatServes, veg_unlimited: true }
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
