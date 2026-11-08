// Shared TDEE/macro calculation — the same Mifflin-St Jeor + activity +
// goal-adjustment formula as app/coach/clients/[clientId]/TDEESection.tsx
// (coach-facing) and app/onboarding/page.tsx (client onboarding), copied
// verbatim rather than refactored into those two call sites — this is a
// fresh, independent copy for the autoflow step calculator
// (app/api/client/autoflows/[flowId]/[step]/calculate-targets/route.ts) so
// touching it can't regress either existing usage.

export type TDEESex = 'male' | 'female'
export type TDEEGoal = 'fat_loss' | 'muscle_gain' | 'performance' | 'general_health'
export type TDEEActivityType = 'running' | 'cycling' | 'strength' | 'hiit' | 'swimming' | 'walking' | 'rowing' | 'yoga'
export type TDEEActivity = { type: TDEEActivityType; duration_minutes: string; sessions_per_week: string }

export const TDEE_GOALS: { value: TDEEGoal; label: string }[] = [
  { value: 'fat_loss',       label: 'Fat Loss' },
  { value: 'muscle_gain',    label: 'Muscle Gain' },
  { value: 'performance',    label: 'Performance' },
  { value: 'general_health', label: 'General Health' },
]

export const TDEE_ACTIVITY_OPTIONS: { value: TDEEActivityType; label: string; met: number; hint: string }[] = [
  { value: 'running',  label: 'Running',          met: 9.0, hint: 'Jogging or running' },
  { value: 'cycling',  label: 'Cycling',           met: 7.5, hint: 'Road, trail or stationary bike' },
  { value: 'strength', label: 'Strength Training', met: 5.0, hint: 'Weights, resistance, machines' },
  { value: 'hiit',     label: 'HIIT / Circuits',   met: 9.0, hint: 'High-intensity interval training' },
  { value: 'swimming', label: 'Swimming',           met: 6.0, hint: 'Laps, general' },
  { value: 'walking',  label: 'Brisk Walking',      met: 3.8, hint: 'Purposeful, faster than strolling' },
  { value: 'rowing',   label: 'Rowing',             met: 7.0, hint: 'Rowing machine or on water' },
  { value: 'yoga',     label: 'Yoga / Pilates',     met: 2.5, hint: 'Yoga, pilates, stretching' },
]

export function calcTDEE(age: number, sex: TDEESex, height_cm: number, weight_kg: number, activities: TDEEActivity[], steps_per_day: number) {
  const bmr = sex === 'male'
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
  const baseDailyNEAT = bmr * 0.15
  const stepCalsPerDay = 2.5 * weight_kg * steps_per_day / 6000
  const weeklyExerciseCals = activities.reduce((sum, act) => {
    const opt = TDEE_ACTIVITY_OPTIONS.find(o => o.value === act.type)
    const netMet = Math.max((opt?.met ?? 5) - 1, 0)
    const hours = (parseFloat(act.duration_minutes) || 0) / 60
    const sessions = parseFloat(act.sessions_per_week) || 0
    return sum + netMet * weight_kg * hours * sessions
  }, 0)
  const dailyExerciseCals = weeklyExerciseCals / 7
  const tdee = Math.round((bmr + baseDailyNEAT + stepCalsPerDay + dailyExerciseCals) * 1.10)
  return { bmr: Math.round(bmr), tdee }
}

export function calcMacros(tdee: number, weight_kg: number, goal: TDEEGoal, adjustmentPct: number) {
  let targetCals: number
  let proteinG: number
  let fatG: number
  if (goal === 'fat_loss') {
    targetCals = Math.round(tdee * (1 - adjustmentPct / 100))
    proteinG = Math.round(weight_kg * 2.2)
    fatG = Math.round(weight_kg * 0.8)
  } else if (goal === 'muscle_gain') {
    targetCals = Math.round(tdee * (1 + adjustmentPct / 100))
    proteinG = Math.round(weight_kg * 2.2)
    fatG = Math.round(weight_kg * 1.0)
  } else if (goal === 'performance') {
    targetCals = tdee
    proteinG = Math.round(weight_kg * 1.8)
    fatG = Math.round(weight_kg * 0.9)
  } else {
    targetCals = tdee
    proteinG = Math.round(weight_kg * 1.6)
    fatG = Math.round(weight_kg * 0.8)
  }
  const carbCals = Math.max(targetCals - proteinG * 4 - fatG * 9, 0)
  return { targetCals, proteinG, carbG: Math.round(carbCals / 4), fatG }
}

export function defaultAdjPct(goal: TDEEGoal | null) {
  if (goal === 'fat_loss') return 20
  if (goal === 'muscle_gain') return 10
  return 0
}
