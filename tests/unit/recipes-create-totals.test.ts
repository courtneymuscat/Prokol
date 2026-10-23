import { describe, it, expect, vi, beforeEach } from 'vitest'

// POST /api/coach/recipes must always recompute total_calories/protein/
// carbs/fat from the submitted ingredients server-side — never trust
// client-sent totals, since a buggy or malicious client could otherwise
// persist a recipe whose displayed totals don't match its own ingredients.

let insertedRecipe: Record<string, unknown> | null = null
let insertedIngredients: Record<string, unknown>[] | null = null

vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'admin-1' }))
vi.mock('@/lib/org', () => ({ getOrgForUser: async () => null }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'recipes') {
        return {
          insert: (row: Record<string, unknown>) => {
            insertedRecipe = row
            return { select: () => ({ single: async () => ({ data: { id: 'recipe-1' }, error: null }) }) }
          },
        }
      }
      if (table === 'recipe_ingredients') {
        return {
          insert: async (rows: Record<string, unknown>[]) => {
            insertedIngredients = rows
            return { error: null }
          },
        }
      }
      if (table === 'recipe_modifications') {
        return { insert: async () => ({ error: null }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { POST } = await import('@/app/api/coach/recipes/route')

function fakeRequest(body: unknown) {
  return { json: async () => body } as unknown as import('next/server').NextRequest
}

beforeEach(() => {
  insertedRecipe = null
  insertedIngredients = null
})

describe('POST /api/coach/recipes — recomputes totals from ingredients', () => {
  it('sums ingredient macros into the recipe totals regardless of any client-sent totals', async () => {
    const res = await POST(fakeRequest({
      name: 'Test Recipe',
      // Deliberately include bogus top-level totals — the route has no
      // such field, but this proves nothing resembling it is read back out.
      total_calories: 999999,
      ingredients: [
        { food_name: 'Chicken', grams: 150, calories: 200, protein: 40, carbs: 0, fat: 5 },
        { food_name: 'Rice', grams: 150, calories: 250, protein: 5, carbs: 55, fat: 1 },
      ],
    }))
    expect(res.status).not.toBe(400)
    expect(insertedRecipe?.total_calories).toBe(450)
    expect(insertedRecipe?.total_protein).toBe(45)
    expect(insertedRecipe?.total_carbs).toBe(55)
    expect(insertedRecipe?.total_fat).toBe(6)
    expect(insertedIngredients).toHaveLength(2)
  })

  it('rejects a recipe with no ingredients', async () => {
    const res = await POST(fakeRequest({ name: 'Empty', ingredients: [] }))
    expect(res.status).toBe(400)
  })

  it('rejects a recipe with no name', async () => {
    const res = await POST(fakeRequest({ ingredients: [{ food_name: 'x', grams: 1, calories: 1, protein: 1, carbs: 1, fat: 1 }] }))
    expect(res.status).toBe(400)
  })
})
