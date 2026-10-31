'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyMyCoach } from '@/lib/notifyMyCoach'
import { CATEGORIES, DIET_TAG_LABEL, TIER_TAG_STYLE, DIET_FILTERS, TIER_FILTERS } from '@/lib/recipeTags'

type LibraryRecipe = {
  id: string
  name: string
  category: string | null
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  diet_tags: string[]
  tier_tag: string | null
}

type SavedMealItem = { id: string; meal_id: string; food_name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }
type SavedMeal = { id: string; name: string; meal_items: SavedMealItem[] }

function sumItems(items: { calories: number; protein: number; carbs: number; fat: number }[]) {
  return items.reduce(
    (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

type Props = {
  mealKey: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
  mealLabel: string
  date: string
  canUseSavedMeals: boolean
  onLogged: () => void
  onClose: () => void
}

// Lets a client log a whole recipe or a previously saved meal into today's
// (or whichever date's) log in one tap, instead of re-adding ingredients
// one at a time via FoodSearch. Logs it as a single food_logs row with the
// ingredient breakdown stashed in `notes` — same shape DailyLog already
// parses for scanned meals and SavedMeals (see parseMealIngredients), so
// it renders/expands identically regardless of source.
export default function AddRecipeModal({ mealKey, mealLabel, date, canUseSavedMeals, onLogged, onClose }: Props) {
  const [tab, setTab] = useState<'library' | 'saved'>('library')
  const [recipes, setRecipes] = useState<LibraryRecipe[]>([])
  const [loadingRecipes, setLoadingRecipes] = useState(true)
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [dietFilter, setDietFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [logging, setLogging] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/client/recipes')
      .then((r) => r.json())
      .then((data) => { setRecipes(Array.isArray(data) ? data : []); setLoadingRecipes(false) })
      .catch(() => setLoadingRecipes(false))
  }, [])

  useEffect(() => {
    if (!canUseSavedMeals) { setLoadingSaved(false); return }
    ;(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingSaved(false); return }
      const { data: mealsData } = await supabase.from('meals').select('id, name').eq('user_id', session.user.id).order('created_at', { ascending: false })
      if (!mealsData || mealsData.length === 0) { setSavedMeals([]); setLoadingSaved(false); return }
      const mealIds = mealsData.map((m) => m.id)
      const { data: itemsData } = await supabase.from('meal_items').select('id, meal_id, food_name, grams, calories, protein, carbs, fat').in('meal_id', mealIds)
      const byMeal: Record<string, SavedMealItem[]> = {}
      for (const item of itemsData ?? []) (byMeal[item.meal_id] ??= []).push(item)
      setSavedMeals(mealsData.map((m) => ({ ...m, meal_items: byMeal[m.id] ?? [] })))
      setLoadingSaved(false)
    })()
  }, [canUseSavedMeals])

  const filteredRecipes = recipes.filter((r) => {
    if (category && r.category !== category) return false
    if (dietFilter && !r.diet_tags?.includes(dietFilter)) return false
    if (tierFilter && r.tier_tag !== tierFilter) return false
    if (query && !r.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })
  const filteredSaved = savedMeals.filter((m) => !query.trim() || m.name.toLowerCase().includes(query.trim().toLowerCase()))

  async function logEntry(name: string, ingredients: { food_name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }[], key: string) {
    setLogging(key)
    setError(null)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLogging(null); return }
    const t = sumItems(ingredients)
    const { error: insertError } = await supabase.from('food_logs').insert({
      user_id: session.user.id,
      food_name: name,
      calories: Math.round(t.calories),
      protein: Math.round(t.protein * 10) / 10,
      carbs: Math.round(t.carbs * 10) / 10,
      fat: Math.round(t.fat * 10) / 10,
      meal_type: mealKey,
      log_date: date,
      notes: JSON.stringify(ingredients.map((i) => ({ name: i.food_name, grams: i.grams, calories: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat }))),
    })
    setLogging(null)
    if (insertError) { setError(insertError.message); return }
    notifyMyCoach('food')
    onLogged()
    onClose()
  }

  async function pickRecipe(recipe: LibraryRecipe) {
    setLogging(recipe.id)
    setError(null)
    const res = await fetch(`/api/client/recipes/${recipe.id}`)
    const detail = await res.json()
    if (!res.ok) { setError('Failed to load recipe'); setLogging(null); return }
    const ingredients = Array.isArray(detail.ingredients) ? detail.ingredients : []
    if (ingredients.length === 0) { setError('This recipe has no ingredients yet.'); setLogging(null); return }
    await logEntry(recipe.name, ingredients, recipe.id)
  }

  async function pickSavedMeal(meal: SavedMeal) {
    if (meal.meal_items.length === 0) { setError('This meal has no food items.'); return }
    await logEntry(meal.name, meal.meal_items, meal.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Add Recipe to {mealLabel}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {canUseSavedMeals && (
          <div className="flex gap-1 px-5 pt-3">
            {(['library', 'saved'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t === 'library' ? 'My Library' : 'Saved Meals'}
              </button>
            ))}
          </div>
        )}

        <div className="p-5 pb-3 flex flex-col gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'library' ? 'Search recipes…' : 'Search saved meals…'}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />

          {tab === 'library' && (
            <>
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
                <select value={dietFilter} onChange={(e) => setDietFilter(e.target.value)} className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white text-gray-600">
                  {DIET_FILTERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white text-gray-600">
                  {TIER_FILTERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5">
          {tab === 'library' ? (
            loadingRecipes ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
            ) : filteredRecipes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {recipes.length === 0 ? 'No recipes in your library yet.' : 'No recipes match these filters.'}
              </p>
            ) : (
              <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {filteredRecipes.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => pickRecipe(r)}
                      disabled={logging === r.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors disabled:opacity-50"
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
            )
          ) : loadingSaved ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
          ) : filteredSaved.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {savedMeals.length === 0 ? 'No saved meals yet.' : 'No meals match your search.'}
            </p>
          ) : (
            <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {filteredSaved.map((m) => {
                const t = sumItems(m.meal_items)
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => pickSavedMeal(m)}
                      disabled={logging === m.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      <p className="text-sm font-medium text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {Math.round(t.calories)} kcal · {Math.round(t.protein)}g P · {Math.round(t.carbs)}g C · {Math.round(t.fat)}g F
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
