'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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

type MyRecipeItem = {
  id: string
  name: string
  category: string | null
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
}

type SavedMealItem = { food_name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }
type SavedMeal = { id: string; name: string; meal_items: SavedMealItem[] }

function sumItems(items: { calories: number; protein: number; carbs: number; fat: number }[]) {
  return items.reduce(
    (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

type Props = {
  source: 'library' | 'saved' | 'mine'
  mealKey: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
  date: string
  onLogged: () => void
}

// Lets a client log a whole coach recipe, one of their own My Recipes, or a
// saved meal into this meal in one tap, straight from the Add Food panel —
// alongside searching the food database for individual foods. Logged as a
// single food_logs row with the ingredient breakdown in `notes`, same shape
// DailyLog already parses for scanned meals and SavedMeals (see
// parseMealIngredients).
export default function InlineRecipeOrMealPicker({ source, mealKey, date, onLogged }: Props) {
  const [recipes, setRecipes] = useState<LibraryRecipe[]>([])
  const [myRecipes, setMyRecipes] = useState<MyRecipeItem[]>([])
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [dietFilter, setDietFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [logging, setLogging] = useState<string | null>(null)
  const [loggedId, setLoggedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    if (source === 'library') {
      fetch('/api/client/recipes')
        .then((r) => r.json())
        .then((data) => { setRecipes(Array.isArray(data) ? data : []); setLoading(false) })
        .catch(() => setLoading(false))
    } else if (source === 'mine') {
      fetch('/api/client/my-recipes')
        .then((r) => r.json())
        .then((data) => { setMyRecipes(Array.isArray(data) ? data : []); setLoading(false) })
        .catch(() => setLoading(false))
    } else {
      ;(async () => {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }
        const { data: mealsData } = await supabase.from('meals').select('id, name').eq('user_id', session.user.id).order('created_at', { ascending: false })
        if (!mealsData || mealsData.length === 0) { setSavedMeals([]); setLoading(false); return }
        const mealIds = mealsData.map((m) => m.id)
        const { data: itemsData } = await supabase.from('meal_items').select('meal_id, food_name, grams, calories, protein, carbs, fat').in('meal_id', mealIds)
        const byMeal: Record<string, SavedMealItem[]> = {}
        for (const item of itemsData ?? []) (byMeal[item.meal_id] ??= []).push(item)
        setSavedMeals(mealsData.map((m) => ({ ...m, meal_items: byMeal[m.id] ?? [] })))
        setLoading(false)
      })()
    }
  }, [source])

  const filteredRecipes = recipes.filter((r) => {
    if (category && r.category !== category) return false
    if (dietFilter && !r.diet_tags?.includes(dietFilter)) return false
    if (tierFilter && r.tier_tag !== tierFilter) return false
    if (query && !r.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })
  const filteredMyRecipes = myRecipes.filter((r) => {
    if (category && r.category !== category) return false
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
    setLoggedId(key)
    setTimeout(() => setLoggedId(null), 2000)
    notifyMyCoach('food')
    onLogged()
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

  async function pickMyRecipe(recipe: MyRecipeItem) {
    setLogging(recipe.id)
    setError(null)
    const res = await fetch(`/api/client/my-recipes/${recipe.id}`)
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

  const placeholder = source === 'library' ? 'Search recipes…' : source === 'mine' ? 'Search my recipes…' : 'Search my meals…'
  const buildHref = source === 'saved' ? '/recipes?tab=saved' : '/recipes/mine/new'
  const buildLabel = source === 'saved' ? 'Meal' : 'Recipe'

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />

      <Link
        href={buildHref}
        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        Don&apos;t see it? Build a {buildLabel} →
      </Link>

      {(source === 'library' || source === 'mine') && (
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
      )}

      {source === 'library' && (
        <div className="flex flex-wrap gap-2">
          <select value={dietFilter} onChange={(e) => setDietFilter(e.target.value)} className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white text-gray-600">
            {DIET_FILTERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white text-gray-600">
            {TIER_FILTERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
        ) : source === 'library' ? (
          filteredRecipes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800">{r.name}</p>
                      {loggedId === r.id && <span className="text-xs font-semibold text-green-600 flex-shrink-0">✓ Logged</span>}
                    </div>
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
        ) : source === 'mine' ? (
          filteredMyRecipes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {myRecipes.length === 0 ? 'No recipes built yet.' : 'No recipes match these filters.'}
            </p>
          ) : (
            <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {filteredMyRecipes.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => pickMyRecipe(r)}
                    disabled={logging === r.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800">{r.name}</p>
                      {loggedId === r.id && <span className="text-xs font-semibold text-green-600 flex-shrink-0">✓ Logged</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.category && <span className="capitalize">{r.category} · </span>}
                      {Math.round(r.total_calories)} kcal · {Math.round(r.total_protein)}g P · {Math.round(r.total_carbs)}g C · {Math.round(r.total_fat)}g F
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : filteredSaved.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {savedMeals.length === 0 ? 'No meals saved yet.' : 'No meals match your search.'}
          </p>
        ) : (
          <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {filteredSaved.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => pickSavedMeal(m)}
                  disabled={logging === m.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800">{m.name}</p>
                    {loggedId === m.id && <span className="text-xs font-semibold text-green-600 flex-shrink-0">✓ Logged</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(() => { const t = sumItems(m.meal_items); return `${Math.round(t.calories)} kcal · ${Math.round(t.protein)}g P · ${Math.round(t.carbs)}g C · ${Math.round(t.fat)}g F` })()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
