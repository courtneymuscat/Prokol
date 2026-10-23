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
}

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

  const fetchRecipes = useCallback(async (cat: string) => {
    setLoading(true)
    const res = await fetch(`/api/coach/recipes${cat ? `?category=${cat}` : ''}`)
    const data = await res.json()
    setRecipes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRecipes(category) }, [category, fetchRecipes])

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

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : recipes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-400">No recipes yet. Create your first one to start building your library.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((r) => (
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
                <button
                  onClick={(e) => { e.stopPropagation(); archiveRecipe(r.id) }}
                  className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0"
                  title="Archive recipe"
                >
                  Archive
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="text-xs font-semibold text-gray-700">{Math.round(r.total_calories)} kcal</span>
                <span className="text-xs text-blue-600">{Math.round(r.total_protein)}g P</span>
                <span className="text-xs text-orange-600">{Math.round(r.total_carbs)}g C</span>
                <span className="text-xs text-yellow-600">{Math.round(r.total_fat)}g F</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
