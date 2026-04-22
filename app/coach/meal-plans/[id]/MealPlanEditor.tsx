'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import MealPlanFoodSearch from '@/app/components/MealPlanFoodSearch'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  notes?: string
}

type MealPlan = {
  id: string
  name: string
  goal: 'cut' | 'build' | 'maintain'
  total_calories: number
  content: MealSlot[]
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeMacros(content: MealSlot[]) {
  let calories = 0, protein = 0, carbs = 0, fat = 0
  for (const slot of content) {
    for (const food of slot.foods) {
      calories += food.calories
      protein += food.protein
      carbs += food.carbs
      fat += food.fat
    }
  }
  return { calories, protein, carbs, fat }
}

function recomputeFood(food: MealFood & { _calories_per_100g?: number; _protein_per_100g?: number; _carbs_per_100g?: number; _fat_per_100g?: number }): MealFood {
  // Recalculate macros proportionally from stored per-100g values if available
  const factor = food.grams / 100
  if (
    food._calories_per_100g != null &&
    food._protein_per_100g != null &&
    food._carbs_per_100g != null &&
    food._fat_per_100g != null
  ) {
    return {
      ...food,
      calories: Math.round(food._calories_per_100g * factor),
      protein: Math.round(food._protein_per_100g * factor * 10) / 10,
      carbs: Math.round(food._carbs_per_100g * factor * 10) / 10,
      fat: Math.round(food._fat_per_100g * factor * 10) / 10,
    }
  }
  // Fall back to linear scaling from original macros
  return food
}

// ── FoodRow ───────────────────────────────────────────────────────────────────

function FoodRow({
  food,
  onChange,
  onRemove,
}: {
  food: MealFood
  onChange: (updated: MealFood) => void
  onRemove: () => void
}) {
  function handleGramsChange(val: string) {
    const g = parseFloat(val) || 0
    onChange({ ...food, grams: g })
  }

  return (
    <div className="flex items-center gap-2 py-2 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{food.food_name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] bg-orange-50 text-orange-500 font-semibold px-1.5 py-0.5 rounded-full">
            {Math.round(food.calories)} kcal
          </span>
          <span className="text-[11px] bg-purple-50 text-purple-500 font-semibold px-1.5 py-0.5 rounded-full">
            P {food.protein.toFixed(1)}g
          </span>
          <span className="text-[11px] bg-green-50 text-green-500 font-semibold px-1.5 py-0.5 rounded-full">
            C {food.carbs.toFixed(1)}g
          </span>
          <span className="text-[11px] bg-blue-50 text-blue-400 font-semibold px-1.5 py-0.5 rounded-full">
            F {food.fat.toFixed(1)}g
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          type="number"
          value={food.grams}
          min={1}
          onChange={(e) => handleGramsChange(e.target.value)}
          className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400">g</span>
      </div>
      <button
        onClick={onRemove}
        className="text-gray-200 hover:text-red-400 transition-colors ml-1 opacity-0 group-hover:opacity-100"
        title="Remove food"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── MealSlotCard ──────────────────────────────────────────────────────────────

function MealSlotCard({
  slot,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  slot: MealSlot
  index: number
  total: number
  onChange: (updated: MealSlot) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [editingLabel, setEditingLabel] = useState(false)

  const slotMacros = slot.foods.reduce(
    (acc, f) => ({
      cal: acc.cal + f.calories,
      p: acc.p + f.protein,
      c: acc.c + f.carbs,
      f: acc.f + f.fat,
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  )

  function updateFood(i: number, updated: MealFood) {
    const foods = [...slot.foods]
    foods[i] = updated
    onChange({ ...slot, foods })
  }

  function removeFood(i: number) {
    onChange({ ...slot, foods: slot.foods.filter((_, fi) => fi !== i) })
  }

  function addFood(food: MealFood) {
    onChange({ ...slot, foods: [...slot.foods, food] })
  }

  return (
    <div className="bg-white rounded-2xl border p-5">
      {/* Slot header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editingLabel ? (
            <input
              autoFocus
              type="text"
              value={slot.label}
              onChange={(e) => onChange({ ...slot, label: e.target.value })}
              onBlur={() => setEditingLabel(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingLabel(false) }}
              className="text-sm font-semibold text-gray-900 border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <button
              onClick={() => setEditingLabel(true)}
              className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-1.5 group"
              title="Click to rename"
            >
              {slot.label || 'Unnamed meal'}
              <svg className="w-3 h-3 text-gray-300 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Macros summary */}
          <span className="text-[11px] text-gray-400 font-medium mr-1">
            {Math.round(slotMacros.cal)} kcal
          </span>

          {/* Move up/down */}
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-gray-300 hover:text-gray-600 transition-colors disabled:opacity-30 p-0.5"
            title="Move up"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="text-gray-300 hover:text-gray-600 transition-colors disabled:opacity-30 p-0.5"
            title="Move down"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="text-gray-200 hover:text-red-400 transition-colors ml-1 p-0.5"
            title="Delete meal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Foods list */}
      {slot.foods.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3">No foods yet. Search below to add.</p>
      )}
      <div className="divide-y divide-gray-50">
        {slot.foods.map((food, fi) => (
          <FoodRow
            key={fi}
            food={food}
            onChange={(updated) => updateFood(fi, updated)}
            onRemove={() => removeFood(fi)}
          />
        ))}
      </div>

      {/* Macro totals row */}
      {slot.foods.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Total:</span>
          <span className="text-[11px] text-orange-500 font-semibold">{Math.round(slotMacros.cal)} kcal</span>
          <span className="text-[11px] text-purple-500 font-semibold">P {slotMacros.p.toFixed(1)}g</span>
          <span className="text-[11px] text-green-500 font-semibold">C {slotMacros.c.toFixed(1)}g</span>
          <span className="text-[11px] text-blue-400 font-semibold">F {slotMacros.f.toFixed(1)}g</span>
        </div>
      )}

      {/* Notes / recipe */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <textarea
          value={slot.notes ?? ''}
          onChange={(e) => onChange({ ...slot, notes: e.target.value })}
          placeholder="Add recipe notes or prep instructions for your client…"
          rows={2}
          className="w-full text-xs text-gray-600 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-300"
        />
      </div>

      {/* Food search */}
      <MealPlanFoodSearch onAdd={addFood} />
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function MealPlanEditor({ plan: initialPlan }: { plan: MealPlan }) {
  const [plan, setPlan] = useState<MealPlan>({
    ...initialPlan,
    content: Array.isArray(initialPlan.content) ? initialPlan.content : [],
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [editingName, setEditingName] = useState(false)
  const [pushToClients, setPushToClients] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pushToClientsRef = useRef(true)

  const totals = computeMacros(plan.content)

  const scheduleSave = useCallback((updated: MealPlan) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/coach/meal-plans/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updated.name,
          total_calories: Math.round(totals.calories),
          content: updated.content,
          push_to_clients: pushToClientsRef.current,
        }),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setSaveStatus('idle'), 2500)
    }, 1000)
  }, [totals.calories])

  function updatePlan(updated: MealPlan) {
    setPlan(updated)
    scheduleSave(updated)
  }

  function updateContent(content: MealSlot[]) {
    updatePlan({ ...plan, content })
  }

  function updateSlot(index: number, updated: MealSlot) {
    const content = [...plan.content]
    content[index] = updated
    updateContent(content)
  }

  function deleteSlot(index: number) {
    updateContent(plan.content.filter((_, i) => i !== index))
  }

  function moveSlot(from: number, to: number) {
    if (to < 0 || to >= plan.content.length) return
    const content = [...plan.content]
    const [removed] = content.splice(from, 1)
    content.splice(to, 0, removed)
    updateContent(content)
  }

  function addMeal() {
    const newSlot: MealSlot = {
      id: crypto.randomUUID(),
      label: `Meal ${plan.content.length + 1}`,
      foods: [],
    }
    updateContent([...plan.content, newSlot])
  }

  async function saveNow() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    const res = await fetch(`/api/coach/meal-plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: plan.name,
        total_calories: Math.round(totals.calories),
        content: plan.content,
        push_to_clients: pushToClients,
      }),
    })
    setSaveStatus(res.ok ? 'saved' : 'error')
    if (res.ok) setTimeout(() => setSaveStatus('idle'), 2500)
  }

  function togglePushToClients() {
    const next = !pushToClients
    setPushToClients(next)
    pushToClientsRef.current = next
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <a
          href="/coach/meal-plans"
          className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
          title="Back to Meal Plans"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </a>

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {editingName ? (
            <input
              autoFocus
              type="text"
              value={plan.name}
              onChange={(e) => setPlan({ ...plan, name: e.target.value })}
              onBlur={() => { setEditingName(false); scheduleSave(plan) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setEditingName(false); scheduleSave(plan) } }}
              className="text-lg font-bold text-gray-900 border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-1.5 group text-left"
              title="Click to rename"
            >
              {plan.name}
              <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {saveStatus === 'saving' && (
            <span className="text-xs text-gray-400">Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-500">Save failed</span>
          )}
          {saveStatus === 'idle' && (
            <span className="text-xs text-gray-300">Unsaved changes</span>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer select-none" title="When on, saving will also update all clients who have this meal plan assigned">
            <button
              type="button"
              onClick={togglePushToClients}
              className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${pushToClients ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${pushToClients ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-xs text-gray-500 hidden sm:block">Push to clients</span>
          </label>
          <button
            onClick={saveNow}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Macro totals bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</span>
            <span className="text-sm font-bold text-gray-900">{Math.round(totals.calories).toLocaleString()} kcal</span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-3">
            <div>
              <span className="text-xs text-gray-400">Protein </span>
              <span className="text-sm font-semibold text-purple-500">{totals.protein.toFixed(1)}g</span>
            </div>
            <div>
              <span className="text-xs text-gray-400">Carbs </span>
              <span className="text-sm font-semibold text-green-500">{totals.carbs.toFixed(1)}g</span>
            </div>
            <div>
              <span className="text-xs text-gray-400">Fat </span>
              <span className="text-sm font-semibold text-blue-400">{totals.fat.toFixed(1)}g</span>
            </div>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <span className="text-xs text-gray-400">Target </span>
            <span className="text-sm font-semibold text-gray-600">{plan.total_calories.toLocaleString()} kcal</span>
          </div>
          {plan.total_calories > 0 && (
            <div>
              <span className={`text-xs font-semibold ${Math.abs(totals.calories - plan.total_calories) <= 50 ? 'text-green-500' : 'text-orange-500'}`}>
                {totals.calories >= plan.total_calories ? '+' : ''}{Math.round(totals.calories - plan.total_calories)} kcal
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          {/* Calorie target */}
          <div className="bg-white rounded-2xl border p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Calorie target</p>
            <div className="relative w-40">
              <input
                type="number"
                value={plan.total_calories || ''}
                onChange={(e) => {
                  const updated = { ...plan, total_calories: parseInt(e.target.value) || 0 }
                  setPlan(updated)
                  scheduleSave(updated)
                }}
                placeholder="0"
                min={0}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kcal</span>
            </div>
          </div>

          {/* Empty state */}
          {plan.content.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-1">No meals yet</p>
              <p className="text-xs text-gray-400 mb-4">Add your first meal slot to start building this plan.</p>
              <button
                onClick={addMeal}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                + Add Meal
              </button>
            </div>
          )}

          {/* Meal slots */}
          {plan.content.map((slot, i) => (
            <MealSlotCard
              key={slot.id}
              slot={slot}
              index={i}
              total={plan.content.length}
              onChange={(updated) => updateSlot(i, updated)}
              onDelete={() => deleteSlot(i)}
              onMoveUp={() => moveSlot(i, i - 1)}
              onMoveDown={() => moveSlot(i, i + 1)}
            />
          ))}

          {/* Add meal button */}
          {plan.content.length > 0 && (
            <button
              onClick={addMeal}
              className="w-full py-3 rounded-2xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-colors"
            >
              + Add Meal
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
