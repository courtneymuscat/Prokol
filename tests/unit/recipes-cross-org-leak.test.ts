import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for the same bug class fixed everywhere else this
// session: app/api/coach/recipes/route.ts must scope its list query by
// org_id too, not just coach_id — a coach who owns more than one
// organisation (gym org-switching, lib/admin.ts enterGymOrg) is still the
// same coach_id in every one of them, so an unscoped query would show
// every org's recipes regardless of which one is currently active.

type RecipeRow = {
  id: string
  name: string
  coach_id: string
  org_id: string | null
  category: string | null
  archived_at: string | null
}

let recipeRows: RecipeRow[] = []
let membership: { org_id: string; org_name: string; org_slug: string; role: string } | null = null

vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'admin-1' }))
vi.mock('@/lib/org', () => ({ getOrgForUser: async () => membership }))

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

describe('GET /api/coach/recipes — does not leak recipes across orgs owned by the same coach', () => {
  it('only returns recipes tagged to the currently active org', async () => {
    membership = { org_id: 'arete-org', org_name: 'Arete', org_slug: 'arete', role: 'owner' }
    const res = await GET(fakeRequest('https://x/api/coach/recipes'))
    const body = await res.json()
    expect(body.map((r: RecipeRow) => r.id)).toEqual(['recipe-arete'])
  })

  it('shows the other org\'s recipe when acting as that org instead', async () => {
    membership = { org_id: 'court-org', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    const res = await GET(fakeRequest('https://x/api/coach/recipes'))
    const body = await res.json()
    expect(body.map((r: RecipeRow) => r.id)).toEqual(['recipe-court'])
  })

  it('returns everything for a solo coach with no org membership', async () => {
    membership = null
    const res = await GET(fakeRequest('https://x/api/coach/recipes'))
    const body = await res.json()
    expect(body.map((r: RecipeRow) => r.id).sort()).toEqual(['recipe-arete', 'recipe-court'])
  })
})
