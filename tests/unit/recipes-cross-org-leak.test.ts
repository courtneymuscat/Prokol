import { describe, it, expect, vi, beforeEach } from 'vitest'

// Recipes are authored content the coach owns, not an operational client
// relationship — unlike coach_clients/conversations (which must stay siloed
// per gym, since those really are different businesses' customers), a
// coach's recipe library should follow coach_id everywhere, the same way
// meal_plans/autoflow_templates/programs templates already do (all three
// list routes filter by coach_id only, no org_id). A coach who owns more
// than one organisation (gym org-switching, lib/admin.ts enterGymOrg) is
// still the same coach_id in every one of them, so a recipe authored while
// acting as one gym must still show up while acting as another.

type RecipeRow = {
  id: string
  name: string
  coach_id: string
  org_id: string | null
  category: string | null
  archived_at: string | null
}

let recipeRows: RecipeRow[] = []

vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'admin-1' }))
vi.mock('@/lib/org', () => ({ getOrgForUser: async () => ({ org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }) }))

function makeQuery(initial: RecipeRow[]) {
  let rows = initial
  const builder = {
    eq: (col: keyof RecipeRow, val: unknown) => {
      rows = rows.filter((r) => r[col] === val)
      return builder
    },
    is: (col: keyof RecipeRow, val: null) => {
      rows = rows.filter((r) => r[col] === val)
      return builder
    },
    order: async () => ({ data: rows, error: null }),
  }
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'recipes') return { select: () => makeQuery(recipeRows) }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { GET } = await import('@/app/api/coach/recipes/route')

function fakeRequest(url: string) {
  return { url } as unknown as import('next/server').NextRequest
}

beforeEach(() => {
  recipeRows = [
    { id: 'recipe-court', name: 'Court Recipe', coach_id: 'admin-1', org_id: 'court-org', category: null, archived_at: null },
    { id: 'recipe-arete', name: 'Arete Recipe', coach_id: 'admin-1', org_id: 'arete-org', category: null, archived_at: null },
  ]
})

describe('GET /api/coach/recipes — carries a coach\'s recipes across every org they own', () => {
  it('returns recipes authored under any org while acting as a different one', async () => {
    // Membership mock always resolves to 'arete-org' — if the route still
    // filtered by org_id, 'recipe-court' would be missing here.
    const res = await GET(fakeRequest('https://x/api/coach/recipes'))
    const body = await res.json()
    expect(body.map((r: RecipeRow) => r.id).sort()).toEqual(['recipe-arete', 'recipe-court'])
  })

  it('still scopes strictly by coach_id, so a different coach\'s recipes never appear', async () => {
    recipeRows.push({ id: 'recipe-other-coach', name: 'Not mine', coach_id: 'someone-else', org_id: 'arete-org', category: null, archived_at: null })
    const res = await GET(fakeRequest('https://x/api/coach/recipes'))
    const body = await res.json()
    expect(body.map((r: RecipeRow) => r.id)).not.toContain('recipe-other-coach')
  })
})
