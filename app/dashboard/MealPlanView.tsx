'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import LogMealModal, { formatServing } from '@/app/components/LogMealModal'
import { mealMacrosToServes, macrosToServes, VEG_RESERVE_CARB_SERVES } from '@/lib/autoAssignNutrition'
import ServeCalcNote from '@/app/components/ServeCalcNote'
import { CATEGORIES, DIET_TAG_LABEL, TIER_TAG_STYLE, DIET_FILTERS, TIER_FILTERS } from '@/lib/recipeTags'
import { createClient } from '@/lib/supabase/client'

const BarcodeScanner = dynamic(() => import('./BarcodeScanner'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

type MealFood = {
  food_id?: string
  food_name: string
  grams: number
  // When the coach builds the serving in a non-gram unit (piece, cup, tbsp,
  // tsp, oz, ml), serving_qty + unit are persisted alongside grams so the
  // client can see the recipe-style label ("2 pieces (150g)") instead of
  // just the gram total.
  serving_qty?: number
  unit?: string
  calories: number
  protein: number
  carbs: number
  fat: number
  swapped_from?: string
  image_url?: string | null
  coach_note?: string | null
  // Set when this food came from the recipe library — every ingredient
  // line exploded from the same recipe shares the same recipe_id, so
  // consecutive foods with a matching id render grouped under one header
  // instead of as indistinguishable separate lines.
  recipe_id?: string
  recipe_name?: string
  // 'saved_meal' when this group came from the client's own My Meals
  // rather than the coach's recipe library — undefined/'library' for
  // everything swapped in before this distinction existed. Saved meals
  // have no coach-authored instructions/modification notes, so the group
  // card hides the "View notes" affordance for them.
  recipe_source?: 'library' | 'saved_meal'
}

// Consecutive foods sharing a recipe_id (always inserted as a contiguous
// block when a recipe is added to a meal — see RecipePickerModal's
// callers) render grouped under one header instead of as indistinguishable
// separate lines.
export type FoodGroup =
  | { type: 'single'; food: MealFood; index: number }
  | { type: 'recipe'; recipeId: string; recipeName: string; recipeSource: 'library' | 'saved_meal'; items: Array<{ food: MealFood; index: number }> }

export function groupFoodsByRecipe(foods: MealFood[]): FoodGroup[] {
  const groups: FoodGroup[] = []
  let i = 0
  while (i < foods.length) {
    const food = foods[i]
    if (food.recipe_id) {
      const recipeId = food.recipe_id
      const recipeName = food.recipe_name ?? 'Recipe'
      const recipeSource = food.recipe_source ?? 'library'
      const items: Array<{ food: MealFood; index: number }> = []
      while (i < foods.length && foods[i].recipe_id === recipeId) {
        items.push({ food: foods[i], index: i })
        i++
      }
      groups.push({ type: 'recipe', recipeId, recipeName, recipeSource, items })
    } else {
      groups.push({ type: 'single', food, index: i })
      i++
    }
  }
  return groups
}

type MealSlot = {
  id: string
  label: string
  foods: MealFood[]
  notes?: string
  target_calories?: number | null
  target_protein?: number | null
  target_carbs?: number | null
  target_fat?: number | null
}

type ClientMealPlan = {
  id: string
  name: string
  content: MealSlot[]
  start_date: string
  status: string
  notes?: string | null
  show_macros?: boolean
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

// How many grams of a replacement food (at its own calories-per-100g rate)
// match the calories of the food being swapped out. This is the core of
// the "match the calories, not just the weight" swap guidance — swapping
// 100g of one food for 100g of another is rarely calorie-equivalent.
export function matchGramsForCalories(targetCalories: number, caloriesPer100g: number): number | null {
  if (!targetCalories || targetCalories <= 0 || !caloriesPer100g || caloriesPer100g <= 0) return null
  return Math.max(1, Math.round((targetCalories / caloriesPer100g) * 100))
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
  const [scannerOpen, setScannerOpen] = useState(false)
  const [barcodeStatus, setBarcodeStatus] = useState<'idle' | 'looking' | 'not_found'>('idle')
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

  // Grams of the selected replacement that would hit the same calories as
  // the food being swapped out — shown as a hint, and offered as a
  // one-tap "Use this" so the client doesn't have to do the maths.
  const matchedGrams = selected ? matchGramsForCalories(original.calories, selected.calories_per_100g) : null

  async function handleBarcodeScan(code: string) {
    setScannerOpen(false)
    setBarcodeStatus('looking')
    try {
      const res = await fetch(`/api/foods/barcode?code=${encodeURIComponent(code)}`)
      const food: FoodSearchResult | null = await res.json()
      if (food) {
        setQuery('')
        setResults([])
        setSelected(food)
        // Default straight to the calorie-matched amount — the whole point
        // of scanning a replacement is to hit the same calories, not to
        // carry over the original food's weight.
        const matched = matchGramsForCalories(original.calories, food.calories_per_100g)
        setGrams(matched ?? original.grams)
        setBarcodeStatus('idle')
      } else {
        setBarcodeStatus('not_found')
      }
    } catch {
      setBarcodeStatus('not_found')
    }
  }

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

  if (scannerOpen) {
    return (
      <BarcodeScanner
        onScan={handleBarcodeScan}
        onClose={() => setScannerOpen(false)}
      />
    )
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
            <p className="text-xs text-gray-500 mt-0.5">{formatServing(original)} · {original.calories} kcal</p>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Search for replacement</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
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
              <button
                type="button"
                onClick={() => { setBarcodeStatus('idle'); setScannerOpen(true) }}
                title="Scan barcode"
                className="flex-shrink-0 w-11 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 7V5a1 1 0 0 1 1-1h2M4 17v2a1 1 0 0 0 1 1h2m10-14h2a1 1 0 0 1 1 1v2m-3 11h2a1 1 0 0 0 1-1v-2M7 8v8M10 8v8M13 8v8M17 8v8" />
                </svg>
              </button>
            </div>

            {barcodeStatus === 'looking' && (
              <p className="mt-2 text-xs text-gray-400">Looking up barcode…</p>
            )}
            {barcodeStatus === 'not_found' && (
              <p className="mt-2 text-xs text-amber-600">No food found for that barcode — try searching by name instead.</p>
            )}

            {results.length > 0 && (
              <ul className="mt-2 rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100 max-h-48 overflow-y-auto shadow-sm">
                {results.map((food) => (
                  <li key={food.id}>
                    <button
                      onClick={() => { setSelected(food); setQuery(''); setResults([]); setBarcodeStatus('idle') }}
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

          {/* Calorie-matching note — swapping foods isn't like-for-like by
              weight, so help the client hit the same calories as the food
              they're replacing rather than just copying the gram amount. */}
          {selected && matchedGrams != null && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-800 leading-snug">
                {original.food_name} was <strong>{original.calories} kcal</strong>. To match that with {selected.name}, use about <strong>{matchedGrams}g</strong>.
              </p>
              {matchedGrams !== grams && (
                <button
                  type="button"
                  onClick={() => setGrams(matchedGrams)}
                  className="flex-shrink-0 text-xs font-semibold text-amber-700 underline hover:text-amber-900 whitespace-nowrap"
                >
                  Use this
                </button>
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

// Log Meal Modal — extracted to app/components/LogMealModal.tsx so the
// client recipe library (logging a recipe that isn't on today's plan) can
// reuse the exact same food_logs-writing flow.

// ─── Food Row ─────────────────────────────────────────────────────────────────

interface FoodRowProps {
  food: MealFood
  onSwap: () => void
  showMacros: boolean
}

function FoodRow({ food, onSwap, showMacros }: FoodRowProps) {
  const [showDetail, setShowDetail] = useState(false)
  const hasDetail = !!(food.image_url || food.coach_note)

  return (
    <>
      <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{food.food_name}</span>
            {food.swapped_from && (
              <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--nc-primary) 8%, transparent)', color: 'var(--nc-primary)', border: '1px solid color-mix(in srgb, var(--nc-primary) 20%, transparent)' }}>
                ↔ swapped
              </span>
            )}
            {hasDetail && (
              <button
                type="button"
                onClick={() => setShowDetail(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 active:bg-blue-200 transition-colors"
              >
                📸 view info
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {showMacros ? (
              <>
                <span className="text-xs text-gray-400">{formatServing(food)} · {food.calories} kcal</span>
                <MacroPill label="P" value={food.protein} colour="bg-rose-50 text-rose-600" />
                <MacroPill label="C" value={food.carbs} colour="bg-indigo-50 text-indigo-500" />
                <MacroPill label="F" value={food.fat} colour="bg-violet-50 text-violet-500" />
              </>
            ) : (
              <span className="text-xs text-gray-400">{formatServing(food)}</span>
            )}
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

      {/* Product detail modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate pr-4">{food.food_name}</p>
              <button type="button" onClick={() => setShowDetail(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Product image or link */}
              {food.image_url && (() => {
                const isImageUrl = /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(food.image_url!)
                return (
                  <div className="space-y-2">
                    {isImageUrl && (
                      <img
                        src={food.image_url!}
                        alt={food.food_name}
                        className="w-full max-h-48 object-contain rounded-xl bg-gray-50"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <a
                      href={food.image_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 px-4 py-3 bg-blue-50 rounded-xl text-blue-700 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg flex-shrink-0">🔗</span>
                        <p className="text-sm font-semibold truncate">View product</p>
                      </div>
                      <svg className="w-4 h-4 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )
              })()}

              {/* Macros */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'kcal', val: food.calories, color: 'text-gray-800' },
                  { label: 'Protein', val: `${food.protein}g`, color: 'text-rose-600' },
                  { label: 'Carbs', val: `${food.carbs}g`, color: 'text-indigo-500' },
                  { label: 'Fat', val: `${food.fat}g`, color: 'text-violet-500' },
                ].map(m => (
                  <div key={m.label} className="bg-gray-50 rounded-xl p-2 text-center">
                    <p className={`text-sm font-bold ${m.color}`}>{m.val}</p>
                    <p className="text-[10px] text-gray-400">{m.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center">{food.grams}g serving</p>

              {/* Coach note */}
              {food.coach_note && (
                <div className="bg-blue-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Coach note</p>
                  <p className="text-sm text-blue-900 leading-relaxed">{food.coach_note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Recipe Group Card ────────────────────────────────────────────────────────

const MOD_TAG_LABEL: Record<string, string> = {
  protein_up: 'Need more protein',
  protein_down: 'Need less protein',
  carbs_up: 'Need more carbs',
  carbs_down: 'Need less carbs',
  fat_up: 'Need more fat',
  fat_down: 'Need less fat',
  calories_up: 'Need more calories',
  calories_down: 'Need less calories',
  volume_up: 'Need more volume',
  general: 'General',
}

function RecipeGroupCard({
  group,
  showMacros,
  onSwapIngredient,
  onSwapRecipe,
  onViewNotes,
}: {
  group: Extract<FoodGroup, { type: 'recipe' }>
  showMacros: boolean
  onSwapIngredient: (foodIndex: number) => void
  onSwapRecipe: () => void
  onViewNotes: () => void
}) {
  const totals = group.items.reduce(
    (acc, { food }) => ({
      calories: acc.calories + food.calories,
      protein: acc.protein + food.protein,
      carbs: acc.carbs + food.carbs,
      fat: acc.fat + food.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  const isSavedMeal = group.recipeSource === 'saved_meal'

  return (
    <div className="rounded-xl border border-purple-100 bg-purple-50/30 my-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-purple-50 border-b border-purple-100">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-purple-900 truncate">{isSavedMeal ? '🥡' : '🍳'} {group.recipeName}</p>
          {showMacros && (
            <p className="text-xs text-purple-500 mt-0.5">
              {Math.round(totals.calories)} kcal · {Math.round(totals.protein)}g P · {Math.round(totals.carbs)}g C · {Math.round(totals.fat)}g F
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isSavedMeal && (
            <button
              onClick={onViewNotes}
              className="text-xs font-medium text-purple-600 bg-white border border-purple-200 rounded-lg px-2 py-1 hover:bg-purple-100 transition-colors"
              title="View recipe instructions and adjustment notes"
            >
              📖 Recipe
            </button>
          )}
          <button
            onClick={onSwapRecipe}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-purple-100 text-purple-400 hover:text-purple-600 transition-colors text-base"
            title="Swap this recipe for another"
          >
            🔄
          </button>
        </div>
      </div>
      <div className="px-3">
        {group.items.map(({ food, index }) => (
          <FoodRow key={index} food={food} onSwap={() => onSwapIngredient(index)} showMacros={showMacros} />
        ))}
      </div>
    </div>
  )
}

// ─── Recipe Swap Modal (Mode A — swap for a different recipe) ────────────────

type ClientRecipeListItem = {
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

type SavedMealListItem = {
  id: string
  name: string
  meal_items: { calories: number; protein: number; carbs: number; fat: number }[]
}

function sumSavedMeal(items: SavedMealListItem['meal_items']) {
  return items.reduce(
    (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function RecipeSwapModal({
  planId,
  mealIndex,
  recipeId,
  recipeName,
  currentSource,
  originalCalories,
  onClose,
  onSwapped,
}: {
  planId: string
  mealIndex: number
  recipeId: string
  recipeName: string
  currentSource: 'library' | 'saved_meal'
  originalCalories: number
  onClose: () => void
  onSwapped: () => void
}) {
  const [tab, setTab] = useState<'library' | 'saved'>('library')
  const [recipes, setRecipes] = useState<ClientRecipeListItem[]>([])
  const [loadingRecipes, setLoadingRecipes] = useState(true)
  const [savedMeals, setSavedMeals] = useState<SavedMealListItem[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [dietFilter, setDietFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/client/recipes')
      .then((r) => r.json())
      .then((data) => {
        setRecipes(Array.isArray(data) ? data.filter((r: ClientRecipeListItem) => !(currentSource === 'library' && r.id === recipeId)) : [])
        setLoadingRecipes(false)
      })
  }, [recipeId, currentSource])

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingSaved(false); return }
      const { data: mealsData } = await supabase.from('meals').select('id, name').eq('user_id', session.user.id).order('created_at', { ascending: false })
      if (!mealsData || mealsData.length === 0) { setSavedMeals([]); setLoadingSaved(false); return }
      const mealIds = mealsData.map((m) => m.id)
      const { data: itemsData } = await supabase.from('meal_items').select('meal_id, calories, protein, carbs, fat').in('meal_id', mealIds)
      const byMeal: Record<string, SavedMealListItem['meal_items']> = {}
      for (const item of itemsData ?? []) (byMeal[item.meal_id] ??= []).push(item)
      setSavedMeals(
        mealsData
          .filter((m) => !(currentSource === 'saved_meal' && m.id === recipeId))
          .map((m) => ({ ...m, meal_items: byMeal[m.id] ?? [] })),
      )
      setLoadingSaved(false)
    })()
  }, [recipeId, currentSource])

  const filteredRecipes = recipes.filter((r) => {
    if (category && r.category !== category) return false
    if (dietFilter && !r.diet_tags?.includes(dietFilter)) return false
    if (tierFilter && r.tier_tag !== tierFilter) return false
    if (query && !r.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })
  const filteredSaved = savedMeals.filter((m) => !query.trim() || m.name.toLowerCase().includes(query.trim().toLowerCase()))

  async function handlePick(body: { new_recipe_id?: string; new_saved_meal_id?: string }) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/client/meal-plans/${planId}/swap-recipe`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_index: mealIndex, recipe_id: recipeId, ...body }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Swap failed')
      }
      onSwapped()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Swap Recipe</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-4">
          {(['library', 'saved'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'library' ? 'My Library' : 'My Meals'}
            </button>
          ))}
        </div>

        <div className="p-5 pb-3 flex flex-col gap-3">
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">Replacing</p>
            <p className="font-medium text-gray-800">{recipeName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{originalCalories} kcal</p>
          </div>
          <p className="text-xs text-gray-400">
            Picking a replacement will scale it to match the {originalCalories} kcal you&apos;re replacing.
          </p>
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
                {recipes.length === 0 ? 'No other recipes available.' : 'No recipes match these filters.'}
              </p>
            ) : (
              <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {filteredRecipes.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => handlePick({ new_recipe_id: r.id })}
                      disabled={saving}
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
                const t = sumSavedMeal(m.meal_items)
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => handlePick({ new_saved_meal_id: m.id })}
                      disabled={saving}
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

// ─── Recipe Notes Modal (Mode B — guidance, read-only) ───────────────────────

function RecipeNotesModal({
  recipeId,
  recipeName,
  onClose,
}: {
  recipeId: string
  recipeName: string
  onClose: () => void
}) {
  const [modifications, setModifications] = useState<Array<{ tag: string; note: string }> | null>(null)
  const [instructions, setInstructions] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/client/recipes/${recipeId}`)
      .then((r) => r.json())
      .then((data) => {
        setModifications(Array.isArray(data.modifications) ? data.modifications : [])
        setInstructions(typeof data.instructions === 'string' ? data.instructions : null)
        setLoaded(true)
      })
  }, [recipeId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{recipeName}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {!loaded ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          ) : (
            <>
              {instructions && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">How to make it</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{instructions}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Adjusting this meal</p>
                {modifications == null || modifications.length === 0 ? (
                  <p className="text-sm text-gray-400">Your coach hasn&apos;t added any adjustment notes for this recipe yet.</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mb-3">
                      Use the 🔄 swap button on an individual ingredient below to make these changes.
                    </p>
                    <ul className="space-y-3">
                      {modifications.map((m, idx) => (
                        <li key={idx}>
                          <span className="inline-block text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mb-1">
                            {MOD_TAG_LABEL[m.tag] ?? m.tag}
                          </span>
                          <p className="text-sm text-gray-700">{m.note}</p>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
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
  const [logTarget, setLogTarget] = useState<MealSlot | null>(null)
  const [recipeSwapTarget, setRecipeSwapTarget] = useState<{ mealIndex: number; recipeId: string; recipeName: string; recipeSource: 'library' | 'saved_meal'; originalCalories: number } | null>(null)
  const [recipeNotesTarget, setRecipeNotesTarget] = useState<{ recipeId: string; recipeName: string } | null>(null)

  const slotContribution = (slot: MealSlot) => {
    if (slot.foods.length > 0) {
      return slot.foods.reduce(
        (acc, f) => ({
          cal: acc.cal + f.calories,
          p: acc.p + f.protein,
          c: acc.c + f.carbs,
          f: acc.f + f.fat,
        }),
        { cal: 0, p: 0, c: 0, f: 0 }
      )
    }
    return {
      cal: slot.target_calories ?? 0,
      p: slot.target_protein ?? 0,
      c: slot.target_carbs ?? 0,
      f: slot.target_fat ?? 0,
    }
  }
  const dailyTotals = plan.content.reduce(
    (acc, slot) => {
      const s = slotContribution(slot)
      return { cal: acc.cal + s.cal, p: acc.p + s.p, c: acc.c + s.c, f: acc.f + s.f }
    },
    { cal: 0, p: 0, c: 0, f: 0 }
  )
  const totalCalories = dailyTotals.cal
  const totalProtein = dailyTotals.p
  const totalCarbs = dailyTotals.c
  const totalFat = dailyTotals.f

  // The per-meal "Serves" row (below) shows PRESCRIBED macros — an
  // explicit coach-set target for that meal if there is one, otherwise
  // the food sum stands in. This is the same precedence as the per-meal
  // "Target" row immediately above it, and deliberately NOT the same as
  // slotContribution above (which is food-first, falling back to target
  // only when a slot has zero foods) — that one's describing "what's
  // actually in today's plan," this one's describing "what each meal
  // should add up to."
  const slotServeMacros = (slot: MealSlot) => {
    const foodSum = slot.foods.reduce(
      (acc, f) => ({ p: acc.p + f.protein, c: acc.c + f.carbs, f: acc.f + f.fat }),
      { p: 0, c: 0, f: 0 }
    )
    return {
      p: (slot.target_protein ?? 0) > 0 ? slot.target_protein! : foodSum.p,
      c: (slot.target_carbs ?? 0) > 0 ? slot.target_carbs! : foodSum.c,
      f: (slot.target_fat ?? 0) > 0 ? slot.target_fat! : foodSum.f,
    }
  }
  // Protein and fat totals stay the sum of each meal's own (rounded)
  // serve count — perfectly additive, since there's no veg-related
  // adjustment needed for either.
  const { proteinServesSum, fatServesSum } = plan.content.reduce(
    (acc, slot) => {
      const m = slotServeMacros(slot)
      const s = mealMacrosToServes({ proteinG: m.p, carbG: 0, fatG: m.f })
      return { proteinServesSum: acc.proteinServesSum + s.protein_serves, fatServesSum: acc.fatServesSum + s.fat_serves }
    },
    { proteinServesSum: 0, fatServesSum: 0 },
  )
  // Carb total deliberately uses macrosToServes — the same formula as
  // the Serve Guide, which holds back ~38g carbs (~150 kcal) for veg
  // before converting the rest to carb serves. Without that, a client
  // could fully use every carb serve shown AND treat veg as genuinely
  // free on top of it, landing in a real surplus with no warning. Each
  // meal's own carb serves above (mealMacrosToServes) deliberately do
  // NOT reserve this — a whole-day reservation applied per meal zeroes
  // out almost every meal's carb serves, which is a worse problem than
  // the carb total not quite matching the literal sum of its meals. See
  // ServeCalcNote for the explanation shown to the client.
  const carbServes = macrosToServes({ proteinG: 0, carbG: totalCarbs, fatG: 0 }).carb_serves
  const dailyServes = { protein_serves: proteinServesSum, carb_serves: carbServes, fat_serves: fatServesSum }

  const swapFood =
    swapTarget != null
      ? plan.content[swapTarget.mealIndex]?.foods?.[swapTarget.foodIndex]
      : null

  const showMacros = plan.show_macros !== false

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 truncate">{plan.name}</h2>
        <a
          href={`/print/my-meal-plan/${plan.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-100 hover:border-blue-200 bg-blue-50 rounded-lg px-2.5 py-1.5 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download / Print
        </a>
      </div>

      {/* Daily summary bar — hidden when show_macros is off */}
      {showMacros && (
        <div className="rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900">{Math.round(totalCalories)}</span>
            <span className="text-xs text-gray-400">kcal</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-xs text-gray-600 font-medium">{Math.round(totalProtein)}g protein</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-xs text-gray-600 font-medium">{Math.round(totalCarbs)}g carbs</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="text-xs text-gray-600 font-medium">{Math.round(totalFat)}g fat</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap w-full">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Serves</span>
            <span className="text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">P {dailyServes.protein_serves}</span>
            <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">C {dailyServes.carb_serves}</span>
            <span className="text-[11px] font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">F {dailyServes.fat_serves}</span>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Veg ∞ unlimited</span>
            <span className="text-[10px] text-gray-400">
              (≈{VEG_RESERVE_CARB_SERVES} more carb serves held back for veg — that&apos;s why Carbs reads lower than the meals below add up to)
            </span>
          </div>
          <div className="w-full">
            <ServeCalcNote
              proteinG={totalProtein}
              carbG={totalCarbs}
              fatG={totalFat}
              proteinServes={dailyServes.protein_serves}
              carbServes={dailyServes.carb_serves}
              fatServes={dailyServes.fat_serves}
            />
          </div>
          <a href="/cheat-sheet" className="text-[11px] text-blue-500 hover:text-blue-600 underline w-full">
            See your full Cheat Sheet →
          </a>
        </div>
      )}

      {/* Plan-level notes from coach */}
      {plan.notes && (
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'color-mix(in srgb, var(--nc-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--nc-primary) 15%, transparent)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--nc-primary)' }}>Notes from your coach</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{plan.notes}</p>
        </div>
      )}

      {/* Meal slots */}
      {plan.content.map((slot, mealIndex) => {
        const foodSum = slot.foods.reduce(
          (acc, f) => ({
            cal: acc.cal + f.calories,
            p: acc.p + f.protein,
            c: acc.c + f.carbs,
            f: acc.f + f.fat,
          }),
          { cal: 0, p: 0, c: 0, f: 0 }
        )
        const slotCalories = foodSum.cal
        const hasCalTarget = (slot.target_calories ?? 0) > 0
        // Per-meal target row: explicit targets take priority, otherwise the
        // food sum stands in as the prescribed macros for that meal. Same
        // precedence as slotServeMacros above (and literally reuses it) so
        // the serves shown here and the serves summed into the daily total
        // can never disagree.
        const { p: targetP, c: targetC, f: targetF } = slotServeMacros(slot)
        const hasAnyMacro = targetP > 0 || targetC > 0 || targetF > 0
        return (
          <div key={slot.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-800">{slot.label}</span>
              <div className="flex items-center gap-2">
                {showMacros && (
                  <span className="text-xs text-gray-400">
                    {hasCalTarget
                      ? `${Math.round(slotCalories)} / ${slot.target_calories} kcal`
                      : `${Math.round(slotCalories)} kcal`}
                  </span>
                )}
                {slot.foods.length > 0 && (
                  <button
                    onClick={() => setLogTarget(slot)}
                    className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg px-2 py-0.5 transition-colors"
                  >
                    + Log
                  </button>
                )}
              </div>
            </div>
            {showMacros && hasAnyMacro && (() => {
              const slotServes = mealMacrosToServes({ proteinG: targetP, carbG: targetC, fatG: targetF })
              return (
                <div className="px-4 py-2 bg-gray-50/60 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Target</span>
                  <span className="text-[11px] text-rose-500 font-medium">P {Math.round(targetP)}g</span>
                  <span className="text-[11px] text-indigo-500 font-medium">C {Math.round(targetC)}g</span>
                  <span className="text-[11px] text-violet-500 font-medium">F {Math.round(targetF)}g</span>
                  <span className="text-gray-200">·</span>
                  <span className="text-[11px] font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-full">P {slotServes.protein_serves} serves</span>
                  <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full">C {slotServes.carb_serves} serves</span>
                  <span className="text-[11px] font-medium text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded-full">F {slotServes.fat_serves} serves</span>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">Veg ∞ unlimited</span>
                </div>
              )
            })()}
            <div className="px-4 py-1">
              {slot.foods.length === 0 ? (
                <p className="text-xs text-gray-300 italic py-3">No foods in this meal</p>
              ) : (
                groupFoodsByRecipe(slot.foods).map((group) =>
                  group.type === 'single' ? (
                    <FoodRow
                      key={group.index}
                      food={group.food}
                      onSwap={() => setSwapTarget({ mealIndex, foodIndex: group.index })}
                      showMacros={showMacros}
                    />
                  ) : (
                    <RecipeGroupCard
                      key={`${group.recipeId}-${group.items[0].index}`}
                      group={group}
                      showMacros={showMacros}
                      onSwapIngredient={(foodIndex) => setSwapTarget({ mealIndex, foodIndex })}
                      onSwapRecipe={() => {
                        const originalCalories = group.items.reduce((sum, it) => sum + it.food.calories, 0)
                        setRecipeSwapTarget({ mealIndex, recipeId: group.recipeId, recipeName: group.recipeName, recipeSource: group.recipeSource, originalCalories })
                      }}
                      onViewNotes={() => setRecipeNotesTarget({ recipeId: group.recipeId, recipeName: group.recipeName })}
                    />
                  ),
                )
              )}
            </div>
            {slot.notes && (
              <div className="px-4 pb-3">
                <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'color-mix(in srgb, var(--nc-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--nc-primary) 15%, transparent)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--nc-primary)' }}>Notes</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{slot.notes}</p>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Log Meal Modal */}
      {logTarget && (
        <LogMealModal slot={logTarget} onClose={() => setLogTarget(null)} />
      )}

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

      {/* Recipe Swap Modal — Mode A */}
      {recipeSwapTarget && (
        <RecipeSwapModal
          planId={plan.id}
          mealIndex={recipeSwapTarget.mealIndex}
          recipeId={recipeSwapTarget.recipeId}
          recipeName={recipeSwapTarget.recipeName}
          currentSource={recipeSwapTarget.recipeSource}
          originalCalories={recipeSwapTarget.originalCalories}
          onClose={() => setRecipeSwapTarget(null)}
          onSwapped={() => {
            setRecipeSwapTarget(null)
            onPlanRefresh()
          }}
        />
      )}

      {/* Recipe Notes Modal — Mode B */}
      {recipeNotesTarget && (
        <RecipeNotesModal
          recipeId={recipeNotesTarget.recipeId}
          recipeName={recipeNotesTarget.recipeName}
          onClose={() => setRecipeNotesTarget(null)}
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
