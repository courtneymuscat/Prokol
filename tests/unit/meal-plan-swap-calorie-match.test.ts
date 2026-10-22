import { describe, it, expect } from 'vitest'
import { matchGramsForCalories } from '@/app/dashboard/MealPlanView'

// Core math behind the "scan a barcode, match the calories you're
// swapping out" feature: given the food being replaced was X kcal, and
// the replacement's own calories-per-100g rate, how many grams of the
// replacement hit the same X kcal.

describe('matchGramsForCalories', () => {
  it('solves grams so the replacement food matches the target calories', () => {
    // 50 kcal to match, replacement is 200 kcal/100g → 25g hits 50 kcal.
    expect(matchGramsForCalories(50, 200)).toBe(25)
  })

  it('rounds to the nearest whole gram', () => {
    // 100 kcal to match, replacement is 300 kcal/100g → 33.33g → 33g.
    expect(matchGramsForCalories(100, 300)).toBe(33)
  })

  it('never returns less than 1g even for a very calorie-dense replacement', () => {
    expect(matchGramsForCalories(1, 900)).toBe(1)
  })

  it('returns null when the target calories are zero or missing', () => {
    expect(matchGramsForCalories(0, 200)).toBeNull()
    expect(matchGramsForCalories(-5, 200)).toBeNull()
  })

  it('returns null when the replacement has no usable calories-per-100g (e.g. water)', () => {
    expect(matchGramsForCalories(50, 0)).toBeNull()
  })
})
