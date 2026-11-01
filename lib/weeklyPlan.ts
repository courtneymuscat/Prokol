import type { SupabaseClient } from '@supabase/supabase-js'

// ── Shared types ────────────────────────────────────────────────────────────
// Same phase/week-data shape independently duplicated in CoachWeeklyPlanCard,
// app/dashboard/WeeklyPlanCard, and AppPreviewTab's home-screen preview.

export type WeekData = {
  calorie_target: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fibre_g: number | null
}

export type WeekPhase = {
  id: string
  name: string
  type: string
  duration_weeks: number
  calorie_target: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  week_data?: WeekData[]
  week_notes?: string[]
  coach_week_notes?: string[]
}

export type WeekPlan = {
  id: string
  name: string
  start_date: string | null
  phases: WeekPhase[]
}

export type WeekInfo = {
  planId: string
  planName: string
  weekNumber: number
  totalWeeks: number
  phaseName: string
  phaseType: string
  note: string         // client-visible week note
  coachNote: string     // coach-internal week note
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fibre: number | null
}

/**
 * Resolves which week of a phased plan is current, from its start_date and
 * how many days have elapsed since — the single implementation shared by
 * the coach's "This week" card, the client dashboard's own "This week"
 * card, the App Preview's Home screen, and (via resolveEffectiveTarget)
 * the Daily Target itself when a client's targets_source is 'weekly_plan'.
 * Each of those previously carried its own copy of this exact math.
 */
export function computeWeekInfo(plan: WeekPlan): WeekInfo | null {
  if (!plan.start_date || !plan.phases?.length) return null

  const start = new Date(plan.start_date)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysDiff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(daysDiff / 7) + 1
  if (weekNumber < 1) return null // plan hasn't started yet

  const totalWeeks = plan.phases.reduce((sum, p) => sum + (p.duration_weeks || 0), 0)
  if (weekNumber > totalWeeks) return null // plan is complete

  let cumWeeks = 0
  for (const phase of plan.phases) {
    cumWeeks += phase.duration_weeks
    if (weekNumber <= cumWeeks) {
      const weekInPhase = weekNumber - (cumWeeks - phase.duration_weeks) - 1
      const wd = (phase.week_data ?? [])[weekInPhase]
      return {
        planId: plan.id,
        planName: plan.name,
        weekNumber,
        totalWeeks,
        phaseName: phase.name,
        phaseType: phase.type,
        note: (phase.week_notes ?? [])[weekInPhase] ?? '',
        coachNote: (phase.coach_week_notes ?? [])[weekInPhase] ?? '',
        // Per-week targets take precedence over the phase-level fallback
        calories: wd?.calorie_target ?? phase.calorie_target,
        protein: wd?.protein_g ?? phase.protein_g,
        carbs: wd?.carbs_g ?? phase.carbs_g,
        fat: wd?.fat_g ?? phase.fat_g,
        fibre: wd?.fibre_g ?? null,
      }
    }
  }
  return null
}

/**
 * Picks whichever of a client's (possibly several) phased plans is "live"
 * right now — the first one, in the given order, whose computeWeekInfo
 * actually resolves (i.e. has started and hasn't finished). Same
 * first-match precedence the client dashboard's "This week" card already
 * used; now the one place that rule lives, so every surface that needs
 * "what week is this client on right now" agrees.
 */
export function pickCurrentWeek(plans: WeekPlan[]): WeekInfo | null {
  for (const plan of plans) {
    const info = computeWeekInfo(plan)
    if (info) return info
  }
  return null
}

/**
 * Server-side: resolves the current week from whichever of this client's
 * phased "Weekly Changes" plans are visible to them — the same set
 * app/api/client/plans/route.ts itself returns, so this can never surface
 * a week from a draft plan the client can't actually see.
 */
export async function resolveClientCurrentWeek(
  admin: SupabaseClient,
  clientId: string,
  coachId: string,
): Promise<WeekInfo | null> {
  const { data } = await admin
    .from('client_plans')
    .select('id, name, start_date, phases')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .eq('is_visible_to_client', true)
    .order('updated_at', { ascending: true })

  if (!data || data.length === 0) return null
  return pickCurrentWeek(data as WeekPlan[])
}
