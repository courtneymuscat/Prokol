import { describe, it, expect } from 'vitest'
import { mapDietaryPreferenceToMealPlanGoal, pickBestMealPlan, macrosToServes, mealMacrosToServes } from '@/lib/autoAssignNutrition'

describe('mapDietaryPreferenceToMealPlanGoal', () => {
  it('maps vegan and dairy_free straight across — the two non-omnivore options onboarding actually offers', () => {
    expect(mapDietaryPreferenceToMealPlanGoal('vegan')).toBe('vegan')
    expect(mapDietaryPreferenceToMealPlanGoal('dairy_free')).toBe('dairy_free')
  })

  it('bridges the pescetarian/pescatarian spelling difference (defensive — no longer offered in onboarding)', () => {
    expect(mapDietaryPreferenceToMealPlanGoal('pescetarian')).toBe('pescatarian')
  })

  it('still maps vegetarian defensively, even though it is no longer offered in onboarding', () => {
    expect(mapDietaryPreferenceToMealPlanGoal('vegetarian')).toBe('vegetarian')
  })

  it('falls back to omnivore for "no preference" / unset', () => {
    expect(mapDietaryPreferenceToMealPlanGoal('none')).toBe('omnivore')
    expect(mapDietaryPreferenceToMealPlanGoal(null)).toBe('omnivore')
    expect(mapDietaryPreferenceToMealPlanGoal(undefined)).toBe('omnivore')
  })
})

describe('pickBestMealPlan', () => {
  const candidates = [
    { id: 'p1', goal: 'omnivore', total_calories: 1800 },
    { id: 'p2', goal: 'omnivore', total_calories: 2200 },
    { id: 'p3', goal: 'vegan', total_calories: 1900 },
  ]

  it('only considers candidates matching the diet goal exactly', () => {
    const best = pickBestMealPlan(candidates, 2000, 'vegan')
    expect(best?.id).toBe('p3')
  })

  it('picks the closest-calorie match among diet-matching candidates', () => {
    const best = pickBestMealPlan(candidates, 2100, 'omnivore')
    expect(best?.id).toBe('p2')
  })

  it('returns null rather than cross-matching into a different diet — e.g. no pescatarian plan exists here', () => {
    expect(pickBestMealPlan(candidates, 2000, 'pescatarian')).toBeNull()
  })

  it('returns null for an empty candidate list', () => {
    expect(pickBestMealPlan([], 2000, 'omnivore')).toBeNull()
  })
})

describe('macrosToServes', () => {
  it('derives serve counts from protein/carb/fat grams', () => {
    const serves = macrosToServes({ proteinG: 150, carbG: 200, fatG: 70 })
    expect(serves.protein_serves).toBeCloseTo(5) // 150 / 30
    expect(serves.fat_serves).toBeCloseTo(7) // 70 / 10
    expect(serves.veg_unlimited).toBe(true)
  })

  it('has no fruit_serves field — fruit is just carbs now, folded into carb_serves', () => {
    const serves = macrosToServes({ proteinG: 150, carbG: 200, fatG: 70 })
    expect(serves).not.toHaveProperty('fruit_serves')
  })

  it('never produces a negative carb-serve count when carbs are very low', () => {
    const serves = macrosToServes({ proteinG: 100, carbG: 10, fatG: 50 })
    expect(serves.carb_serves).toBeGreaterThanOrEqual(0)
  })

  it('reserving a whole day\'s veg carb allowance wipes out a single meal\'s carbs — this is why mealMacrosToServes exists, do not use macrosToServes per-meal', () => {
    // A real example: Beef Mince Bowl — Cal Conscious has 32.7g carbs,
    // clearly worth ~1.5-2 carb serves — but macrosToServes' ~38g veg
    // reservation swallows it whole and reports zero.
    const serves = macrosToServes({ proteinG: 36.6, carbG: 32.7, fatG: 12.2 })
    expect(serves.carb_serves).toBe(0)
  })
})

describe('mealMacrosToServes', () => {
  it('derives serve counts straight from grams, with no veg reservation', () => {
    const serves = mealMacrosToServes({ proteinG: 150, carbG: 200, fatG: 70 })
    expect(serves.protein_serves).toBeCloseTo(5) // 150 / 30
    expect(serves.carb_serves).toBeCloseTo(10) // 200 / 20
    expect(serves.fat_serves).toBeCloseTo(7) // 70 / 10
  })

  it('correctly reports carb serves for a single meal that macrosToServes would zero out', () => {
    // Same Beef Mince Bowl — Cal Conscious example as above — 32.7g carbs
    // should read as real carb serves for a single meal, not zero.
    const serves = mealMacrosToServes({ proteinG: 36.6, carbG: 32.7, fatG: 12.2 })
    expect(serves.carb_serves).toBeCloseTo(1.5) // 32.7 / 20 = 1.635, rounds to nearest 0.5
  })

  it('has no fruit_serves or veg_unlimited fields — not meaningful for a single meal', () => {
    const serves = mealMacrosToServes({ proteinG: 30, carbG: 40, fatG: 10 })
    expect(serves).not.toHaveProperty('fruit_serves')
    expect(serves).not.toHaveProperty('veg_unlimited')
  })
})
