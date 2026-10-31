'use client'

import { useState } from 'react'
import MealFoodRow, { type RowData } from './MealFoodRow'
import type { FoodResult } from './FoodSearch'

type Ingredient = { name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }
type Item = RowData & { id: string }

// Reconstructs a per-100g FoodResult from a logged ingredient snapshot
// (notes only stores grams + totals, not the per-100g basis) so the row
// both displays correctly and recalculates correctly if grams change —
// same technique as MealBuilder's itemToMealItem.
function ingredientToItem(ing: Ingredient): Item {
  const factor = ing.grams > 0 ? 100 / ing.grams : 0
  const food: FoodResult = {
    id: crypto.randomUUID(),
    name: ing.name,
    calories_per_100g: ing.calories * factor,
    protein_per_100g: ing.protein * factor,
    carbs_per_100g: ing.carbs * factor,
    fat_per_100g: ing.fat * factor,
  }
  return { id: crypto.randomUUID(), food, grams: ing.grams, calories: ing.calories, protein: ing.protein, carbs: ing.carbs, fat: ing.fat }
}

function emptyItem(): Item {
  return { id: crypto.randomUUID(), food: null, grams: 100, calories: 0, protein: 0, carbs: 0, fat: 0 }
}

// Lets a client edit the individual ingredients of an already-logged
// multi-ingredient entry (a recipe, saved meal, or scanned meal) — add,
// remove, or reweigh any ingredient, with the row's totals and `notes`
// breakdown recalculated from the edited list. EditFoodLogForm (the
// sibling single-food editor) treats a log row as one opaque food and
// can't do this — this is specifically for rows that have an ingredient
// breakdown in `notes` to begin with.
export default function EditLoggedMealForm({
  foodName,
  ingredients,
  onSave,
  onCancel,
}: {
  foodName: string | null
  ingredients: Ingredient[]
  onSave: (update: { food_name: string | null; calories: number; protein: number; carbs: number; fat: number; notes: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(foodName ?? '')
  const [items, setItems] = useState<Item[]>(() => (ingredients.length > 0 ? ingredients.map(ingredientToItem) : [emptyItem()]))

  const totals = items.reduce(
    (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  function handleSave() {
    const validItems = items.filter((i) => i.food !== null)
    if (validItems.length === 0) return
    onSave({
      food_name: name.trim() || null,
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
      notes: JSON.stringify(validItems.map((i) => ({ name: i.food!.name, grams: i.grams, calories: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat }))),
    })
  }

  return (
    <div className="px-4 py-3 space-y-3 bg-blue-50/40 border-t border-blue-100">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Meal name"
        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <div className="space-y-2">
        {items.map((item) => (
          <MealFoodRow
            key={item.id}
            initial={item.food ? { food: item.food, grams: item.grams } : undefined}
            onChange={(data) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...data } : i)))}
            onRemove={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
          />
        ))}
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
          className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          + Add Ingredient
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'kcal', val: Math.round(totals.calories) },
          { label: 'P (g)', val: Math.round(totals.protein * 10) / 10 },
          { label: 'C (g)', val: Math.round(totals.carbs * 10) / 10 },
          { label: 'F (g)', val: Math.round(totals.fat * 10) / 10 },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-gray-900">{m.val}</p>
            <p className="text-[10px] text-gray-400">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={items.every((i) => i.food === null)}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Save changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm rounded-xl hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
