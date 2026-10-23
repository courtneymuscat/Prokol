import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Covers the new auto-setup branch in app/api/onboarding/complete/route.ts:
// serve targets + a matched meal plan, only for clients with an active
// coach relationship (signup-link clients, by construction — see the
// route's own comment), and only when nothing's already been set manually.

let coachRel: { id: string; coach_id: string; status: string } | null = null
let existingProfile: { subscription_tier: string; full_name: string | null } | null = null
let existingServeTargets: { id: string } | null = null
let existingMealPlan: { id: string } | null = null
let mealPlanCandidates: Array<{ id: string; name: string; goal: string; total_calories: number; content: unknown }> = []

const serveTargetInserts: Record<string, unknown>[] = []
const mealPlanInserts: Record<string, unknown>[] = []
const profileUpserts: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'client-1' } } }) },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: existingProfile }) }) }),
          upsert: (row: Record<string, unknown>) => {
            profileUpserts.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      if (table === 'coach_clients') {
        return { select: () => ({ eq: () => ({ in: () => ({ maybeSingle: async () => ({ data: coachRel }) }) }) }) }
      }
      if (table === 'client_serve_targets') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existingServeTargets }) }) }),
          insert: (row: Record<string, unknown>) => { serveTargetInserts.push(row); return Promise.resolve({ error: null }) },
        }
      }
      if (table === 'client_meal_plans') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existingMealPlan }) }) }) }),
          insert: (row: Record<string, unknown>) => { mealPlanInserts.push(row); return Promise.resolve({ error: null }) },
        }
      }
      if (table === 'meal_plans') {
        return { select: () => ({ eq: () => ({ is: async () => ({ data: mealPlanCandidates }) }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { POST } = await import('@/app/api/onboarding/complete/route')

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

const BASE_BODY = {
  goal: 'fat_loss',
  first_name: 'Test',
  age: 30,
  sex: 'female',
  height_cm: 165,
  weight_kg: 65,
  dietary_preference: 'vegan',
  steps_per_day: 8000,
  activities: [],
  tdee: 2000,
  target_calories: 1800,
  target_protein: 143,
  target_carbs: 150,
  target_fat: 52,
  adjustment_pct: 20,
}

beforeEach(() => {
  coachRel = { id: 'rel-1', coach_id: 'coach-1', status: 'active' }
  existingProfile = { subscription_tier: 'individual_free', full_name: null }
  existingServeTargets = null
  existingMealPlan = null
  mealPlanCandidates = [
    { id: 'plan-vegan-1800', name: 'Vegan 1800', goal: 'vegan', total_calories: 1800, content: [{ foo: 'bar' }] },
    { id: 'plan-omni-1800', name: 'Omnivore 1800', goal: 'omnivore', total_calories: 1800, content: [] },
  ]
  serveTargetInserts.length = 0
  mealPlanInserts.length = 0
  profileUpserts.length = 0
})

describe('POST /api/onboarding/complete — signup-link auto-setup', () => {
  it('auto-writes serve targets and the diet-matched meal plan when the client has an active coach relationship', async () => {
    await POST(fakeRequest(BASE_BODY))
    expect(serveTargetInserts).toHaveLength(1)
    expect(serveTargetInserts[0]).toMatchObject({ client_id: 'client-1', coach_id: 'coach-1' })
    expect(mealPlanInserts).toHaveLength(1)
    expect(mealPlanInserts[0]).toMatchObject({ meal_plan_id: 'plan-vegan-1800', client_id: 'client-1', coach_id: 'coach-1', status: 'active' })
  })

  it('does not touch profiles.target_* from the matched plan — the TDEE calc stays authoritative', async () => {
    await POST(fakeRequest(BASE_BODY))
    expect(profileUpserts[0]).toMatchObject({ target_calories: 1800, target_protein: 143 })
    // Only one profile write happens at all (the onboarding upsert itself) —
    // no second write syncing from the assigned plan's own totals.
    expect(profileUpserts).toHaveLength(1)
  })

  it('does nothing when the client has no coach relationship (a plain individual signup)', async () => {
    coachRel = null
    await POST(fakeRequest(BASE_BODY))
    expect(serveTargetInserts).toHaveLength(0)
    expect(mealPlanInserts).toHaveLength(0)
  })

  it('skips serve-target auto-write when one already exists — never clobbers manual coach work', async () => {
    existingServeTargets = { id: 'existing-targets' }
    await POST(fakeRequest(BASE_BODY))
    expect(serveTargetInserts).toHaveLength(0)
  })

  it('skips meal-plan auto-assignment when the client already has an active plan', async () => {
    existingMealPlan = { id: 'existing-plan' }
    await POST(fakeRequest(BASE_BODY))
    expect(mealPlanInserts).toHaveLength(0)
  })

  it('does not assign any plan when no template matches the client\'s diet', async () => {
    mealPlanCandidates = [{ id: 'plan-omni-1800', name: 'Omnivore 1800', goal: 'omnivore', total_calories: 1800, content: [] }]
    await POST(fakeRequest(BASE_BODY))
    expect(mealPlanInserts).toHaveLength(0)
  })

  it('still completes onboarding successfully even with no coach relationship at all', async () => {
    coachRel = null
    const res = await POST(fakeRequest(BASE_BODY))
    expect(res.status).toBe(200)
  })
})
