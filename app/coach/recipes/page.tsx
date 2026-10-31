'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Recipe = {
  id: string
  name: string
  category: string | null
  image_url: string | null
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  diet_tags: string[]
  tier_tag: string | null
  is_global: boolean
  is_mine: boolean
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

const DIET_FILTERS = [
  { value: '', label: 'All diets' },
  { value: 'omnivore', label: 'Omnivore' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'dairy_free', label: 'Dairy-free' },
]
const TIER_FILTERS = [
  { value: '', label: 'All tiers' },
  { value: 'cal_conscious', label: 'Cal Conscious (~400 cals)' },
  { value: 'balanced', label: 'Balanced (~550 cals)' },
  { value: 'bigger', label: 'Bigger (~700 cals)' },
  { value: 'gainer', label: 'Gainer (~850 cals)' },
]

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
]

export default function RecipesPage() {
  const router = useRouter()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [dietFilter, setDietFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')

  const fetchRecipes = useCallback(async (cat: string) => {
    setLoading(true)
    const res = await fetch(`/api/coach/recipes${cat ? `?category=${cat}` : ''}`)
    const data = await res.json()
    setRecipes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRecipes(category) }, [category, fetchRecipes])

  const visibleRecipes = recipes.filter((r) => {
    if (dietFilter && !r.diet_tags?.includes(dietFilter)) return false
    if (tierFilter && r.tier_tag !== tierFilter) return false
    return true
  })

  async function archiveRecipe(id: string) {
    if (!confirm('Archive this recipe? It will be hidden from your library but any meal plan already using it is unaffected.')) return
    await fetch(`/api/coach/recipes/${id}`, { method: 'DELETE' })
    setRecipes((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <main className="flex-1 p-6 space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
          <p className="text-sm text-gray-500 mt-1">Your recipe library — assign these into meal plans.</p>
        </div>
        <button
          onClick={() => router.push('/coach/recipes/new')}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          + New Recipe
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              category === c.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={dietFilter}
          onChange={(e) => setDietFilter(e.target.value)}
          className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white text-gray-600"
        >
          {DIET_FILTERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white text-gray-600"
        >
          {TIER_FILTERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : recipes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-400">No recipes yet. Create your first one to start building your library.</p>
        </div>
      ) : visibleRecipes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-400">No recipes match these filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleRecipes.map((r) => (
            <div
              key={r.id}
              onClick={() => router.push(`/coach/recipes/${r.id}`)}
              className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:shadow-sm transition-shadow flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{r.name}</p>
                  {r.category && <p className="text-xs text-gray-400 capitalize mt-0.5">{r.category}</p>}
                </div>
                {r.is_mine && (
                  <button
                    onClick={(e) => { e.stopPropagation(); archiveRecipe(r.id) }}
                    className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0"
                    title="Archive recipe"
                  >
                    Archive
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="text-xs font-semibold text-gray-700">{Math.round(r.total_calories)} kcal</span>
                <span className="text-xs text-blue-600">{Math.round(r.total_protein)}g P</span>
                <span className="text-xs text-orange-600">{Math.round(r.total_carbs)}g C</span>
                <span className="text-xs text-yellow-600">{Math.round(r.total_fat)}g F</span>
              </div>
              {(r.is_global || (r.diet_tags && r.diet_tags.length > 0) || r.tier_tag) && (
                <div className="flex flex-wrap gap-1.5">
                  {r.is_global && (
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      Platform
                    </span>
                  )}
                  {r.tier_tag && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TIER_TAG_STYLE[r.tier_tag]?.className ?? 'bg-purple-50 text-purple-700'}`}>
                      {TIER_TAG_STYLE[r.tier_tag]?.label ?? r.tier_tag}
                    </span>
                  )}
                  {r.diet_tags?.map((t) => (
                    <span key={t} className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {DIET_TAG_LABEL[t] ?? t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
