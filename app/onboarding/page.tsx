'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────
type Goal = 'fat_loss' | 'muscle_gain' | 'performance' | 'general_health'
type Sex = 'male' | 'female'
type DietaryPreference = 'none' | 'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free'
type ActivityType = 'running' | 'cycling' | 'strength' | 'hiit' | 'swimming' | 'walking' | 'rowing' | 'yoga'

type Activity = {
  id: string
  type: ActivityType
  duration_minutes: string
  sessions_per_week: string
}

type FormState = {
  goal: Goal | null
  first_name: string
  age: string
  sex: Sex | ''
  height_cm: string
  weight_kg: string
  dietary_preference: DietaryPreference
  steps_per_day: string
  activities: Activity[]
}

// ── Data ──────────────────────────────────────────────────────────────────
const GOALS: { value: Goal; label: string; description: string; emoji: string }[] = [
  { value: 'fat_loss',      label: 'Fat Loss',      description: 'Reduce body fat while preserving muscle', emoji: '🔥' },
  { value: 'muscle_gain',   label: 'Muscle Gain',   description: 'Build strength and add lean mass',         emoji: '💪' },
  { value: 'performance',   label: 'Performance',   description: 'Optimise training output and recovery',    emoji: '⚡' },
  { value: 'general_health',label: 'General Health',description: 'Feel better, move more, stress less',      emoji: '🌿' },
]

