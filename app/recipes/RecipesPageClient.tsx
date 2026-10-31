'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import SavedMeals from '@/app/dashboard/SavedMeals'
import MyRecipes from './MyRecipes'
import { CATEGORIES, DIET_TAG_LABEL, TIER_TAG_STYLE, DIET_FILTERS, TIER_FILTERS } from '@/lib/recipeTags'

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
}

export default function RecipesPageClient({ canUseSavedMeals }: { canUseSavedMeals: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<'recipes' | 'mine' | 'saved'>('recipes')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [dietFilter, setDietFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [query, setQuery] = useState('')

  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/client/recipes')
    const data = await res.json()
    setRecipes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  const visibleRecipes = recipes.filter((r) => {
    if (category && r.category !== category) return false
    if (dietFilter && !r.diet_tags?.includes(dietFilter)) return false
    if (tierFilter && r.tier_tag !== tierFilter) return false
    if (query && !r.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white px-6 py-3.5 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-20">
        <a href="/more" className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <span className="text-[15px] font-bold tracking-tight text-gray-900">Recipes</span>
      </nav>

      <main className="max-w-lg mx-auto p-6 space-y-5">
        <div className="flex gap-1">
          {(['recipes', 'mine', 'saved'] as const)
            .filter((t) => t !== 'saved' || canUseSavedMeals)
            .map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t === 'recipes' ? 'Recipes' : t === 'mine' ? 'My Recipes' : 'Saved Meals'}
              </button>
            ))}
        </div>

        {tab === 'mine' ? (
          <MyRecipes />
        ) : tab === 'saved' && canUseSavedMeals ? (
          <SavedMeals refreshKey={0} />
        ) : (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes…"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />

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
              <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
            ) : recipes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed p-8 text-center">
                <p className="text-2xl mb-2">🍽️</p>
                <p className="text-sm font-semibold text-gray-700">No recipes yet</p>
                <p className="text-xs text-gray-400 mt-1">Your coach hasn&apos;t added any recipes to their library yet.</p>
              </div>
            ) : visibleRecipes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No recipes match these filters.</p>
            ) : (
              <div className="space-y-3">
                {visibleRecipes.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => router.push(`/recipes/${r.id}`)}
                    className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900">{r.name}</p>
                      {r.category && <p className="text-xs text-gray-400 capitalize flex-shrink-0">{r.category}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs font-semibold text-gray-700">{Math.round(r.total_calories)} kcal</span>
                      <span className="text-xs text-blue-600">{Math.round(r.total_protein)}g P</span>
                      <span className="text-xs text-orange-600">{Math.round(r.total_carbs)}g C</span>
                      <span className="text-xs text-yellow-600">{Math.round(r.total_fat)}g F</span>
                    </div>
                    {((r.diet_tags && r.diet_tags.length > 0) || r.tier_tag) && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
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
          </>
        )}
      </main>
    </div>
  )
}
