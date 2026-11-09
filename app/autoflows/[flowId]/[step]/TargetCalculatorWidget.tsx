'use client'

import { useState } from 'react'
import {
  calcTDEE, calcMacros, defaultAdjPct,
  TDEE_GOALS, TDEE_ACTIVITY_OPTIONS,
  type TDEESex, type TDEEGoal, type TDEEActivity, type TDEEActivityType,
} from '@/lib/tdee'

// Same type/options/labels as app/onboarding/page.tsx's dietary preference
// picker — a fresh copy rather than a shared import, same precedent as
// lib/tdee.ts itself (see that file's own comment).
type DietaryPreference = 'none' | 'vegan' | 'dairy_free'
const DIETARY_PREFS: { value: DietaryPreference; label: string }[] = [
  { value: 'none',       label: 'Omnivore (no preference)' },
  { value: 'vegan',      label: 'Vegan' },
  { value: 'dairy_free', label: 'Dairy-free' },
]

type ExistingProfile = {
  first_name?: string | null
  phone?: string | null
  age?: number | null
  sex?: TDEESex | null
  height_cm?: number | null
  weight_kg?: number | null
  steps_per_day?: number | null
  activities?: Array<{ type: TDEEActivityType; duration_minutes: string; sessions_per_week: string }> | null
  goal?: TDEEGoal | null
  adjustment_pct?: number | null
  dietary_preference?: DietaryPreference | null
}

type Result = {
  target_calories: number
  target_protein: number
  target_carbs: number
  target_fat: number
  assigned_plan_name: string | null
}

export type TargetCalcData = {
  note: string | null
  existing_profile: ExistingProfile
  result: Result | null
}

function ResultSummary({ result, note, onRecalculate }: { result: Result; note: string | null; onRecalculate: () => void }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Your daily targets</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-emerald-900">{result.target_calories}</p>
          <p className="text-[10px] text-emerald-700 uppercase tracking-wide">Cals</p>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-900">{result.target_protein}g</p>
          <p className="text-[10px] text-emerald-700 uppercase tracking-wide">Protein</p>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-900">{result.target_carbs}g</p>
          <p className="text-[10px] text-emerald-700 uppercase tracking-wide">Carbs</p>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-900">{result.target_fat}g</p>
          <p className="text-[10px] text-emerald-700 uppercase tracking-wide">Fat</p>
        </div>
      </div>
      {result.assigned_plan_name && (
        <p className="text-xs text-emerald-800">
          We&apos;ve set you up with <strong>{result.assigned_plan_name}</strong> as a starting meal plan — find it on your dashboard.
        </p>
      )}
      {note && <p className="text-xs text-emerald-800 leading-relaxed">{note}</p>}
      <button
        onClick={onRecalculate}
        className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-900"
      >
        Recalculate
      </button>
    </div>
  )
}

