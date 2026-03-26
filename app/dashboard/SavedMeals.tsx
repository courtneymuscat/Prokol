'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'

type MealItem = {
  id: string
  meal_id: string
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

type Meal = {
  id: string
  name: string
  created_at: string
  meal_items: MealItem[]
}

function mealTotals(items: MealItem[]) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

export default function SavedMeals({ refreshKey }: { refreshKey: number }) {
  const router = useRouter()
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logging, setLogging] = useState<string | null>(null)
  const [loggedId, setLoggedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pickingMealFor, setPickingMealFor] = useState<string | null>(null)
  const [logError, setLogError] = useState<string | null>(null)

  const MEAL_TYPES = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'lunch', label: 'Lunch' },
    { key: 'dinner', label: 'Dinner' },
    { key: 'snacks', label: 'Snacks' },
  ] as const

  const fetchMeals = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Fetch meals and items separately to avoid FK dependency
    const { data: mealsData, error: mealsErr } = await supabase
      .from('meals')
      .select('id, name, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (mealsErr) { setFetchError(mealsErr.message); setLoading(false); return }
    if (!mealsData || mealsData.length === 0) { setMeals([]); setLoading(false); return }

    const mealIds = mealsData.map((m) => m.id)
    const { data: itemsData, error: itemsErr } = await supabase
      .from('meal_items')
      .select('id, meal_id, food_name, grams, calories, protein, carbs, fat')
      .in('meal_id', mealIds)

    if (itemsErr) { setFetchError(itemsErr.message); setLoading(false); return }

    const itemsByMeal = (itemsData ?? []).reduce<Record<string, MealItem[]>>((acc, item) => {
      if (!acc[item.meal_id]) acc[item.meal_id] = []
      acc[item.meal_id].push(item)
      return acc
    }, {})

    setMeals(mealsData.map((m) => ({ ...m, meal_items: itemsByMeal[m.id] ?? [] })))
    setFetchError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchMeals()
  }, [fetchMeals, refreshKey])

  async function logMeal(meal: Meal, mealType: string) {
    setLogging(meal.id)
    setPickingMealFor(null)
    setLogError(null)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLogging(null); return }

    if (meal.meal_items.length === 0) {
      setLogError('This meal has no food items — it may need an RLS SELECT policy on meal_items.')
      setLogging(null)
      return
    }

    const today = new Date()
    const log_date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')

    const t = mealTotals(meal.meal_items)
    const { error } = await supabase.from('food_logs').insert({
      user_id: session.user.id,
      food_name: meal.name,
      calories: Math.round(t.calories),
      protein: Math.round(t.protein * 10) / 10,
      carbs: Math.round(t.carbs * 10) / 10,
      fat: Math.round(t.fat * 10) / 10,
      meal_type: mealType,
      log_date,
      notes: JSON.stringify(meal.meal_items.map((item) => ({
        name: item.food_name,
        grams: item.grams,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      }))),
    })

    setLogging(null)

    if (error) {
      setLogError(error.message)
      return
    }

    setLoggedId(meal.id)
    setTimeout(() => setLoggedId(null), 2500)
    // Signal DailyLog to re-fetch
    window.dispatchEvent(new CustomEvent('meal-logged'))
  }

  async function deleteMeal(mealId: string) {
    setDeletingId(mealId)
    const supabase = createClient()
    await supabase.from('meal_items').delete().eq('meal_id', mealId)
    await supabase.from('meals').delete().eq('id', mealId)
    setMeals((prev) => prev.filter((m) => m.id !== mealId))
    setConfirmDeleteId(null)
    setDeletingId(null)
  }

  async function saveEditName(mealId: string) {
    if (!editName.trim()) { setEditingId(null); return }
    const supabase = createClient()
    await supabase.from('meals').update({ name: editName.trim() }).eq('id', mealId)
    setMeals((prev) => prev.map((m) => m.id === mealId ? { ...m, name: editName.trim() } : m))
    setEditingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading meals...
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-sm text-red-700">
        Error loading meals: {fetchError}
      </div>
    )
  }

  if (meals.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-sm font-medium text-gray-400">No saved meals yet</p>
        <p className="text-xs text-gray-300 mt-1">Build your first meal above and save it</p>
      </Card>
    )
  }

  const filtered = search.trim()
    ? meals.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : meals

  const recent = filtered.slice(0, 3)
  const older = filtered.slice(3)

  function MealCard({ meal }: { meal: Meal }) {
    const t = mealTotals(meal.meal_items)
    const isExpanded = expanded === meal.id
    const isEditing = editingId === meal.id
    const isConfirmingDelete = confirmDeleteId === meal.id
    const isPicking = pickingMealFor === meal.id

    return (
      <Card className="overflow-hidden">
        {/* Header row */}
        <div
          className="flex items-center gap-2 px-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors select-none"
          onClick={() => { if (!isEditing) setExpanded(isExpanded ? null : meal.id) }}
        >
          <svg
            className={`h-4 w-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Name */}
          <div className="flex-1 min-w-0" onClick={(e) => isEditing && e.stopPropagation()}>
            {isEditing ? (
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditName(meal.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={() => saveEditName(meal.id)}
                className="w-full border border-blue-300 rounded-lg px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <p className="font-semibold text-gray-900 truncate text-sm">{meal.name}</p>
            )}
            {!isEditing && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                <span className="text-xs font-medium text-gray-500">{Math.round(t.calories)} kcal</span>
                <span className="text-xs text-macro-p">P {Math.round(t.protein * 10) / 10}g</span>
                <span className="text-xs text-macro-c">C {Math.round(t.carbs * 10) / 10}g</span>
                <span className="text-xs text-macro-f">F {Math.round(t.fat * 10) / 10}g</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {isConfirmingDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => deleteMeal(meal.id)}
                  disabled={deletingId === meal.id}
                  className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingId === meal.id ? '...' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {loggedId === meal.id ? (
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-lg">✓ Logged</span>
                ) : logging === meal.id ? (
                  <span className="text-xs text-gray-400 px-2 py-1">...</span>
                ) : isPicking ? (
                  <button
                    type="button"
                    onClick={() => setPickingMealFor(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickingMealFor(meal.id)}
                    className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Log
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setEditingId(meal.id); setEditName(meal.name); setExpanded(null) }}
                  className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50"
                  title="Rename meal"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(meal.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                  title="Delete meal"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 01-1-1V5a1 1 0 011-1h8a1 1 0 011 1v1a1 1 0 01-1 1H6z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Meal type picker */}
        {isPicking && (
          <div className="border-t border-blue-100 bg-blue-50 px-3 py-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-blue-700 mr-1">Add to:</span>
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt.key}
                type="button"
                onClick={() => logMeal(meal, mt.key)}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
              >
                {mt.label}
              </button>
            ))}
          </div>
        )}

        {/* Expanded food list */}
        {isExpanded && (
          <div className="border-t border-gray-50">
            {meal.meal_items.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center justify-between px-4 py-2 text-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
              >
                <div>
                  <p className="font-medium text-gray-800">{item.food_name}</p>
                  <p className="text-xs text-gray-400">{item.grams}g</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-gray-600">{item.calories} kcal</span>
                  <span className="text-macro-p">P {item.protein}g</span>
                  <span className="text-macro-c">C {item.carbs}g</span>
                  <span className="text-macro-f">F {item.fat}g</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</p>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="text-gray-700">{Math.round(t.calories)} kcal</span>
                <span className="text-macro-p">P {Math.round(t.protein * 10) / 10}g</span>
                <span className="text-macro-c">C {Math.round(t.carbs * 10) / 10}g</span>
                <span className="text-macro-f">F {Math.round(t.fat * 10) / 10}g</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search meals..."
          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {logError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{logError}</div>
      )}

      {filtered.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No meals match &ldquo;{search}&rdquo;</p>
      )}

      {/* Recent 3 */}
      <div className="space-y-2">
        {recent.map((meal) => <MealCard key={meal.id} meal={meal} />)}
      </div>

      {/* Older meals — scrollable */}
      {older.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Older</p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
            {older.map((meal) => <MealCard key={meal.id} meal={meal} />)}
          </div>
        </div>
      )}
    </div>
  )
}
