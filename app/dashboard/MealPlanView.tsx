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
  image_url?: string | null
  coach_note?: string | null
}

type MealSlot = {
  id: string
  label: string
  foods: MealFood[]
  notes?: string
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

// ─── Log Meal Modal ───────────────────────────────────────────────────────────

const MEAL_TYPE_OPTIONS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch',     label: 'Lunch' },
  { key: 'dinner',    label: 'Dinner' },
  { key: 'snacks',    label: 'Snacks' },
] as const
type MealTypeKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

function guessMealType(label: string): MealTypeKey {
  const l = label.toLowerCase()
  if (l.includes('breakfast') || l.includes('morning')) return 'breakfast'
  if (l.includes('lunch') || l.includes('midday')) return 'lunch'
  if (l.includes('dinner') || l.includes('evening') || l.includes('night')) return 'dinner'
  if (l.includes('snack') || l.includes('pre') || l.includes('post')) return 'snacks'
  return 'breakfast'
}

function LogMealModal({ slot, onClose }: { slot: MealSlot; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [mealType, setMealType] = useState<MealTypeKey>(guessMealType(slot.label))
  const [date, setDate] = useState(today)
  const [logging, setLogging] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalCal = slot.foods.reduce((s, f) => s + f.calories, 0)
  const totalP   = slot.foods.reduce((s, f) => s + f.protein, 0)
  const totalC   = slot.foods.reduce((s, f) => s + f.carbs, 0)
  const totalF   = slot.foods.reduce((s, f) => s + f.fat, 0)

  async function logMeal() {
    setLogging(true)
    setError(null)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not logged in'); setLogging(false); return }

    const rows = slot.foods.map(f => ({
      user_id: session.user.id,
      food_name: f.food_name,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      meal_type: mealType,
      log_date: date,
      serving_description: `${f.grams}g (meal plan)`,
    }))

    const { error: insertErr } = await supabase.from('food_logs').insert(rows)
    if (insertErr) { setError(insertErr.message); setLogging(false); return }

    window.dispatchEvent(new CustomEvent('meal-logged'))
    setDone(true)
    setLogging(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Log to Food Log</h3>
            <p className="text-xs text-gray-400 mt-0.5">{slot.label}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {done ? (
            <div className="text-center py-3 space-y-2">
              <div className="w-11 h-11 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">Logged {slot.foods.length} item{slot.foods.length !== 1 ? 's' : ''}!</p>
              <p className="text-xs text-gray-400">{Math.round(totalCal)} kcal added to {MEAL_TYPE_OPTIONS.find(o => o.key === mealType)?.label} on {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              <button onClick={onClose} className="w-full mt-2 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">Done</button>
            </div>
          ) : (
            <>
              {/* Foods preview */}
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1 max-h-36 overflow-y-auto">
                {slot.foods.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate mr-2">{f.food_name}</span>
                    <span className="text-gray-400 flex-shrink-0">{f.grams}g · {f.calories} kcal</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 text-xs font-medium text-center">
                <span className="flex-1 bg-gray-100 text-gray-600 rounded-lg py-1">{Math.round(totalCal)} kcal</span>
                <span className="flex-1 bg-rose-50 text-rose-600 rounded-lg py-1">P {totalP.toFixed(1)}g</span>
                <span className="flex-1 bg-indigo-50 text-indigo-500 rounded-lg py-1">C {totalC.toFixed(1)}g</span>
                <span className="flex-1 bg-violet-50 text-violet-500 rounded-lg py-1">F {totalF.toFixed(1)}g</span>
              </div>

              {/* Meal type */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Log as</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {MEAL_TYPE_OPTIONS.map(o => (
                    <button key={o.key} onClick={() => setMealType(o.key)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${mealType === o.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button onClick={logMeal} disabled={logging}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {logging ? 'Logging…' : `Log ${slot.foods.length} item${slot.foods.length !== 1 ? 's' : ''} to Food Log`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

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
              <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: 'rgba(29,158,117,0.08)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.2)' }}>
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
                <span className="text-xs text-gray-400">{food.grams}g · {food.calories} kcal</span>
                <MacroPill label="P" value={food.protein} colour="bg-rose-50 text-rose-600" />
                <MacroPill label="C" value={food.carbs} colour="bg-indigo-50 text-indigo-500" />
                <MacroPill label="F" value={food.fat} colour="bg-violet-50 text-violet-500" />
              </>
            ) : (
              <span className="text-xs text-gray-400">{food.grams}g</span>
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

// ─── Plan View ────────────────────────────────────────────────────────────────

interface PlanViewProps {
  plan: ClientMealPlan
  onPlanRefresh: () => void
}

function PlanView({ plan, onPlanRefresh }: PlanViewProps) {
  const [swapTarget, setSwapTarget] = useState<{ mealIndex: number; foodIndex: number } | null>(null)
  const [logTarget, setLogTarget] = useState<MealSlot | null>(null)

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

  const showMacros = plan.show_macros !== false

  return (
    <div className="flex flex-col gap-4">
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
        </div>
      )}

      {/* Plan-level notes from coach */}
      {plan.notes && (
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(29,158,117,0.06)', border: '1px solid rgba(29,158,117,0.15)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#1D9E75' }}>Notes from your coach</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{plan.notes}</p>
        </div>
      )}

      {/* Meal slots */}
      {plan.content.map((slot, mealIndex) => {
        const slotCalories = slot.foods.reduce((s, f) => s + f.calories, 0)
        return (
          <div key={slot.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-800">{slot.label}</span>
              <div className="flex items-center gap-2">
                {showMacros && <span className="text-xs text-gray-400">{Math.round(slotCalories)} kcal</span>}
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
            <div className="px-4 py-1">
              {slot.foods.length === 0 ? (
                <p className="text-xs text-gray-300 italic py-3">No foods in this meal</p>
              ) : (
                slot.foods.map((food, foodIndex) => (
                  <FoodRow
                    key={foodIndex}
                    food={food}
                    onSwap={() => setSwapTarget({ mealIndex, foodIndex })}
                    showMacros={showMacros}
                  />
                ))
              )}
            </div>
            {slot.notes && (
              <div className="px-4 pb-3">
                <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'rgba(29,158,117,0.06)', border: '1px solid rgba(29,158,117,0.15)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#1D9E75' }}>Notes</p>
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
