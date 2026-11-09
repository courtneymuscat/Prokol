import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveClientCurrentWeek, type WeekInfo } from './weeklyPlan'

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
  // Present whenever targets_source is 'weekly_plan' — null if no visible
  // plan currently covers today (so calories/protein/carbs/fat below fell
  // back to the TDEE-saved profile fields instead), otherwise the actual
  // plan/week that produced them. Lets a caller like the coach's TDEE card
  // show which plan/week is driving the target without a second query.
  weekInfo?: WeekInfo | null
}

type KnownRel = { targets_source: string | null; targets_meal_plan_id: string | null } | null
type KnownProfile = { target_calories: number | null; target_protein: number | null; target_carbs: number | null; target_fat: number | null } | null

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
 *
 * Also switches to whichever week is current in the client's visible
 * phased "Weekly Changes" plan when targets_source is 'weekly_plan' (see
 * lib/weeklyPlan.ts) — so a client on a changing-macros protocol gets
 * their target updated automatically as weeks roll over, without the
 * coach having to manually re-apply each new week's numbers.
 *
 * `known` lets a caller that already has the coach_clients row and/or
 * profile fields in hand (e.g. the settings route just wrote
 * targets_source itself; the TDEE route already fetched the profile row
 * for its own calculator fields) skip re-querying them — purely a latency
 * optimization for a couple of hot, user-visible save paths that were
 * doing the same reads two or three times over in a single action. Omit
 * it (or pass nothing) and this behaves exactly as before, always
 * querying fresh.
 */
export async function resolveEffectiveTarget(
  admin: SupabaseClient,
  clientId: string,
  coachId: string,
  known?: { rel?: KnownRel; profile?: KnownProfile },
): Promise<EffectiveTarget> {
  const rel = known?.rel !== undefined
    ? known.rel
    : (await admin
        .from('coach_clients')
        .select('targets_source, targets_meal_plan_id')
        .eq('coach_id', coachId)
        .eq('client_id', clientId)
        .maybeSingle()).data

  if (rel?.targets_source === 'weekly_plan') {
    const weekInfo = await resolveClientCurrentWeek(admin, clientId, coachId)
    if (weekInfo && (weekInfo.calories ?? 0) > 0) {
      return {
        calories: weekInfo.calories ?? 0,
        protein: weekInfo.protein ?? 0,
        carbs: weekInfo.carbs ?? 0,
        fat: weekInfo.fat ?? 0,
        weekInfo,
      }
    }
    // No visible plan currently covers today (not started yet, finished,
    // or none marked visible) — fall through to the TDEE-saved profile
    // fields below rather than showing the client a target of zero.
  }

  if (rel?.targets_source === 'meal_plan' && rel.targets_meal_plan_id) {
    const { data: plan } = await admin
      .from('client_meal_plans')
      .select('content, total_calories')
      .eq('id', rel.targets_meal_plan_id)
      .maybeSingle()
    if (plan) {
      const summed = sumPlanMacros(plan.content)
      return summed.calories > 0
        ? summed
        : { calories: plan.total_calories ?? 0, protein: 0, carbs: 0, fat: 0 }
    }
    return { calories: 0, protein: 0, carbs: 0, fat: 0 }
  }

  const profile = known?.profile !== undefined
    ? known.profile
    : (await admin
        .from('profiles')
        .select('target_calories, target_protein, target_carbs, target_fat')
        .eq('id', clientId)
        .maybeSingle()).data
  return {
    calories: profile?.target_calories ?? 0,
    protein: profile?.target_protein ?? 0,
    carbs: profile?.target_carbs ?? 0,
    fat: profile?.target_fat ?? 0,
    ...(rel?.targets_source === 'weekly_plan' ? { weekInfo: null } : {}),
  }
}
