import { describe, it, expect, vi, beforeEach } from 'vitest'

// PATCH /api/client/meal-plans/[planId]/swap-recipe — Mode A substitution.
// Verifies ownership checking, the contiguous-recipe-group identification,
// and that the replacement recipe is scaled to match the original group's
// calories end-to-end (not just the pure math in isolation).

type PlanRow = { id: string; client_id: string; content: unknown[] }

let planRow: PlanRow | null = null
let updatedContent: unknown[] | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'client-1' } } }) },
    from: (table: string) => {
      if (table === 'client_meal_plans') {
        return {
          select: () => ({
            eq: (_c1: string, planId: string) => ({
              eq: (_c2: string, clientId: string) => ({
                single: async () => {
                  if (planRow && planRow.id === planId && planRow.client_id === clientId) {
                    return { data: planRow, error: null }
                  }
                  return { data: null, error: { message: 'not found' } }
                },
              }),
            }),
          }),
          update: (patch: { content: unknown[] }) => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => {
                    updatedContent = patch.content
                    return { data: { id: planRow?.id, content: patch.content }, error: null }
                  },
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table (server client): ${table}`)
    },
  }),
}))

type NewRecipeRow = { id: string; name: string; total_calories: number }
let newRecipeRow: NewRecipeRow | null = null
let newRecipeIngredients: Array<{ food_id: string | null; food_name: string; grams: number; calories: number; protein: number; carbs: number; fat: number; sort_order: number }> = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'recipes') {
        return {
          select: () => ({
            eq: (_c: string, id: string) => ({
              single: async () => ({ data: newRecipeRow && newRecipeRow.id === id ? newRecipeRow : null, error: null }),
            }),
          }),
        }
      }
      if (table === 'recipe_ingredients') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: newRecipeIngredients }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table (admin client): ${table}`)
    },
  }),
}))

const { PATCH } = await import('@/app/api/client/meal-plans/[planId]/swap-recipe/route')

function fakeRequest(body: unknown) {
  return { json: async () => body } as unknown as import('next/server').NextRequest
}

beforeEach(() => {
  updatedContent = null
  planRow = {
    id: 'plan-1',
    client_id: 'client-1',
    content: [
      {
        id: 'slot-1',
        label: 'Breakfast',
        foods: [
          { food_name: 'Oats', grams: 60, calories: 230, protein: 8, carbs: 40, fat: 4, recipe_id: 'old-recipe', recipe_name: 'Protein Oats' },
          { food_name: 'Protein powder', grams: 30, calories: 115, protein: 25, carbs: 2, fat: 1, recipe_id: 'old-recipe', recipe_name: 'Protein Oats' },
          { food_name: 'Banana', grams: 100, calories: 90, protein: 1, carbs: 20, fat: 0 },
        ],
      },
    ],
  }
  newRecipeRow = { id: 'new-recipe', name: 'Egg Wrap', total_calories: 172.5 }
  newRecipeIngredients = [
    { food_id: null, food_name: 'Eggs', grams: 100, calories: 150, protein: 12, carbs: 1, fat: 11, sort_order: 0 },
    { food_id: null, food_name: 'Wrap', grams: 20, calories: 22.5, protein: 1, carbs: 4, fat: 0, sort_order: 1 },
  ]
})

describe('PATCH swap-recipe', () => {
  it('replaces the recipe group, scaling the new recipe to match the old group\'s calories', async () => {
    const res = await PATCH(
      fakeRequest({ meal_index: 0, recipe_id: 'old-recipe', new_recipe_id: 'new-recipe' }),
      { params: Promise.resolve({ planId: 'plan-1' }) },
    )
    expect(res.status).not.toBe(400)
    expect(res.status).not.toBe(404)

    const foods = (updatedContent![0] as { foods: Array<Record<string, unknown>> }).foods
    // Original group (230 + 115 = 345 kcal) replaces new recipe (172.5 kcal
    // total) → scale factor 2, so Eggs/Wrap exactly double.
    expect(foods).toHaveLength(3)
    expect(foods[0]).toMatchObject({ food_name: 'Eggs', grams: 200, calories: 300, recipe_id: 'new-recipe', recipe_name: 'Egg Wrap' })
    expect(foods[0]).toHaveProperty('swapped_from')
    expect(foods[1]).toMatchObject({ food_name: 'Wrap', grams: 40, calories: 45, recipe_id: 'new-recipe' })
    // Untouched non-recipe food stays exactly as-is, in its original position.
    expect(foods[2]).toMatchObject({ food_name: 'Banana', calories: 90 })
  })

  it('rejects a request for a plan the client does not own', async () => {
    const res = await PATCH(
      fakeRequest({ meal_index: 0, recipe_id: 'old-recipe', new_recipe_id: 'new-recipe' }),
      { params: Promise.resolve({ planId: 'someone-elses-plan' }) },
    )
    expect(res.status).toBe(404)
  })

  it('rejects when the recipe_id is not present in the target meal', async () => {
    const res = await PATCH(
      fakeRequest({ meal_index: 0, recipe_id: 'not-a-real-group', new_recipe_id: 'new-recipe' }),
      { params: Promise.resolve({ planId: 'plan-1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('rejects when the replacement recipe cannot be found', async () => {
    newRecipeRow = null
    const res = await PATCH(
      fakeRequest({ meal_index: 0, recipe_id: 'old-recipe', new_recipe_id: 'missing-recipe' }),
      { params: Promise.resolve({ planId: 'plan-1' }) },
    )
    expect(res.status).toBe(404)
  })
})
