'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import MealPlanFoodSearch, { type MealFood } from '@/app/components/MealPlanFoodSearch'
import { CATEGORIES } from '@/lib/recipeTags'

type Ingredient = {
  food_id?: string | null
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

function toIngredient(food: MealFood): Ingredient {
  return {
    food_id: food.food_id ?? null,
    food_name: food.food_name,
    grams: food.grams,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  }
}

export default function MyRecipeEditorPage({ params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = use(params)
  const isNew = recipeId === 'new'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [instructions, setInstructions] = useState('')
  const [servings, setServings] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  useEffect(() => {
    if (isNew) return
    fetch(`/api/client/my-recipes/${recipeId}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name ?? '')
        setCategory(data.category ?? '')
        setInstructions(data.instructions ?? '')
        setServings(data.servings ? String(data.servings) : '')
        setIngredients(data.ingredients ?? [])
        setLoading(false)
      })
  }, [recipeId, isNew])

  const totals = ingredients.reduce(
    (acc, i) => ({
      grams: acc.grams + (i.grams || 0),
      calories: acc.calories + (i.calories || 0),
      protein: acc.protein + (i.protein || 0),
      carbs: acc.carbs + (i.carbs || 0),
      fat: acc.fat + (i.fat || 0),
    }),
    { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
  const servingsNum = Number(servings) || 0

  function addIngredient(food: MealFood) {
    setIngredients((prev) => [...prev, toIngredient(food)])
  }
  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Give your recipe a name'); return }
    if (!ingredients.length) { setError('Add at least one ingredient'); return }
    setSaving(true)
    setError(null)
    const body = {
      name,
      category: category || null,
      instructions,
      servings: servingsNum > 0 ? servingsNum : null,
      ingredients,
    }
    const res = await fetch(isNew ? '/api/client/my-recipes' : `/api/client/my-recipes/${recipeId}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
    router.push('/recipes')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white px-6 py-3.5 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-20">
        <button onClick={() => router.push('/recipes')} className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[15px] font-bold tracking-tight text-gray-900">{isNew ? 'New Recipe' : 'Edit Recipe'}</span>
      </nav>

      <main className="max-w-lg mx-auto p-6 space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bolognese batch"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white"
            >
              <option value="">No category</option>
              {CATEGORIES.filter((c) => c.value).map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Servings <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="e.g. 8 — lets you log a fraction later"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <p className="text-xs text-gray-400 mt-1">
              How many servings this batch makes — e.g. a cake cut into 8 slices. Leave blank if it doesn&apos;t apply; you can always log by weight instead.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="Cooking steps… (optional)"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Ingredients</h2>
            <div className="flex flex-wrap gap-1.5 justify-end">
              <span className="text-xs font-semibold text-gray-700">{Math.round(totals.calories)} kcal</span>
              <span className="text-xs text-blue-600">{Math.round(totals.protein)}g P</span>
              <span className="text-xs text-orange-600">{Math.round(totals.carbs)}g C</span>
              <span className="text-xs text-yellow-600">{Math.round(totals.fat)}g F</span>
            </div>
          </div>
          {totals.grams > 0 && servingsNum > 0 && (
            <p className="text-xs text-gray-400 -mt-2">
              ≈ {Math.round(totals.grams / servingsNum)}g and {Math.round(totals.calories / servingsNum)} kcal per serving
            </p>
          )}

          {ingredients.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {ingredients.map((i, idx) => (
                <li key={idx} className="flex items-start justify-between py-2.5 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{i.food_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {i.grams}g · {Math.round(i.calories)} kcal · {Math.round(i.protein)}g P · {Math.round(i.carbs)}g C · {Math.round(i.fat)}g F
                    </p>
                  </div>
                  <button onClick={() => removeIngredient(idx)} className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0 mt-0.5">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <MealPlanFoodSearch onAdd={addIngredient} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => router.push('/recipes')}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Recipe'}
          </button>
        </div>
      </main>
    </div>
  )
}
