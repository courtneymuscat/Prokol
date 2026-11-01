import { describe, it, expect, beforeEach } from 'vitest'
import { syncServeTargetsForClient } from '@/lib/serveTargetsSync'

// syncServeTargetsForClient re-resolves a client's EFFECTIVE daily target
// fresh from the DB every call — TDEE-saved profile fields by default, or
// an active meal plan's summed content when coach_clients.targets_source
// is 'meal_plan' — rather than trusting whatever the calling route just
// wrote. This is what closes the gap where serves could reflect a
// just-saved-but-inactive TDEE number while the client actually sees a
// different, meal-plan-driven target.

type Rel = { targets_source: string | null; targets_meal_plan_id: string | null }
type Profile = { target_calories: number | null; target_protein: number | null; target_fat: number | null }
type Plan = { content: unknown; total_calories: number | null }

let rel: Rel | null = null
let profile: Profile | null = null
let plansById: Record<string, Plan> = {}
let existingNotes: string | null = null
let upserted: Record<string, unknown> | null = null

function fakeAdmin() {
  return {
    from: (table: string) => {
      if (table === 'coach_clients') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rel }) }) }) }) }
      }
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }
      }
      if (table === 'client_meal_plans') {
        return {
          select: () => ({
            eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: plansById[id] ?? null }) }),
          }),
        }
      }
      if (table === 'client_serve_targets') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existingNotes !== null ? { notes: existingNotes } : null }) }) }),
          upsert: async (row: Record<string, unknown>) => { upserted = row; return { data: null, error: null } },
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  } as unknown as Parameters<typeof syncServeTargetsForClient>[0]
}

beforeEach(() => {
  rel = { targets_source: 'tdee', targets_meal_plan_id: null }
  profile = null
  plansById = {}
  existingNotes = null
  upserted = null
})

describe('syncServeTargetsForClient', () => {
  it('syncs from profile TDEE fields when targets_source is tdee', async () => {
    profile = { target_calories: 2062, target_protein: 108, target_fat: 78 }
    await syncServeTargetsForClient(fakeAdmin(), 'client-1', 'coach-1')
    expect(upserted).toMatchObject({ protein_serves: 3.5, carb_serves: 7.5, fat_serves: 8, veg_unlimited: true })
  })

  it('syncs from the active meal plan\'s summed content when targets_source is meal_plan, ignoring stale profile fields', async () => {
    rel = { targets_source: 'meal_plan', targets_meal_plan_id: 'plan-1' }
    // Stale/irrelevant TDEE numbers that must NOT be used
    profile = { target_calories: 9999, target_protein: 999, target_fat: 999 }
    plansById['plan-1'] = {
      total_calories: null,
      content: [
        { foods: [{ calories: 230, protein: 8, fat: 4 }, { calories: 115, protein: 25, fat: 1 }] },
        { foods: [{ calories: 400, protein: 20, fat: 15 }] },
      ],
    }
    await syncServeTargetsForClient(fakeAdmin(), 'client-1', 'coach-1')
    // calories = 230+115+400 = 745, protein = 8+25+20 = 53, fat = 4+1+15 = 20
    expect(upserted).not.toBeNull()
    expect((upserted as Record<string, unknown>).protein_serves).toBeCloseTo(2) // 53/30 = 1.77 -> roundHalf -> 2
    expect((upserted as Record<string, unknown>).fat_serves).toBeCloseTo(2) // 20/10
  })

  it('falls back to a plan\'s flat total_calories when it has no food items yet, but skips sync without a macro breakdown', async () => {
    rel = { targets_source: 'meal_plan', targets_meal_plan_id: 'plan-1' }
    plansById['plan-1'] = { total_calories: 2000, content: [] }
    await syncServeTargetsForClient(fakeAdmin(), 'client-1', 'coach-1')
    expect(upserted).toBeNull() // calories known but no protein/fat breakdown — don't guess
  })

  it('does nothing when no calorie target is resolvable at all', async () => {
    profile = { target_calories: null, target_protein: null, target_fat: null }
    await syncServeTargetsForClient(fakeAdmin(), 'client-1', 'coach-1')
    expect(upserted).toBeNull()
  })

  it('preserves existing notes on the serve targets row rather than wiping them', async () => {
    profile = { target_calories: 2062, target_protein: 108, target_fat: 78 }
    existingNotes = 'Prioritise protein at dinner'
    await syncServeTargetsForClient(fakeAdmin(), 'client-1', 'coach-1')
    expect((upserted as Record<string, unknown>).notes).toBe('Prioritise protein at dinner')
  })
})