export default function TargetCalculatorWidget({
  flowId,
  step,
  data,
  onResult,
}: {
  flowId: string
  step: string
  data: TargetCalcData
  onResult: (result: Result) => void
}) {
  const [editing, setEditing] = useState(!data.result)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(data.result)

  const p = data.existing_profile
  const [firstName, setFirstName] = useState(p.first_name ?? '')
  const [phone, setPhone] = useState(p.phone ?? '')
  const [sex, setSex] = useState<TDEESex | ''>(p.sex ?? '')
  const [age, setAge] = useState(p.age != null ? String(p.age) : '')
  const [heightCm, setHeightCm] = useState(p.height_cm != null ? String(p.height_cm) : '')
  const [weightKg, setWeightKg] = useState(p.weight_kg != null ? String(p.weight_kg) : '')
  const [stepsPerDay, setStepsPerDay] = useState(p.steps_per_day != null ? String(p.steps_per_day) : '8000')
  const [activities, setActivities] = useState<(TDEEActivity & { id: string })[]>(
    Array.isArray(p.activities) ? p.activities.map(a => ({ ...a, id: crypto.randomUUID() })) : []
  )
  const [goal, setGoal] = useState<TDEEGoal | ''>(p.goal ?? '')
  const [adjustmentPct, setAdjustmentPct] = useState(p.adjustment_pct ?? defaultAdjPct(p.goal ?? null))
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>(p.dietary_preference ?? 'none')

  function addActivity() {
    setActivities(prev => [...prev, { id: crypto.randomUUID(), type: 'strength', duration_minutes: '45', sessions_per_week: '3' }])
  }
  function updateActivity(id: string, patch: Partial<TDEEActivity>) {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }
  function removeActivity(id: string) {
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  const statsComplete = firstName.trim() && phone.trim() && age && sex && heightCm && weightKg && goal
  const tdeeResult = statsComplete
    ? calcTDEE(parseFloat(age), sex as TDEESex, parseFloat(heightCm), parseFloat(weightKg), activities, parseFloat(stepsPerDay) || 0)
    : null
  const macros = tdeeResult && goal
    ? calcMacros(tdeeResult.tdee, parseFloat(weightKg), goal as TDEEGoal, adjustmentPct)
    : null

  async function submit() {
    if (!tdeeResult || !macros || !goal) return
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/client/autoflows/${flowId}/${step}/calculate-targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName.trim(),
        phone: phone.trim(),
        age: parseFloat(age),
        sex,
        height_cm: parseFloat(heightCm),
        weight_kg: parseFloat(weightKg),
        steps_per_day: parseFloat(stepsPerDay) || 0,
        activities: activities.map(({ id: _id, ...a }) => a),
        goal,
        adjustment_pct: adjustmentPct,
        dietary_preference: dietaryPreference,
        tdee: tdeeResult.tdee,
        target_calories: macros.targetCals,
        target_protein: macros.proteinG,
        target_carbs: macros.carbG,
        target_fat: macros.fatG,
      }),
    })
    setSubmitting(false)
    if (res.ok) {
      const d = await res.json()
      setResult(d.result)
      setEditing(false)
      onResult(d.result)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to calculate targets.')
    }
  }

  if (!editing && result) {
    return <ResultSummary result={result} note={data.note} onRecalculate={() => setEditing(true)} />
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calculate your targets</p>
        <p className="text-xs text-gray-500 mt-0.5">A few details so we can work out your daily calories and macros.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Your name</label>
          <input
            type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Phone number</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="0412 345 678"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Sex</label>
          <div className="flex gap-2">
            {(['female', 'male'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSex(s)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors capitalize ${sex === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Age</label>
          <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Height (cm)</label>
          <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Weight (kg)</label>
          <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] text-gray-500 mb-1">Average daily steps</label>
          <input type="number" value={stepsPerDay} onChange={e => setStepsPerDay(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Goal</label>
        <select
          value={goal}
          onChange={e => {
            const g = e.target.value as TDEEGoal
            setGoal(g)
            setAdjustmentPct(defaultAdjPct(g))
          }}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
        >
          <option value="">Choose a goal…</option>
          {TDEE_GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>

      {(goal === 'fat_loss' || goal === 'muscle_gain') && (
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">
            {goal === 'fat_loss' ? 'Deficit' : 'Surplus'}: {adjustmentPct}%
          </label>
          <input
            type="range" min={5} max={30} value={adjustmentPct}
            onChange={e => setAdjustmentPct(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      )}

      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Dietary preference</label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_PREFS.map(d => (
            <button
              key={d.value}
              onClick={() => setDietaryPreference(d.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                dietaryPreference === d.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 p-3 space-y-2" style={{ backgroundColor: '#fffbeb' }}>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-amber-800">Add your regular training/activity</label>
          <button onClick={addActivity} className="text-xs font-semibold text-amber-700 underline flex-shrink-0">+ Add</button>
        </div>
        <p className="text-[11px] text-amber-700 leading-relaxed">
          Don&apos;t skip this if you train regularly — without it, your target can under-fuel you, putting you at risk of low energy availability. Adding it gives a more accurate number.
        </p>
        {activities.map(act => (
          <div key={act.id} className="flex items-center gap-2">
            <select
              value={act.type}
              onChange={e => updateActivity(act.id, { type: e.target.value as TDEEActivityType })}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
            >
              {TDEE_ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="number" value={act.duration_minutes}
              onChange={e => updateActivity(act.id, { duration_minutes: e.target.value })}
              placeholder="mins" className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            />
            <input
              type="number" value={act.sessions_per_week}
              onChange={e => updateActivity(act.id, { sessions_per_week: e.target.value })}
              placeholder="x/wk" className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            />
            <button onClick={() => removeActivity(act.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>

      {macros && tdeeResult && (
        <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-sm font-bold text-gray-900">{macros.targetCals}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Cals</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{macros.proteinG}g</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Protein</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{macros.carbG}g</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Carbs</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{macros.fatG}g</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Fat</p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={submit}
        disabled={!macros || submitting}
        className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {submitting ? 'Saving…' : 'Save my targets'}
      </button>
    </div>
  )
}
