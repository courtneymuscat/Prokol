import { describe, it, expect } from 'vitest'
import { groupFoodsByRecipe } from '@/app/dashboard/MealPlanView'

// Recipes explode into consecutive flat MealFood rows sharing a recipe_id
// (see RecipePickerModal's callers in the coach editors) — the client view
// groups them back under one header. This tests the pure grouping logic
// directly, independent of rendering.

describe('groupFoodsByRecipe', () => {
  it('returns single-item groups for foods with no recipe_id', () => {
    const foods = [
      { food_name: 'Banana', grams: 100, calories: 90, protein: 1, carbs: 20, fat: 0 },
      { food_name: 'Yoghurt', grams: 150, calories: 100, protein: 10, carbs: 8, fat: 2 },
    ]
    const groups = groupFoodsByRecipe(foods)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ type: 'single', index: 0 })
    expect(groups[1]).toMatchObject({ type: 'single', index: 1 })
  })

  it('groups consecutive foods sharing the same recipe_id into one recipe group', () => {
    const foods = [
      { food_name: 'Oats', grams: 60, calories: 230, protein: 8, carbs: 40, fat: 4, recipe_id: 'r1', recipe_name: 'Protein Oats' },
      { food_name: 'Protein powder', grams: 30, calories: 115, protein: 25, carbs: 2, fat: 1, recipe_id: 'r1', recipe_name: 'Protein Oats' },
    ]
    const groups = groupFoodsByRecipe(foods)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ type: 'recipe', recipeId: 'r1', recipeName: 'Protein Oats' })
    if (groups[0].type === 'recipe') {
      expect(groups[0].items.map((i) => i.index)).toEqual([0, 1])
    }
  })

  it('keeps separate recipe groups and singles in their original order', () => {
    const foods = [
      { food_name: 'Banana', grams: 100, calories: 90, protein: 1, carbs: 20, fat: 0 },
      { food_name: 'Oats', grams: 60, calories: 230, protein: 8, carbs: 40, fat: 4, recipe_id: 'r1', recipe_name: 'Protein Oats' },
      { food_name: 'Protein powder', grams: 30, calories: 115, protein: 25, carbs: 2, fat: 1, recipe_id: 'r1', recipe_name: 'Protein Oats' },
      { food_name: 'Apple', grams: 150, calories: 80, protein: 0, carbs: 20, fat: 0 },
      { food_name: 'Chicken', grams: 150, calories: 250, protein: 45, carbs: 0, fat: 8, recipe_id: 'r2', recipe_name: 'Chicken Bowl' },
    ]
    const groups = groupFoodsByRecipe(foods)
    expect(groups.map((g) => g.type)).toEqual(['single', 'recipe', 'single', 'recipe'])
    expect(groups[1].type === 'recipe' && groups[1].recipeId).toBe('r1')
    expect(groups[3].type === 'recipe' && groups[3].recipeId).toBe('r2')
  })

  it('does not merge non-consecutive foods that happen to share a recipe_id', () => {
    const foods = [
      { food_name: 'Oats', grams: 60, calories: 230, protein: 8, carbs: 40, fat: 4, recipe_id: 'r1', recipe_name: 'Protein Oats' },
      { food_name: 'Apple', grams: 150, calories: 80, protein: 0, carbs: 20, fat: 0 },
      { food_name: 'Protein powder', grams: 30, calories: 115, protein: 25, carbs: 2, fat: 1, recipe_id: 'r1', recipe_name: 'Protein Oats' },
    ]
    const groups = groupFoodsByRecipe(foods)
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.type)).toEqual(['recipe', 'single', 'recipe'])
  })

  it('returns an empty array for an empty food list', () => {
    expect(groupFoodsByRecipe([])).toEqual([])
  })
})
