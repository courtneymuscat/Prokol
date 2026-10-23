import { describe, it, expect } from 'vitest'
import { computeServeCount } from '@/lib/recipeServes'

// Serve count is derived from the ingredient's own macro-gram-amount ÷ the
// matching per-serve macro amount for that category — protein serves in
// protein grams, carb/fruit serves in carb grams, fat serves in fat grams —
// deliberately not from parsing the free-text serving_desc field.

describe('computeServeCount', () => {
  it('returns null when there is no serve match', () => {
    expect(computeServeCount({ protein: 30, carbs: 0, fat: 0 }, undefined)).toBeNull()
  })

  it('computes protein serves from protein grams', () => {
    const serve = { category: 'protein', protein_per_serve: 30, carbs_per_serve: null, fat_per_serve: null }
    expect(computeServeCount({ protein: 45, carbs: 0, fat: 0 }, serve)).toBeCloseTo(1.5)
  })

  it('computes carb serves from carb grams', () => {
    const serve = { category: 'carb', protein_per_serve: null, carbs_per_serve: 20, fat_per_serve: null }
    expect(computeServeCount({ protein: 0, carbs: 50, fat: 0 }, serve)).toBeCloseTo(2.5)
  })

  it('computes fruit serves from carb grams too (fruit serves are carb-based)', () => {
    const serve = { category: 'fruit', protein_per_serve: null, carbs_per_serve: 20, fat_per_serve: null }
    expect(computeServeCount({ protein: 0, carbs: 20, fat: 0 }, serve)).toBeCloseTo(1)
  })

  it('computes fat serves from fat grams', () => {
    const serve = { category: 'fat', protein_per_serve: null, carbs_per_serve: null, fat_per_serve: 10 }
    expect(computeServeCount({ protein: 0, carbs: 0, fat: 15 }, serve)).toBeCloseTo(1.5)
  })

  it('returns null for veg/free categories (unlimited, no meaningful serve count)', () => {
    const serve = { category: 'veg', protein_per_serve: null, carbs_per_serve: null, fat_per_serve: null }
    expect(computeServeCount({ protein: 1, carbs: 5, fat: 0 }, serve)).toBeNull()
  })

  it('returns null when the matching per-serve value is missing', () => {
    const serve = { category: 'protein', protein_per_serve: null, carbs_per_serve: null, fat_per_serve: null }
    expect(computeServeCount({ protein: 30, carbs: 0, fat: 0 }, serve)).toBeNull()
  })
})
