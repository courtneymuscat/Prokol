'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notifyMyCoach } from '@/lib/notifyMyCoach'

// Shared by the meal-plan view (logging a planned slot) and the client
// recipe library (logging an arbitrary recipe that isn't on today's plan)
// — both just need a label + a flat list of foods to write to food_logs.

export type LoggableFood = {
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  serving_qty?: number
  unit?: string
}

export type LoggableSlot = {
  label: string
  foods: LoggableFood[]
}

// Format a food's serving the way it was intended. If a non-gram unit was
// set (piece, cup, tbsp, tsp, oz, ml), show "<qty> <unit> (<grams>g)".
// Otherwise just "<grams>g".
export function formatServing(food: { grams: number; serving_qty?: number; unit?: string }): string {
  const u = food.unit
  const g = food.grams
  if (!u || u === 'g') return `${g}g`
  if (u === 'ml') return `${g}ml`
  const q = food.serving_qty
  if (q == null) return `${g}g`
  const qStr = Number.isInteger(q) ? String(q) : String(q)
  const unitLabel = u === 'piece' ? (q === 1 ? 'piece' : 'pieces') : u
  return `${qStr} ${unitLabel} (${g}g)`
}

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

export default function LogMealModal({ slot, onClose }: { slot: LoggableSlot; onClose: () => void }) {
  const router = useRouter()
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
      // food_logs.calories is an integer column — a non-whole ingredient
      // calorie value (e.g. 240g of something scaled to 142.8 kcal)
      // previously crashed the insert with "invalid input syntax for
      // type integer". Round the same way every other logging path does.
      calories: Math.round(f.calories),
      protein: Math.round(f.protein * 10) / 10,
      carbs: Math.round(f.carbs * 10) / 10,
      fat: Math.round(f.fat * 10) / 10,
      meal_type: mealType,
      log_date: date,
      serving_description: `${f.grams}g (${slot.label})`,
    }))

    const { error: insertErr } = await supabase.from('food_logs').insert(rows)
    if (insertErr) { setError(insertErr.message); setLogging(false); return }

    notifyMyCoach('food')
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
              <button onClick={() => router.push('/log-food')} className="w-full mt-2 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">Go to Food Log →</button>
            </div>
          ) : (
            <>
              {/* Foods preview */}
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1 max-h-36 overflow-y-auto">
                {slot.foods.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate mr-2">{f.food_name}</span>
                    <span className="text-gray-400 flex-shrink-0">{formatServing(f)} · {f.calories} kcal</span>
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
