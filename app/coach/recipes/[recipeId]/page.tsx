'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import MealPlanFoodSearch, { type MealFood } from '@/app/components/MealPlanFoodSearch'
import { computeServeCount, aggregateServeTotals, type ServeInfo } from '@/lib/recipeServeMath'

type Ingredient = {
  food_id?: string | null
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

type Modification = { tag: string; note: string }

const CATEGORY_OPTIONS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']

const TAG_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'protein_up', label: 'Need more protein' },
  { value: 'protein_down', label: 'Need less protein' },
  { value: 'carbs_up', label: 'Need more carbs' },
  { value: 'carbs_down', label: 'Need less carbs' },
  { value: 'fat_up', label: 'Need more fat' },
  { value: 'fat_down', label: 'Need less fat' },
  { value: 'calories_up', label: 'Need more calories' },
  { value: 'calories_down', label: 'Need less calories' },
  { value: 'volume_up', label: 'Need more volume' },
  { value: 'general', label: 'General' },
]
const TAG_LABEL: Record<string, string> = Object.fromEntries(TAG_OPTIONS.map((t) => [t.value, t.label]))

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

export default function RecipeEditorPage({ params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = use(params)
  const isNew = recipeId === 'new'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [instructions, setInstructions] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [modifications, setModifications] = useState<Modification[]>([])
  const [newModTag, setNewModTag] = useState('general')
  const [newModNote, setNewModNote] = useState('')
  const [serveMap, setServeMap] = useState<Record<string, ServeInfo>>({})

  useEffect(() => {
    fetch('/api/coach/recipes/serve-map')
      .then((r) => r.json())
      .then((map) => setServeMap(map && typeof map === 'object' ? map : {}))
  }, [])

  useEffect(() => {
    if (isNew) return
    fetch(`/api/coach/recipes/${recipeId}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name ?? '')
        setCategory(data.category ?? '')
        setInstructions(data.instructions ?? '')
        setIngredients(data.ingredients ?? [])
        setModifications((data.modifications ?? []).map((m: Modification) => ({ tag: m.tag, note: m.note })))
        setLoading(false)
      })
  }, [recipeId, isNew])

  const totals = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      protein: acc.protein + (i.protein || 0),
      carbs: acc.carbs + (i.carbs || 0),
      fat: acc.fat + (i.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
  // Recomputed live from the coach's own food-serves cheat sheet as
  // ingredients are added/removed — not a server round-trip per edit.
  const serveTotals = aggregateServeTotals(ingredients, serveMap)

  function addIngredient(food: MealFood) {
    setIngredients((prev) => [...prev, toIngredient(food)])
  }
  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }
  function addModification() {
    if (!newModNote.trim()) return
    setModifications((prev) => [...prev, { tag: newModTag, note: newModNote.trim() }])
    setNewModNote('')
  }
  function removeModification(idx: number) {
    setModifications((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name required'); return }
    if (!ingredients.length) { setError('Add at least one ingredient'); return }
    setSaving(true)
    setError(null)
    const body = { name, category: category || null, instructions, ingredients, modifications }
    const res = await fetch(isNew ? '/api/coach/recipes' : `/api/coach/recipes/${recipeId}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
    router.push('/coach/recipes')
  }

  if (loading) return <main className="flex-1 p-6"><p className="text-sm text-gray-400">Loading…</p></main>

  return (
    <main className="flex-1 p-6 space-y-6 w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Recipe' : 'Edit Recipe'}</h1>
        <button onClick={() => router.push('/coach/recipes')} className="text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Protein Oats"
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
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c} className="capitalize">{c[0].toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            placeholder="Cooking steps…"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Ingredients</h2>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs font-semibold text-gray-700">{Math.round(totals.calories)} kcal</span>
            <span className="text-xs text-blue-600">{Math.round(totals.protein)}g P</span>
            <span className="text-xs text-orange-600">{Math.round(totals.carbs)}g C</span>
            <span className="text-xs text-yellow-600">{Math.round(totals.fat)}g F</span>
          </div>
        </div>

        {(serveTotals.protein != null || serveTotals.carb != null || serveTotals.fat != null || serveTotals.fruit != null) && (
          <div className="flex flex-wrap gap-1.5 -mt-2">
            {serveTotals.protein != null && (
              <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">≈{serveTotals.protein.toFixed(1)} protein serves</span>
            )}
            {serveTotals.carb != null && (
              <span className="text-[11px] font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">≈{serveTotals.carb.toFixed(1)} carb serves</span>
            )}
            {serveTotals.fat != null && (
              <span className="text-[11px] font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">≈{serveTotals.fat.toFixed(1)} fat serves</span>
            )}
            {serveTotals.fruit != null && (
              <span className="text-[11px] font-medium text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full">≈{serveTotals.fruit.toFixed(1)} fruit serves</span>
            )}
          </div>
        )}

        {ingredients.length > 0 && (
          <ul className="divide-y divide-gray-50">
            {ingredients.map((i, idx) => {
              const serveCount = computeServeCount(i, serveMap[i.food_name.toLowerCase()])
              return (
                <li key={idx} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{i.food_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {i.grams}g · {Math.round(i.calories)} kcal · {Math.round(i.protein)}g P · {Math.round(i.carbs)}g C · {Math.round(i.fat)}g F
                      {serveCount != null && <span className="ml-1 text-gray-300">· ~{serveCount.toFixed(1)} serves</span>}
                    </p>
                  </div>
                  <button onClick={() => removeIngredient(idx)} className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0">
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <MealPlanFoodSearch onAdd={addIngredient} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Modification notes</h2>
        <p className="text-xs text-gray-400">
          Teach clients how to adjust this recipe for their goal — e.g. &quot;swap 1 egg out for 50g+ of egg whites&quot;.
        </p>

        {modifications.length > 0 && (
          <ul className="divide-y divide-gray-50">
            {modifications.map((m, idx) => (
              <li key={idx} className="flex items-start justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <span className="inline-block text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mb-1">
                    {TAG_LABEL[m.tag] ?? m.tag}
                  </span>
                  <p className="text-sm text-gray-700">{m.note}</p>
                </div>
                <button onClick={() => removeModification(idx)} className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={newModTag}
            onChange={(e) => setNewModTag(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white sm:w-48"
          >
            {TAG_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={newModNote}
            onChange={(e) => setNewModNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModification() } }}
            placeholder="e.g. swap 1 egg out for 50g+ of egg whites"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            onClick={addModification}
            disabled={!newModNote.trim()}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => router.push('/coach/recipes')}
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
  )
}
