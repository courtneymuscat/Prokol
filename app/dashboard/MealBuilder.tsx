'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MealFoodRow, { type RowData } from './MealFoodRow'

type MealItem = RowData & { id: string }

function emptyItem(): MealItem {
  return { id: crypto.randomUUID(), food: null, grams: 100, calories: 0, protein: 0, carbs: 0, fat: 0 }
}

export default function MealBuilder({ onSaved }: { onSaved: () => void }) {
  const [mealName, setMealName] = useState('')
  const [items, setItems] = useState<MealItem[]>([emptyItem()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const hasMacros = items.some((i) => i.calories > 0)

  async function handleSave() {
    if (!mealName.trim()) { setError('Give your meal a name'); return }
    const validItems = items.filter((i) => i.food !== null)
    if (validItems.length === 0) { setError('Add at least one food'); return }

    setError(null)
    setSaving(true)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not authenticated'); setSaving(false); return }

    const { data: meal, error: mealErr } = await supabase
      .from('meals')
      .insert({ user_id: session.user.id, name: mealName.trim() })
      .select('id')
      .single()

    if (mealErr || !meal) { setError(mealErr?.message ?? 'Failed to save'); setSaving(false); return }

    const { error: itemsErr } = await supabase.from('meal_items').insert(
      validItems.map((item) => ({
        meal_id: meal.id,
        food_id: item.food!.id,
        food_name: item.food!.name,
        grams: item.grams,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      }))
    )

    if (itemsErr) { setError(itemsErr.message); setSaving(false); return }

    setSuccess(true)
    setMealName('')
    setItems([emptyItem()])
    setSaving(false)
    onSaved()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="bg-white rounded-xl border p-6 space-y-5">
      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Meal Name
        </label>
        <input
          type="text"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          placeholder="e.g. Pre-workout breakfast"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
      </div>

      {/* Food rows */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Foods
        </label>
        {items.map((item) => (
          <MealFoodRow
            key={item.id}
            onChange={(data) =>
              setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...data } : i)))
            }
            onRemove={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
          />
        ))}
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
          className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          + Add Food
        </button>
      </div>

      {/* Running totals */}
      {hasMacros && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Meal Totals</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Calories', value: Math.round(totals.calories), unit: 'kcal', color: 'text-gray-900' },
              { label: 'Protein', value: Math.round(totals.protein * 10) / 10, unit: 'g', color: 'text-macro-p' },
              { label: 'Carbs', value: Math.round(totals.carbs * 10) / 10, unit: 'g', color: 'text-macro-c' },
              { label: 'Fat', value: Math.round(totals.fat * 10) / 10, unit: 'g', color: 'text-macro-f' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="bg-white rounded-lg py-2 px-1">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-400">{unit}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">Meal saved!</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Meal'}
      </button>
    </div>
  )
}
