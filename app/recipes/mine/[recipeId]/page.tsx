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
  section?: string | null
}

function toIngredient(food: MealFood, section: string | null): Ingredient {
  return {
    food_id: food.food_id ?? null,
    food_name: food.food_name,
    grams: food.grams,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    section,
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
  const [sections, setSections] = useState<string[]>([])
  const [newSectionName, setNewSectionName] = useState('')

  useEffect(() => {
    if (isNew) return
    fetch(`/api/client/my-recipes/${recipeId}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name ?? '')
        setCategory(data.category ?? '')
        setInstructions(data.instructions ?? '')
        setServings(data.servings ? String(data.servings) : '')
        const loadedIngredients: Ingredient[] = data.ingredients ?? []
        setIngredients(loadedIngredients)
        const loadedSections: string[] = []
        for (const ing of loadedIngredients) {
          if (ing.section && !loadedSections.includes(ing.section)) loadedSections.push(ing.section)
        }
        setSections(loadedSections)
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

  function addIngredient(food: MealFood, section: string | null) {
    setIngredients((prev) => [...prev, toIngredient(food, section)])
  }
  function removeIngredient(target: Ingredient) {
    setIngredients((prev) => prev.filter((i) => i !== target))
  }
  function addSection() {
    const trimmed = newSectionName.trim()
    if (!trimmed || sections.includes(trimmed)) return
    setSections((prev) => [...prev, trimmed])
    setNewSectionName('')
  }
  function removeSection(name: string) {
    setSections((prev) => prev.filter((s) => s !== name))
    setIngredients((prev) => prev.map((i) => (i.section === name ? { ...i, section: null } : i)))
  }

  const ingredientGroups: { title: string | null; items: Ingredient[] }[] = [
    { title: null, items: ingredients.filter((i) => !i.section) },
    ...sections.map((s) => ({ title: s, items: ingredients.filter((i) => i.section === s) })),
  ]

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

          {ingredientGroups.map((group, gi) => (
            <div key={group.title ?? '__ungrouped'} className={gi > 0 ? 'pt-4 border-t border-gray-100' : ''}>
              {group.title && (
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.title}</h3>
                  <button onClick={() => removeSection(group.title!)} className="text-[11px] text-gray-300 hover:text-red-500">
                    Remove section
                  </button>
                </div>
              )}
              {group.items.length > 0 && (
                <ul className="divide-y divide-gray-50 mb-2">
                  {group.items.map((i, idx) => (
                    <li key={idx} className="flex items-start justify-between py-2.5 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{i.food_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {i.grams}g · {Math.round(i.calories)} kcal · {Math.round(i.protein)}g P · {Math.round(i.carbs)}g C · {Math.round(i.fat)}g F
                        </p>
                      </div>
                      <button onClick={() => removeIngredient(i)} className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0 mt-0.5">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <MealPlanFoodSearch onAdd={(food) => addIngredient(food, group.title)} />
            </div>
          ))}

          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSection() } }}
              placeholder="Section name — e.g. Base, Centre, Top…"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm mt-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              onClick={addSection}
              disabled={!newSectionName.trim()}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 mt-3 whitespace-nowrap"
            >
              + Add Section
            </button>
          </div>
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
