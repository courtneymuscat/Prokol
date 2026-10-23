'use client'

import { useState, useEffect, useCallback } from 'react'

export type RecipeIngredient = {
  food_id?: string | null
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  link?: string | null
}

export type RecipeDetail = {
  id: string
  name: string
  ingredients: RecipeIngredient[]
}

type RecipeListItem = {
  id: string
  name: string
  category: string | null
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  diet_tags?: string[]
  tier_tag?: string | null
}

const DIET_TAG_LABEL: Record<string, string> = { omnivore: 'Omnivore', vegan: 'Vegan', dairy_free: 'Dairy-free' }

// One colour per tier so they're distinguishable at a glance in a list —
// cool-to-warm progression roughly tracking "lighter" to "biggest".
const TIER_TAG_STYLE: Record<string, { label: string; className: string }> = {
  cal_conscious: { label: 'Cal Conscious', className: 'bg-teal-50 text-teal-700' },
  balanced:      { label: 'Balanced',      className: 'bg-indigo-50 text-indigo-700' },
  bigger:        { label: 'Bigger',        className: 'bg-fuchsia-50 text-fuchsia-700' },
  gainer:        { label: 'Gainer',        className: 'bg-rose-50 text-rose-700' },
}

// Coach-side picker: lists /api/coach/recipes, fetches the full ingredient
// list for whichever one is picked, and hands it back to the caller — the
// caller is responsible for exploding ingredients into however many
// MealFood rows its own editor's type shape needs (the two coach meal-plan
// editors each keep a slightly different local MealFood type).
export default function RecipePickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (recipe: RecipeDetail) => void
}) {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState<string | null>(null)

  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/coach/recipes')
    const data = await res.json()
    setRecipes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  const filtered = recipes.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))

  async function pick(id: string) {
    setPicking(id)
    const res = await fetch(`/api/coach/recipes/${id}`)
    const data = await res.json()
    setPicking(null)
    if (!res.ok) return
    onPick({
      id: data.id,
      name: data.name,
      ingredients: (data.ingredients ?? []).map((i: RecipeIngredient) => ({
        food_id: i.food_id,
        food_name: i.food_name,
        grams: i.grams,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        link: i.link,
      })),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Add a recipe</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-gray-50">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your recipes…"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {recipes.length === 0 ? 'No recipes yet — build some in the Recipes section.' : 'No matches.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => pick(r.id)}
                    disabled={picking === r.id}
                    className="w-full text-left px-5 py-3 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.category && <span className="capitalize">{r.category} · </span>}
                      {Math.round(r.total_calories)} kcal · {Math.round(r.total_protein)}g P · {Math.round(r.total_carbs)}g C · {Math.round(r.total_fat)}g F
                    </p>
                    {((r.diet_tags && r.diet_tags.length > 0) || r.tier_tag) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.tier_tag && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIER_TAG_STYLE[r.tier_tag]?.className ?? 'bg-purple-50 text-purple-700'}`}>
                            {TIER_TAG_STYLE[r.tier_tag]?.label ?? r.tier_tag}
                          </span>
                        )}
                        {(r.diet_tags ?? []).map((t) => (
                          <span key={t} className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            {DIET_TAG_LABEL[t] ?? t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
