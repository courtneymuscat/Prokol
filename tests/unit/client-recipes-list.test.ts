import { describe, it, expect, vi, beforeEach } from 'vitest'

// GET /api/client/recipes — resolves the client's own active coach via
// coach_clients, then returns that coach's recipe library. No org-sharing
// indirection needed here (unlike food-serves) since recipes follow
// coach_id directly and a client only has one active coach relationship.

type RecipeRow = { id: string; name: string; coach_id: string; archived_at: string | null }

let coachClientRel: { coach_id: string } | null = null
let recipeRows: RecipeRow[] = []

// getSubscription() (called for the platform-recipe-library gate) also goes
// through this same mocked client — kept deterministically ungated
// (individual_free, no coach_clients row) here so these two tests keep
// exercising the pre-existing coach-only code path unchanged.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'client-1' } } } }),
      getUser: async () => ({ data: { user: { id: 'client-1' } } }),
    },
    from: (table: string) => {
      if (table === 'profiles') return { select: () => ({ eq: () => ({ single: async () => ({ data: { subscription_tier: 'individual_free', user_type: 'individual' } }) }) }) }
      if (table === 'coach_clients') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }
      throw new Error(`unexpected table (session client): ${table}`)
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'coach_clients') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: coachClientRel, error: coachClientRel ? null : { message: 'not found' } }),
              }),
            }),
          }),
        }
      }
      if (table === 'recipes') {
        return {
          select: () => ({
            eq: (_c: string, coachId: string) => ({
              is: (_col: string, val: null) => ({
                order: async () => ({
                  data: recipeRows.filter((r) => r.coach_id === coachId && r.archived_at === val),
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { GET } = await import('@/app/api/client/recipes/route')

beforeEach(() => {
  coachClientRel = { coach_id: 'coach-1' }
  recipeRows = [
    { id: 'recipe-1', name: 'Protein Oats', coach_id: 'coach-1', archived_at: null },
    { id: 'recipe-2', name: 'Someone Else\'s Recipe', coach_id: 'coach-2', archived_at: null },
    { id: 'recipe-3', name: 'Archived One', coach_id: 'coach-1', archived_at: '2026-01-01T00:00:00Z' },
  ]
})

describe('GET /api/client/recipes', () => {
  it('returns only the client\'s own active coach\'s non-archived recipes', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.map((r: RecipeRow) => r.id)).toEqual(['recipe-1'])
  })

  it('returns an empty list when the client has no active coach relationship', async () => {
    coachClientRel = null
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual([])
  })
})
