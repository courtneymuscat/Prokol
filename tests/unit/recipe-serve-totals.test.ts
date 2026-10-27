import { describe, it, expect } from 'vitest'
import { aggregateServeTotals, type ServeInfo } from '@/lib/recipeServeMath'

// Recipe-level "this dish is approx. X protein serves, Y carb serves…" —
// sums each ingredient's own serve count into its category bucket, using
// the coach's real food-serves cheat sheet values (never re-derived from
// the recipe book's own reference numbers).

describe('aggregateServeTotals', () => {
  const serveMap: Record<string, ServeInfo> = {
    'chicken breast': { category: 'protein', protein_per_serve: 30, carbs_per_serve: null, fat_per_serve: null },
    'rice': { category: 'carb', protein_per_serve: null, carbs_per_serve: 20, fat_per_serve: null },
    'avocado': { category: 'fat', protein_per_serve: null, carbs_per_serve: null, fat_per_serve: 10 },
    'apple': { category: 'fruit', protein_per_serve: null, carbs_per_serve: 20, fat_per_serve: null },
    'broccoli': { category: 'veg', protein_per_serve: null, carbs_per_serve: null, fat_per_serve: null },
  }

  it('sums serves per category across multiple ingredients', () => {
    const totals = aggregateServeTotals(
      [
        { food_name: 'Chicken Breast', protein: 30, carbs: 0, fat: 0 },
        { food_name: 'Chicken Breast', protein: 15, carbs: 0, fat: 0 },
        { food_name: 'Rice', protein: 0, carbs: 50, fat: 0 },
      ],
      serveMap,
    )
    expect(totals.protein).toBeCloseTo(1.5)
    expect(totals.carb).toBeCloseTo(2.5)
    expect(totals.fat).toBeNull()
  })

  it('folds fruit into the same carb bucket, since a fruit serve is just 20g carbs like any other carb source', () => {
    const totals = aggregateServeTotals(
      [
        { food_name: 'Rice', protein: 0, carbs: 20, fat: 0 },
        { food_name: 'Apple', protein: 0, carbs: 20, fat: 0 },
      ],
      serveMap,
    )
    expect(totals.carb).toBeCloseTo(2)
  })

  it('ignores ingredients with no cheat-sheet match and veg/free categories', () => {
    const totals = aggregateServeTotals(
      [
        { food_name: 'Broccoli', protein: 2, carbs: 5, fat: 0 },
        { food_name: 'Unknown Food', protein: 10, carbs: 10, fat: 10 },
      ],
      serveMap,
    )
    expect(totals).toEqual({ protein: null, carb: null, fat: null })
  })

  it('returns all nulls for an empty ingredient list', () => {
    expect(aggregateServeTotals([], serveMap)).toEqual({ protein: null, carb: null, fat: null })
  })
})