const DIETARY_PREFS: { value: DietaryPreference; label: string }[] = [
  { value: 'none',        label: 'No preference' },
  { value: 'vegetarian',  label: 'Vegetarian' },
  { value: 'vegan',       label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten-free' },
  { value: 'dairy_free',  label: 'Dairy-free' },
]

// MET values (gross MET from Compendium of Physical Activities)
const ACTIVITY_OPTIONS: { value: ActivityType; label: string; met: number; hint: string }[] = [
  { value: 'running',  label: 'Running',           met: 9.0, hint: 'Jogging or running' },
  { value: 'cycling',  label: 'Cycling',            met: 7.5, hint: 'Road, trail or stationary bike' },
  { value: 'strength', label: 'Strength Training',  met: 5.0, hint: 'Weights, resistance, machines' },
  { value: 'hiit',     label: 'HIIT / Circuits',    met: 9.0, hint: 'High-intensity interval training' },
  { value: 'swimming', label: 'Swimming',            met: 6.0, hint: 'Laps, general' },
  { value: 'walking',  label: 'Brisk Walking',       met: 3.8, hint: 'Purposeful, faster than strolling' },
  { value: 'rowing',   label: 'Rowing',              met: 7.0, hint: 'Rowing machine or on water' },
  { value: 'yoga',     label: 'Yoga / Pilates',      met: 2.5, hint: 'Yoga, pilates, stretching' },
]

// ── TDEE calculation ───────────────────────────────────────────────────────
function calcTDEE(
  age: number, sex: Sex, height_cm: number, weight_kg: number,
  activities: Activity[], steps_per_day: number,
): { bmr: number; tdee: number } {
  // Mifflin-St Jeor BMR
  const bmr = sex === 'male'
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

  // Base daily NEAT (light movement, standing, walking around home/office)
  const baseDailyNEAT = bmr * 0.15

  // Step calories: net MET approach (MET_walk=3.5, subtract resting=1 → 2.5)
  // ~100 steps/min walking pace → hours = steps / (100 × 60)
  const stepCalsPerDay = 2.5 * weight_kg * steps_per_day / 6000

  // Exercise calories per day from activities (net METs)
  const weeklyExerciseCals = activities.reduce((sum, act) => {
    const option = ACTIVITY_OPTIONS.find(o => o.value === act.type)
    const met = option?.met ?? 5
    const netMet = Math.max(met - 1, 0)
    const hours = (parseFloat(act.duration_minutes) || 0) / 60
    const sessions = parseFloat(act.sessions_per_week) || 0
    return sum + netMet * weight_kg * hours * sessions
  }, 0)
  const dailyExerciseCals = weeklyExerciseCals / 7

  // Thermic Effect of Food (~10%)
  const tdee = Math.round(
    (bmr + baseDailyNEAT + stepCalsPerDay + dailyExerciseCals) * 1.10,
  )
  return { bmr: Math.round(bmr), tdee }
}

function calcMacros(tdee: number, weight_kg: number, goal: Goal, adjustmentPct: number) {
  let targetCals: number
  let proteinG: number
  let fatG: number

  if (goal === 'fat_loss') {
    targetCals = Math.round(tdee * (1 - adjustmentPct / 100))
    proteinG   = Math.round(weight_kg * 2.2)
    fatG       = Math.round(weight_kg * 0.8)
  } else if (goal === 'muscle_gain') {
    targetCals = Math.round(tdee * (1 + adjustmentPct / 100))
    proteinG   = Math.round(weight_kg * 2.2)
    fatG       = Math.round(weight_kg * 1.0)
  } else if (goal === 'performance') {
    targetCals = tdee
    proteinG   = Math.round(weight_kg * 1.8)
    fatG       = Math.round(weight_kg * 0.9)
  } else {
    targetCals = tdee
    proteinG   = Math.round(weight_kg * 1.6)
    fatG       = Math.round(weight_kg * 0.8)
  }

  const proteinCals = proteinG * 4
  const fatCals     = fatG * 9
  const carbCals    = Math.max(targetCals - proteinCals - fatCals, 0)
  const carbG       = Math.round(carbCals / 4)

  return { targetCals, proteinG, carbG, fatG }
}

// ── UI helpers ────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full space-y-1.5">
      <div className="flex justify-between text-xs text-gray-400">
        <span>Step {step} of {total}</span>
        <span>{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(step / total) * 100}%`, backgroundColor: '#FFD885' }}
        />
      </div>
    </div>
  )
}

function MacroBar({ label, grams, calories, color }: { label: string; grams: number; calories: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">{grams}g · {calories} kcal</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
const TOTAL_STEPS = 4

// Default adjustment % per goal
function defaultAdjPct(goal: Goal | null) {
  if (goal === 'fat_loss') return 20
  if (goal === 'muscle_gain') return 10
  return 0
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adjustmentPct, setAdjustmentPct] = useState(20)
  const [activeTooltip, setActiveTooltip] = useState<'bmr' | 'tdee' | null>(null)

  const [form, setForm] = useState<FormState>({
    goal: null,
    first_name: '',
    age: '',
    sex: '',
    height_cm: '',
    weight_kg: '',
    dietary_preference: 'none',
    steps_per_day: '8000',
    activities: [],
  })

  // Reset adjustment % when goal changes
  function setGoal(goal: Goal) {
    setForm(f => ({ ...f, goal }))
    setAdjustmentPct(defaultAdjPct(goal))
  }

  // ── Derived TDEE ──
  const statsComplete =
    form.age && form.sex && form.height_cm && form.weight_kg && form.goal

  const tdeeResult = statsComplete
    ? calcTDEE(
        parseFloat(form.age),
        form.sex as Sex,
        parseFloat(form.height_cm),
        parseFloat(form.weight_kg),
        form.activities,
        parseFloat(form.steps_per_day) || 0,
      )
    : null

  const macros = tdeeResult && form.goal
    ? calcMacros(tdeeResult.tdee, parseFloat(form.weight_kg), form.goal, adjustmentPct)
    : null

  // ── Activity helpers ──
  function addActivity() {
    setForm(f => ({
      ...f,
      activities: [
        ...f.activities,
        { id: crypto.randomUUID(), type: 'strength', duration_minutes: '45', sessions_per_week: '3' },
      ],
    }))
  }

  function updateActivity(id: string, patch: Partial<Activity>) {
    setForm(f => ({
      ...f,
      activities: f.activities.map(a => a.id === id ? { ...a, ...patch } : a),
    }))
  }

  function removeActivity(id: string) {
    setForm(f => ({ ...f, activities: f.activities.filter(a => a.id !== id) }))
  }

  // ── Submit ──
  async function handleComplete() {
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: form.goal,
        first_name: form.first_name.trim() || null,
        age: form.age ? parseFloat(form.age) : null,
        sex: form.sex || null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        dietary_preference: form.dietary_preference !== 'none' ? form.dietary_preference : null,
        steps_per_day: parseFloat(form.steps_per_day) || 0,
        activities: form.activities,
        // Computed targets
        tdee: tdeeResult?.tdee ?? null,
        target_calories: macros?.targetCals ?? null,
        target_protein: macros?.proteinG ?? null,
        target_carbs: macros?.carbG ?? null,
        target_fat: macros?.fatG ?? null,
        adjustment_pct: adjustmentPct,
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }
    setStep(5)
    setSubmitting(false)
  }

  const goalLabel = GOALS.find(g => g.value === form.goal)?.label ?? ''

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="text-base font-bold text-gray-900">Prokol</span>
        {step < 5 && <span className="text-xs text-gray-400">Setting up your account</span>}
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-lg space-y-7">

          {step < 5 && <ProgressBar step={step} total={TOTAL_STEPS} />}

          {/* ── Step 1: Goal ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">What&apos;s your main goal?</h1>
                <p className="text-gray-500 text-sm mt-1">This shapes your calorie and macro targets.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGoal(g.value)}
                    className={`text-left p-5 rounded-2xl border-2 transition-all ${
                      form.goal === g.value ? 'border-gray-900 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{g.emoji}</div>
                    <p className={`text-sm font-bold ${form.goal === g.value ? 'text-gray-900' : 'text-gray-700'}`}>{g.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!form.goal}
                className="w-full py-3 rounded-2xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-900"
                style={{ backgroundColor: '#FFD885' }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 2: Body stats ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Tell us about yourself</h1>
                <p className="text-gray-500 text-sm mt-1">Used to calculate your personalised calorie and macro targets.</p>
              </div>

              <div className="bg-white rounded-2xl border p-6 space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                    placeholder="e.g. Alex"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                {/* Sex */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Biological sex <span className="text-gray-400 font-normal text-xs">(for BMR calculation)</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['male', 'female'] as Sex[]).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, sex: s }))}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          form.sex === s ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label>
                  <input
                    type="number" min="10" max="100"
                    value={form.age}
                    onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                    placeholder="e.g. 28"
                    className="w-28 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                {/* Height & Weight */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Height (cm)</label>
                    <input
                      type="number" min="100" max="250"
                      value={form.height_cm}
                      onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))}
                      placeholder="e.g. 168"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Weight (kg)</label>
                    <input
                      type="number" min="30" max="300" step="0.1"
                      value={form.weight_kg}
                      onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                      placeholder="e.g. 70"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>

                {/* Dietary preference */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Dietary preference</label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY_PREFS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, dietary_preference: d.value }))}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          form.dietary_preference === d.value
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition-colors">Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!form.first_name.trim() || !form.sex || !form.age || !form.height_cm || !form.weight_kg}
                  className="flex-[2] py-3 rounded-2xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-900"
                  style={{ backgroundColor: '#FFD885' }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Activity ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Your activity</h1>
                <p className="text-gray-500 text-sm mt-1">We use METs (Metabolic Equivalent of Task) to accurately estimate your energy expenditure.</p>
              </div>

              <div className="bg-white rounded-2xl border p-5 space-y-5">
                {/* Daily steps */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Daily steps <span className="text-gray-400 font-normal">(rough estimate)</span></label>
                  <p className="text-xs text-gray-400 mb-2">Check your phone health app for an average</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min="0" max="40000" step="500"
                      value={form.steps_per_day}
                      onChange={e => setForm(f => ({ ...f, steps_per_day: e.target.value }))}
                      className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-500">steps/day</span>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {[3000, 5000, 8000, 10000, 15000].map(s => (
                      <button key={s} type="button"
                        onClick={() => setForm(f => ({ ...f, steps_per_day: String(s) }))}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                          form.steps_per_day === String(s) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {s.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Activities */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Planned exercise sessions</label>
                    <button type="button" onClick={addActivity}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 text-gray-700 transition-colors">
                      + Add activity
                    </button>
                  </div>

                  {form.activities.length === 0 && (
                    <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">
                      No activities added — your TDEE will be based on steps only
                    </p>
                  )}

                  <div className="space-y-3">
                    {form.activities.map(act => {
                      const opt = ACTIVITY_OPTIONS.find(o => o.value === act.type)
                      return (
                        <div key={act.id} className="border border-gray-200 rounded-xl p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <select
                              value={act.type}
                              onChange={e => updateActivity(act.id, { type: e.target.value as ActivityType })}
                              className="text-sm font-medium text-gray-900 border-none bg-transparent focus:outline-none cursor-pointer"
                            >
                              {ACTIVITY_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <button type="button" onClick={() => removeActivity(act.id)}
                              className="text-gray-300 hover:text-red-400 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-xs text-gray-400">{opt?.hint} · MET {opt?.met}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Duration (min/session)</label>
                              <input
                                type="number" min="5" max="300"
                                value={act.duration_minutes}
                                onChange={e => updateActivity(act.id, { duration_minutes: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Sessions per week</label>
                              <input
                                type="number" min="1" max="14"
                                value={act.sessions_per_week}
                                onChange={e => updateActivity(act.id, { sessions_per_week: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition-colors">Back</button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-[2] py-3 rounded-2xl text-sm font-semibold transition-colors text-gray-900"
                  style={{ backgroundColor: '#FFD885' }}
                >
                  Calculate my targets
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: TDEE & Macros preview ── */}
          {step === 4 && tdeeResult && macros && form.goal && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Your daily targets</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Based on your body stats, activity, and <strong>{GOALS.find(g => g.value === form.goal)?.label}</strong> goal.
                </p>
              </div>

              {/* TDEE card */}
              <div className="bg-white rounded-2xl border p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Estimated TDEE</p>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'tdee' ? null : 'tdee')}
                        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center hover:bg-gray-300 transition-colors flex-shrink-0"
                      >
                        ?
                      </button>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 mt-0.5">{tdeeResult.tdee.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">kcal/day total energy expenditure</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'bmr' ? null : 'bmr')}
                        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center hover:bg-gray-300 transition-colors flex-shrink-0"
                      >
                        ?
                      </button>
                      <p className="text-xs text-gray-400">BMR</p>
                    </div>
                    <p className="text-lg font-semibold text-gray-500">{tdeeResult.bmr.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">kcal base</p>
                  </div>
                </div>

                {/* BMR tooltip */}
                {activeTooltip === 'bmr' && (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-blue-800">What is BMR?</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Your <strong>Basal Metabolic Rate</strong> is the number of calories your body needs just to stay alive at complete rest — breathing, pumping blood, keeping organs running. Think of it as your engine idling. It doesn&apos;t include any movement or exercise.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip('tdee')}
                      className="text-xs font-semibold text-blue-600 underline mt-1"
                    >
                      Next: what is TDEE? →
                    </button>
                  </div>
                )}

                {/* TDEE tooltip */}
                {activeTooltip === 'tdee' && (
                  <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-amber-800">What is TDEE?</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Your <strong>Total Daily Energy Expenditure</strong> is your BMR <em>plus</em> all the calories you burn through movement — walking, workouts, even fidgeting. This is the number your calorie target is built around. Hit it to maintain weight, eat less to lose, or eat more to gain.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(null)}
                      className="text-xs font-semibold text-amber-600 underline mt-1"
                    >
                      Got it ✓
                    </button>
                  </div>
                )}

                {/* Deficit / surplus adjuster */}
                {(form.goal === 'fat_loss' || form.goal === 'muscle_gain') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                        {form.goal === 'fat_loss' ? 'Calorie deficit' : 'Calorie surplus'}
                      </p>
                      <span className="text-sm font-bold text-gray-900">{adjustmentPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={form.goal === 'fat_loss' ? 5 : 5}
                      max={form.goal === 'fat_loss' ? 30 : 25}
                      step={5}
                      value={adjustmentPct}
                      onChange={e => setAdjustmentPct(Number(e.target.value))}
                      className="w-full accent-gray-900"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{form.goal === 'fat_loss' ? 'Gentle (5%)' : 'Lean gain (5%)'}</span>
                      <span>{form.goal === 'fat_loss' ? 'Aggressive (30%)' : 'Fast gain (25%)'}</span>
                    </div>
                    {form.goal === 'fat_loss' && adjustmentPct > 20 && (
                      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                        Deficits above 20% risk muscle loss. Recommended: 15–20%.
                      </p>
                    )}
                    {form.goal === 'muscle_gain' && adjustmentPct > 15 && (
                      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                        Surpluses above 15% tend to add more fat than muscle. Recommended: 5–10%.
                      </p>
                    )}
                  </div>
                )}

                {/* Target calories */}
                <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#FFF9E6' }}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Daily calorie target</p>
                  <p className="text-4xl font-bold text-gray-900">{macros.targetCals.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {form.goal === 'fat_loss'    ? `${adjustmentPct}% deficit below TDEE` :
                     form.goal === 'muscle_gain' ? `${adjustmentPct}% surplus above TDEE` :
                     'Maintenance (TDEE)'}
                  </p>
                </div>

                {/* Macros */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Macro breakdown</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-blue-100 bg-blue-50 py-3">
                      <p className="text-xl font-bold text-blue-700">{macros.proteinG}g</p>
                      <p className="text-xs text-blue-500 font-medium mt-0.5">Protein</p>
                      <p className="text-xs text-blue-400">{macros.proteinG * 4} kcal</p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 py-3">
                      <p className="text-xl font-bold text-amber-700">{macros.carbG}g</p>
                      <p className="text-xs text-amber-500 font-medium mt-0.5">Carbs</p>
                      <p className="text-xs text-amber-400">{macros.carbG * 4} kcal</p>
                    </div>
                    <div className="rounded-xl border border-rose-100 bg-rose-50 py-3">
                      <p className="text-xl font-bold text-rose-700">{macros.fatG}g</p>
                      <p className="text-xs text-rose-500 font-medium mt-0.5">Fat</p>
                      <p className="text-xs text-rose-400">{macros.fatG * 9} kcal</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    These targets are a starting point — adjust based on how your body responds over 2–3 weeks. Protein is prioritised to preserve muscle.
                  </p>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition-colors">Back</button>
                <button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="flex-[2] py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-colors text-gray-900"
                  style={{ backgroundColor: '#FFD885' }}
                >
                  {submitting ? 'Saving…' : 'Save & go to dashboard →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4 fallback: no stats entered ── */}
          {step === 4 && !tdeeResult && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Almost there</h1>
                <p className="text-gray-500 text-sm mt-1">We need your body stats to calculate your targets. Go back and fill them in.</p>
              </div>
              <button onClick={() => setStep(2)} className="w-full border border-gray-200 text-gray-700 py-3 rounded-2xl text-sm font-semibold hover:bg-gray-50">Back to stats</button>
            </div>
          )}

          {/* ── Step 5: Success ── */}
          {step === 5 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: '#FFF9E6' }}>
                <span className="text-4xl">🎉</span>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {form.first_name ? `Welcome, ${form.first_name}!` : "You're all set!"}
                </h1>
                <p className="text-gray-500 text-sm mt-2">Your targets are saved. Track your food and hit your macros every day.</p>
              </div>

              {macros && (
                <div className="bg-white rounded-2xl border p-5 text-left space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your daily targets</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{macros.targetCals}</p>
                      <p className="text-xs text-gray-400">kcal</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600">{macros.proteinG}g</p>
                      <p className="text-xs text-gray-400">protein</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-600">{macros.carbG}g</p>
                      <p className="text-xs text-gray-400">carbs</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-rose-600">{macros.fatG}g</p>
                      <p className="text-xs text-gray-400">fat</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Goal: <span className="font-medium text-gray-600">{goalLabel}</span></p>
                </div>
              )}

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-colors text-gray-900"
                style={{ backgroundColor: '#FFD885' }}
              >
                Go to dashboard →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
