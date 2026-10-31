'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notifyMyCoach } from '@/lib/notifyMyCoach'
import { Card } from '@/components/ui/card'

type RecipeListItem = {
  id: string
  name: string
  category: string | null
  servings: number | null
  total_grams: number
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
}

type Ingredient = { food_name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }
type RecipeDetail = { ingredients: Ingredient[]; instructions: string | null }

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
] as const

export default function MyRecipes() {
  const router = useRouter()
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, RecipeDetail>>({})
  const [mode, setMode] = useState<Record<string, 'servings' | 'grams'>>({})
  const [qty, setQty] = useState<Record<string, string>>({})
  const [picking, setPicking] = useState<string | null>(null)
  const [logging, setLogging] = useState<string | null>(null)
  const [loggedId, setLoggedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [logError, setLogError] = useState<string | null>(null)

  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/client/my-recipes')
    const data = await res.json()
    setRecipes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  async function toggleExpand(recipe: RecipeListItem) {
    if (expanded === recipe.id) { setExpanded(null); return }
    setExpanded(recipe.id)
    setMode((prev) => ({ ...prev, [recipe.id]: prev[recipe.id] ?? (recipe.servings ? 'servings' : 'grams') }))
    setQty((prev) => ({ ...prev, [recipe.id]: prev[recipe.id] ?? (recipe.servings ? '1' : String(Math.round(recipe.total_grams))) }))
    if (!detail[recipe.id]) {
      const res = await fetch(`/api/client/my-recipes/${recipe.id}`)
      const data = await res.json()
      setDetail((prev) => ({ ...prev, [recipe.id]: { ingredients: data.ingredients ?? [], instructions: data.instructions ?? null } }))
    }
  }

  async function deleteRecipe(id: string) {
    setDeletingId(id)
    await fetch(`/api/client/my-recipes/${id}`, { method: 'DELETE' })
    setRecipes((prev) => prev.filter((r) => r.id !== id))
    setConfirmDeleteId(null)
    setDeletingId(null)
  }

  async function logRecipe(recipe: RecipeListItem, mealType: string) {
    setLogging(recipe.id)
    setPicking(null)
    setLogError(null)

    const ingredients = detail[recipe.id]?.ingredients ?? []
    const recipeMode = mode[recipe.id] ?? (recipe.servings ? 'servings' : 'grams')
    const qtyVal = Number(qty[recipe.id])

    if (!qtyVal || qtyVal <= 0) {
      setLogError('Enter a quantity')
      setLogging(null)
      return
    }

    const ratio = recipeMode === 'servings'
      ? (recipe.servings ? qtyVal / recipe.servings : 1)
      : (recipe.total_grams > 0 ? qtyVal / recipe.total_grams : 1)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLogging(null); return }

    const today = new Date()
    const log_date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')

    const scaledIngredients = ingredients.map((i) => ({
      name: i.food_name,
      grams: Math.round(i.grams * ratio),
      calories: Math.round(i.calories * ratio),
      protein: Math.round(i.protein * ratio * 10) / 10,
      carbs: Math.round(i.carbs * ratio * 10) / 10,
      fat: Math.round(i.fat * ratio * 10) / 10,
    }))

    const label = recipeMode === 'servings' && recipe.servings
      ? `${recipe.name} (${qtyVal} of ${recipe.servings})`
      : recipe.name

    const { error } = await supabase.from('food_logs').insert({
      user_id: session.user.id,
      food_name: label,
      calories: Math.round(recipe.total_calories * ratio),
      protein: Math.round(recipe.total_protein * ratio * 10) / 10,
      carbs: Math.round(recipe.total_carbs * ratio * 10) / 10,
      fat: Math.round(recipe.total_fat * ratio * 10) / 10,
      meal_type: mealType,
      log_date,
      notes: JSON.stringify(scaledIngredients),
    })

    setLogging(null)

    if (error) {
      setLogError(error.message)
      return
    }

    setLoggedId(recipe.id)
    setTimeout(() => setLoggedId(null), 2500)
    notifyMyCoach('food')
    window.dispatchEvent(new CustomEvent('meal-logged'))
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading recipes...
      </div>
    )
  }

  const filtered = search.trim()
    ? recipes.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : recipes

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your recipes..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => router.push('/recipes/mine/new')}
          className="flex-shrink-0 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors"
        >
          + New
        </button>
      </div>

      {recipes.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-sm font-medium text-gray-400">No recipes yet</p>
          <p className="text-xs text-gray-300 mt-1">
            Build a batch recipe (e.g. a bolognese) and reuse it as an ingredient in other meals, or log it on its own.
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No recipes match &ldquo;{search}&rdquo;</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const isExpanded = expanded === r.id
            const isConfirmingDelete = confirmDeleteId === r.id
            const isPicking = picking === r.id
            const d = detail[r.id]

            return (
              <Card key={r.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-2 px-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                  onClick={() => toggleExpand(r)}
                >
                  <svg
                    className={`h-4 w-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate text-sm">
                      {r.name}
                      {r.category && <span className="ml-1.5 text-xs font-normal text-gray-400 capitalize">{r.category}</span>}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs font-medium text-gray-500">{Math.round(r.total_calories)} kcal</span>
                      <span className="text-xs text-macro-p">P {Math.round(r.total_protein)}g</span>
                      <span className="text-xs text-macro-c">C {Math.round(r.total_carbs)}g</span>
                      <span className="text-xs text-macro-f">F {Math.round(r.total_fat)}g</span>
                      {r.servings && <span className="text-xs text-gray-400">· makes {r.servings}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isConfirmingDelete ? (
                      <>
                        <button
                          onClick={() => deleteRecipe(r.id)}
                          disabled={deletingId === r.id}
                          className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deletingId === r.id ? '...' : 'Delete'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg transition-colors">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => router.push(`/recipes/mine/${r.id}`)}
                          className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50"
                          title="Edit recipe"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                          title="Delete recipe"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 01-1-1V5a1 1 0 011-1h8a1 1 0 011 1v1a1 1 0 01-1 1H6z" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-50">
                    {!d ? (
                      <p className="text-xs text-gray-400 px-4 py-3">Loading…</p>
                    ) : (
                      <>
                        {d.instructions && (
                          <div className="px-4 py-3 border-b border-gray-50">
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">How to make it</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.instructions}</p>
                          </div>
                        )}
                        {d.ingredients.map((item, idx) => (
                          <div key={idx} className={`flex items-center justify-between px-4 py-2 text-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <p className="font-medium text-gray-800">{item.food_name}</p>
                            <span className="text-xs text-gray-400">{item.grams}g · {Math.round(item.calories)} kcal</span>
                          </div>
                        ))}

                        <div className="border-t border-blue-100 bg-blue-50 px-3 py-3 space-y-2.5">
                          <div className="flex items-center gap-2">
                            {r.servings && (
                              <div className="flex rounded-lg border border-blue-200 overflow-hidden flex-shrink-0">
                                {(['servings', 'grams'] as const).map((m) => (
                                  <button
                                    key={m}
                                    onClick={() => setMode((prev) => ({ ...prev, [r.id]: m }))}
                                    className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                      (mode[r.id] ?? 'servings') === m ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-100'
                                    }`}
                                  >
                                    {m === 'servings' ? 'Servings' : 'Grams'}
                                  </button>
                                ))}
                              </div>
                            )}
                            <input
                              type="number"
                              min="0"
                              step={(mode[r.id] ?? (r.servings ? 'servings' : 'grams')) === 'servings' ? '0.5' : '1'}
                              value={qty[r.id] ?? ''}
                              onChange={(e) => setQty((prev) => ({ ...prev, [r.id]: e.target.value }))}
                              className="flex-1 min-w-0 rounded-lg border border-blue-200 px-2.5 py-1.5 text-sm bg-white"
                            />
                            <span className="text-xs text-blue-700 flex-shrink-0">
                              {(mode[r.id] ?? (r.servings ? 'servings' : 'grams')) === 'servings'
                                ? `of ${r.servings}`
                                : 'g'}
                            </span>
                          </div>

                          {logError && <p className="text-xs text-red-600">{logError}</p>}

                          {loggedId === r.id ? (
                            <span className="inline-block text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-lg">✓ Logged</span>
                          ) : logging === r.id ? (
                            <span className="text-xs text-gray-400 px-2 py-1">Logging…</span>
                          ) : isPicking ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-blue-700 mr-1">Add to:</span>
                              {MEAL_TYPES.map((mt) => (
                                <button
                                  key={mt.key}
                                  onClick={() => logRecipe(r, mt.key)}
                                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                                >
                                  {mt.label}
                                </button>
                              ))}
                              <button onClick={() => setPicking(null)} className="text-xs text-blue-400 hover:text-blue-600 px-2 py-1">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setPicking(r.id)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                              Log it
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
