import { describe, it, expect } from 'vitest'
import { computeRecipeSwapScale, scaleRecipeIngredients } from '@/lib/recipeSwap'

describe('computeRecipeSwapScale', () => {
  it('computes the ratio of original calories to the replacement recipe\'s own total', () => {
    expect(computeRecipeSwapScale(500, 250)).toBe(2)
    expect(computeRecipeSwapScale(250, 500)).toBe(0.5)
  })

  it('falls back to 1 (no scaling) when either side is zero or missing', () => {
    expect(computeRecipeSwapScale(0, 250)).toBe(1)
    expect(computeRecipeSwapScale(500, 0)).toBe(1)
  })
})

describe('scaleRecipeIngredients', () => {
  it('scales every macro field uniformly, preserving the recipe\'s internal ratios', () => {
    const scaled = scaleRecipeIngredients(
      [
        { food_name: 'Chicken', grams: 150, calories: 200, protein: 40, carbs: 0, fat: 5 },
        { food_name: 'Rice', grams: 150, calories: 250, protein: 5, carbs: 55, fat: 1 },
      ],
      2,
    )
    expect(scaled[0]).toMatchObject({ grams: 300, calories: 400, protein: 80, carbs: 0, fat: 10 })
    expect(scaled[1]).toMatchObject({ grams: 300, calories: 500, protein: 10, carbs: 110, fat: 2 })
  })

  it('never scales grams below 1g even for a very small scale factor', () => {
    const scaled = scaleRecipeIngredients([{ food_name: 'Salt', grams: 1, calories: 0, protein: 0, carbs: 0, fat: 0 }], 0.01)
    expect(scaled[0].grams).toBe(1)
  })
})
