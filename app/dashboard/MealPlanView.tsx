'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type MealFood = {
  food_id?: string
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  swapped_from?: string
}

type MealSlot = {
  id: string
  label: string
  foods: MealFood[]
}

type ClientMealPlan = {
  id: string
  name: string
  content: MealSlot[]
  start_date: string
  status: string
}

type FoodSearchResult = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  unit?: string
  custom?: boolean
}

// ─── Macro Pill ───────────────────────────────────────────────────────────────

function MacroPill({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium ${colour}`}>
      <span className="opacity-70">{label}</span>
      <span>{Math.round(value)}g</span>
    </span>
  )
}

// ─── Swap Modal ───────────────────────────────────────────────────────────────

interface SwapModalProps {
  planId: string
  mealIndex: number
  foodIndex: number
  original: MealFood
  onClose: () => void
  onSwapped: () => void
}

function SwapModal({ planId, mealIndex, foodIndex, original, onClose, onSwapped }: SwapModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [selected, setSelected] = useState<FoodSearchResult | null>(null)
  const [grams, setGrams] = useState(original.grams)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const computedFood = selected
    ? {
        food_id: selected.id,
        food_name: selected.name,
        grams,
        calories: Math.round((selected.calories_per_100g / 100) * grams),
        protein: Math.round((selected.protein_per_100g / 100) * grams * 10) / 10,
        carbs: Math.round((selected.carbs_per_100g / 100) * grams * 10) / 10,
        fat: Math.round((selected.fat_per_100g / 100) * grams * 10) / 10,
      }
    : null

  async function handleConfirm() {
    if (!computedFood) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/client/meal-plans/${planId}/swap`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_index: mealIndex,
          food_index: foodIndex,
          new_food: computedFood,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Swap failed')
      }
      onSwapped()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Swap failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Swap Food</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Original food */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">Replacing</p>
            <p className="font-medium text-gray-800">{original.food_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{original.grams}g · {original.calories} kcal</p>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Search for replacement</label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. chicken breast, oats..."
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 bg-white"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {results.length > 0 && (
              <ul className="mt-2 rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100 max-h-48 overflow-y-auto shadow-sm">
                {results.map((food) => (
                  <li key={food.id}>
                    <button
                      onClick={() => { setSelected(food); setQuery(''); setResults([]) }}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800 truncate">{food.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {Math.round(food.calories_per_100g)} kcal · {Math.round(food.protein_per_100g)}g P · {Math.round(food.carbs_per_100g)}g C · {Math.round(food.fat_per_100g)}g F <span className="ml-1 text-gray-300">per 100g</span>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Selected food + grams input */}
          {selected && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex flex-col gap-3">
              <div>
                <p className="text-xs text-blue-500 mb-0.5">Selected</p>
                <p className="font-medium text-blue-900">{selected.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-blue-600 font-medium whitespace-nowrap">Grams</label>
                <input
                  type="number"
                  min={1}
                  value={grams}
                  onChange={(e) => setGrams(Math.max(1, Number(e.target.value)))}
                  className="w-24 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                />
              </div>
              {computedFood && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-blue-700 font-semibold">{computedFood.calories} kcal</span>
                  <MacroPill label="P" value={computedFood.protein} colour="bg-blue-100 text-blue-700" />
                  <MacroPill label="C" value={computedFood.carbs} colour="bg-orange-100 text-orange-700" />
                  <MacroPill label="F" value={computedFood.fat} colour="bg-yellow-100 text-yellow-700" />
                </div>
              )}
            </div>
          )}

          {saveError && (
            <p className="text-sm text-red-500">{saveError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!computedFood || saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Confirm Swap'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Food Row ─────────────────────────────────────────────────────────────────

interface FoodRowProps {
  food: MealFood
  onSwap: () => void
}

function FoodRow({ food, onSwap }: FoodRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800">{food.food_name}</span>
          {food.swapped_from && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
              ↔ swapped
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-gray-400">{food.grams}g · {food.calories} kcal</span>
          <MacroPill label="P" value={food.protein} colour="bg-blue-50 text-blue-600" />
          <MacroPill label="C" value={food.carbs} colour="bg-orange-50 text-orange-600" />
          <MacroPill label="F" value={food.fat} colour="bg-yellow-50 text-yellow-600" />
        </div>
      </div>
      <button
        onClick={onSwap}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-base"
        title="Swap food"
      >
        🔄
      </button>
    </div>
  )
}

// ─── Plan View ────────────────────────────────────────────────────────────────

interface PlanViewProps {
  plan: ClientMealPlan
  onPlanRefresh: () => void
}

function PlanView({ plan, onPlanRefresh }: PlanViewProps) {
  const [swapTarget, setSwapTarget] = useState<{ mealIndex: number; foodIndex: number } | null>(null)

  const totalCalories = plan.content.reduce(
    (sum, slot) => sum + slot.foods.reduce((s, f) => s + f.calories, 0),
    0
  )
  const totalProtein = plan.content.reduce(
    (sum, slot) => sum + slot.foods.reduce((s, f) => s + f.protein, 0),
    0
  )
  const totalCarbs = plan.content.reduce(
    (sum, slot) => sum + slot.foods.reduce((s, f) => s + f.carbs, 0),
    0
  )
  const totalFat = plan.content.reduce(
    (sum, slot) => sum + slot.foods.reduce((s, f) => s + f.fat, 0),
    0
  )

  const swapFood =
    swapTarget != null
      ? plan.content[swapTarget.mealIndex]?.foods?.[swapTarget.foodIndex]
      : null

  return (
    <div className="flex flex-col gap-4">
      {/* Daily summary bar */}
      <div className="rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-gray-900">{Math.round(totalCalories)}</span>
          <span className="text-xs text-gray-400">kcal</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-xs text-gray-600 font-medium">{Math.round(totalProtein)}g protein</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-xs text-gray-600 font-medium">{Math.round(totalCarbs)}g carbs</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-xs text-gray-600 font-medium">{Math.round(totalFat)}g fat</span>
          </div>
        </div>
      </div>

      {/* Meal slots */}
      {plan.content.map((slot, mealIndex) => {
        const slotCalories = slot.foods.reduce((s, f) => s + f.calories, 0)
        return (
          <div key={slot.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-800">{slot.label}</span>
              <span className="text-xs text-gray-400">{Math.round(slotCalories)} kcal</span>
            </div>
            <div className="px-4 py-1">
              {slot.foods.length === 0 ? (
                <p className="text-xs text-gray-300 italic py-3">No foods in this meal</p>
              ) : (
                slot.foods.map((food, foodIndex) => (
                  <FoodRow
                    key={foodIndex}
                    food={food}
                    onSwap={() => setSwapTarget({ mealIndex, foodIndex })}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}

      {/* Swap Modal */}
      {swapTarget != null && swapFood && (
        <SwapModal
          planId={plan.id}
          mealIndex={swapTarget.mealIndex}
          foodIndex={swapTarget.foodIndex}
          original={swapFood}
          onClose={() => setSwapTarget(null)}
          onSwapped={() => {
            setSwapTarget(null)
            onPlanRefresh()
          }}
        />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MealPlanView() {
  const [plans, setPlans] = useState<ClientMealPlan[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client/meal-plans')
      if (!res.ok) throw new Error('Failed to load meal plans')
      const data = await res.json()
      setPlans(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meal plans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-40 bg-gray-100 rounded-full" />
          <div className="h-16 bg-gray-50 rounded-xl" />
          <div className="h-32 bg-gray-50 rounded-xl" />
          <div className="h-32 bg-gray-50 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="text-3xl mb-3">🥗</div>
        <p className="font-semibold text-gray-800 mb-1">No meal plan yet</p>
        <p className="text-sm text-gray-400">Your coach will assign one soon.</p>
      </div>
    )
  }

  const activePlan = plans[activeTab] ?? plans[0]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Meal Plan</h2>

        {/* Tab list — only shown when multiple plans */}
        {plans.length > 1 && (
          <div className="space-y-2.5">
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {plans.map((plan, i) => (
                <button
                  key={plan.id}
                  onClick={() => setActiveTab(i)}
                  className={[
                    'shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    i === activeTab
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {plan.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              You have {plans.length} meal plans — tap the tabs above to switch between them. Plans without an end date are ongoing and will stay here alongside any others (e.g. a training day and a rest day plan).
            </p>
          </div>
        )}
      </div>

      <div className="p-5">
        <PlanView plan={activePlan} onPlanRefresh={fetchPlans} />
      </div>
    </div>
  )
}
