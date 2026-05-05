'use client'

import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { noteBodyToHtml } from '@/lib/noteUtils'
const CheckInFeedback = lazy(() => import('./CheckInFeedback'))
const FlowsTab = lazy(() => import('./FlowsTab'))
const AppPreviewTab = lazy(() => import('./AppPreviewTab'))
const PlanBuilderTab = lazy(() => import('./PlanBuilderTab'))

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckIn = {
  id: string
  created_at: string
  sleep_hours: number | null
  sleep_quality: string | null
  energy_level: string | null
  rhr: number | null
  hrv: number | null
  notes: string | null
  coach_feedback: string | null
  reviewed_by_coach: boolean
}

type WorkoutExercise = {
  name: string
  category: string
  notes: string | null
  video_url: string | null
}

type Workout = {
  id: string
  name: string
  started_at: string
  ended_at: string
  exercises: WorkoutExercise[]
}

type WeightLog = {
  logged_at: string
  weight_lbs: number
  weight_unit: string
}

type FoodLog = {
  id: string
  log_date: string
  meal_type: string
  food_name: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  scan_image_url: string | null
  meal_notes: string | null
  meal_photo_url: string | null
}

type Note = {
  id: string
  body: string
  created_at: string
}

type MealNote = {
  log_date: string
  meal_type: string
  note: string | null
  photo_url: string | null
}

type FormCheckIn = {
  id: string
  form_id: string
  title: string
  submitted_at: string
  viewed_by_coach?: boolean
  coach_feedback?: string | null
}

type AutoflowCheckIn = {
  id: string
  flow_id: string
  flow_name: string
  step_number: number
  submitted_at: string
  answers: Record<string, string>
  questions: { id: string; label: string; type: string }[]
  reviewed_by_coach?: boolean
  coach_feedback?: string | null
}

type ClientData = {
  checkIns: CheckIn[]
  formCheckIns: FormCheckIn[]
  autoflowCheckIns: AutoflowCheckIn[]
  workouts: Workout[]
  weightLogs: WeightLog[]
  foodLogs: FoodLog[]
  mealNotes: MealNote[]
}

import TDEESection from './TDEESection'

// ── TDEE calculation (mirrors onboarding/page.tsx exactly) ───────────────────

type TDEESex = 'male' | 'female'
type TDEEGoal = 'fat_loss' | 'muscle_gain' | 'performance' | 'general_health'
type TDEEActivityType = 'running' | 'cycling' | 'strength' | 'hiit' | 'swimming' | 'walking' | 'rowing' | 'yoga'
type TDEEActivity = { id: string; type: TDEEActivityType; duration_minutes: string; sessions_per_week: string }

const TDEE_GOALS: { value: TDEEGoal; label: string }[] = [
  { value: 'fat_loss',       label: 'Fat Loss' },
  { value: 'muscle_gain',    label: 'Muscle Gain' },
  { value: 'performance',    label: 'Performance' },
  { value: 'general_health', label: 'General Health' },
]

const TDEE_ACTIVITY_OPTIONS: { value: TDEEActivityType; label: string; met: number; hint: string }[] = [
  { value: 'running',  label: 'Running',          met: 9.0, hint: 'Jogging or running' },
  { value: 'cycling',  label: 'Cycling',           met: 7.5, hint: 'Road, trail or stationary bike' },
  { value: 'strength', label: 'Strength Training', met: 5.0, hint: 'Weights, resistance, machines' },
  { value: 'hiit',     label: 'HIIT / Circuits',   met: 9.0, hint: 'High-intensity interval training' },
  { value: 'swimming', label: 'Swimming',           met: 6.0, hint: 'Laps, general' },
  { value: 'walking',  label: 'Brisk Walking',      met: 3.8, hint: 'Purposeful, faster than strolling' },
  { value: 'rowing',   label: 'Rowing',             met: 7.0, hint: 'Rowing machine or on water' },
  { value: 'yoga',     label: 'Yoga / Pilates',     met: 2.5, hint: 'Yoga, pilates, stretching' },
]

function calcTDEE(age: number, sex: TDEESex, height_cm: number, weight_kg: number, activities: TDEEActivity[], steps_per_day: number) {
  const bmr = sex === 'male'
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
  const baseDailyNEAT = bmr * 0.15
  const stepCalsPerDay = 2.5 * weight_kg * steps_per_day / 6000
  const weeklyExerciseCals = activities.reduce((sum, act) => {
    const opt = TDEE_ACTIVITY_OPTIONS.find(o => o.value === act.type)
    const netMet = Math.max((opt?.met ?? 5) - 1, 0)
    const hours = (parseFloat(act.duration_minutes) || 0) / 60
    const sessions = parseFloat(act.sessions_per_week) || 0
    return sum + netMet * weight_kg * hours * sessions
  }, 0)
  const dailyExerciseCals = weeklyExerciseCals / 7
  const tdee = Math.round((bmr + baseDailyNEAT + stepCalsPerDay + dailyExerciseCals) * 1.10)
  return { bmr: Math.round(bmr), tdee }
}

function calcMacros(tdee: number, weight_kg: number, goal: TDEEGoal, adjustmentPct: number) {
  let targetCals: number
  let proteinG: number
  let fatG: number
  if (goal === 'fat_loss') {
    targetCals = Math.round(tdee * (1 - adjustmentPct / 100))
    proteinG = Math.round(weight_kg * 2.2)
    fatG = Math.round(weight_kg * 0.8)
  } else if (goal === 'muscle_gain') {
    targetCals = Math.round(tdee * (1 + adjustmentPct / 100))
    proteinG = Math.round(weight_kg * 2.2)
    fatG = Math.round(weight_kg * 1.0)
  } else if (goal === 'performance') {
    targetCals = tdee
    proteinG = Math.round(weight_kg * 1.8)
    fatG = Math.round(weight_kg * 0.9)
  } else {
    targetCals = tdee
    proteinG = Math.round(weight_kg * 1.6)
    fatG = Math.round(weight_kg * 0.8)
  }
  const carbCals = Math.max(targetCals - proteinG * 4 - fatG * 9, 0)
  return { targetCals, proteinG, carbG: Math.round(carbCals / 4), fatG }
}

function defaultAdjPct(goal: TDEEGoal | null) {
  if (goal === 'fat_loss') return 20
  if (goal === 'muscle_gain') return 10
  return 0
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENERGY_LABELS: Record<string, string> = {
  peaked: 'Peaked – ready to PR',
  high: 'High – feeling strong',
  moderate: 'Moderate – normal day',
  low: 'Low – feeling fatigued',
  sore: 'Sore – DOMS',
  depleted: 'Depleted – rest day',
}
const SLEEP_LABELS: Record<string, string> = {
  deep_restful: 'Deep & Restful',
  good: 'Good',
  okay: 'Okay',
  restless: 'Restless',
  poor: 'Poor',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function duration(s: string, e: string) {
  return `${Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000)} min`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}
function Empty({ label }: { label: string }) {
  return <p className="text-sm text-gray-400 text-center py-10">{label}</p>
}

// TDEESection is imported from ./TDEESection.tsx
// ── Goals section (originally below) — kept here as a marker

function _TDEESectionPlaceholder({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [savingTdee, setSavingTdee] = useState(false)
  const [savingTargets, setSavingTargets] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [hasActiveMealPlan, setHasActiveMealPlan] = useState(false)

  // Form state — mirrors onboarding exactly
  const [sex, setSex] = useState<TDEESex | ''>('')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [stepsPerDay, setStepsPerDay] = useState('8000')
  const [activities, setActivities] = useState<TDEEActivity[]>([])
  const [goal, setGoal] = useState<TDEEGoal | null>(null)
  const [adjustmentPct, setAdjustmentPct] = useState(20)
  const [macroMethod, setMacroMethod] = useState<'auto' | 'manual'>('auto')
  const [proteinPerKg, setProteinPerKg] = useState('2.0')
  const [fatPct, setFatPct] = useState('25')

  // Saved targets (shown in collapsed view)
  const [savedTdee, setSavedTdee] = useState<number | null>(null)
  const [savedCals, setSavedCals] = useState<number | null>(null)
  const [savedProtein, setSavedProtein] = useState<number | null>(null)
  const [savedCarbs, setSavedCarbs] = useState<number | null>(null)
  const [savedFat, setSavedFat] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/coach/clients/${clientId}/tdee`).then(r => r.json()),
      fetch(`/api/coach/clients/${clientId}/meal-plans`).then(r => r.json()),
    ]).then(([d, plans]) => {
      setSex(d.sex ?? '')
      setAge(d.age != null ? String(d.age) : '')
      setHeightCm(d.height_cm != null ? String(d.height_cm) : '')
      setWeightKg(d.weight_kg != null ? String(d.weight_kg) : '')
      setStepsPerDay(d.steps_per_day != null ? String(d.steps_per_day) : '8000')
      setActivities(
        Array.isArray(d.activities)
          ? d.activities.map((a: Record<string, unknown>) => ({ ...a, id: crypto.randomUUID() }))
          : []
      )
      setGoal(d.goal ?? null)
      setAdjustmentPct(d.adjustment_pct ?? defaultAdjPct(d.goal ?? null))
      setSavedTdee(d.tdee ?? null)
      setSavedCals(d.target_calories ?? null)
      setSavedProtein(d.target_protein ?? null)
      setSavedCarbs(d.target_carbs ?? null)
      setSavedFat(d.target_fat ?? null)
      setHasActiveMealPlan(Array.isArray(plans) && plans.some((p: Record<string, unknown>) => p.status === 'active'))
    }).finally(() => setLoading(false))
  }, [clientId])

  // Live calculation
  const statsComplete = age && sex && heightCm && weightKg && goal
  const tdeeResult = statsComplete
    ? calcTDEE(parseFloat(age), sex as TDEESex, parseFloat(heightCm), parseFloat(weightKg), activities, parseFloat(stepsPerDay) || 0)
    : null
  const macros = tdeeResult && goal
    ? calcMacros(tdeeResult.tdee, parseFloat(weightKg), goal, adjustmentPct)
    : null

  // Manual macro override — protein g/kg BW, fat % of cals, carbs from remainder
  const effectiveMacros = (() => {
    if (!macros) return null
    if (macroMethod === 'auto') return macros
    const wkg = parseFloat(weightKg) || 0
    const ppkg = parseFloat(proteinPerKg) || 2.0
    const fp = parseFloat(fatPct) || 25
    const proteinG = Math.round(wkg * ppkg)
    const fatG = Math.round(macros.targetCals * fp / 100 / 9)
    const carbG = Math.round(Math.max(macros.targetCals - proteinG * 4 - fatG * 9, 0) / 4)
    return { targetCals: macros.targetCals, proteinG, carbG, fatG }
  })()

  function addActivity() {
    setActivities(prev => [...prev, { id: crypto.randomUUID(), type: 'strength', duration_minutes: '45', sessions_per_week: '3' }])
  }
  function updateActivity(id: string, patch: Partial<TDEEActivity>) {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }
  function removeActivity(id: string) {
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  function buildPayload(applyTargets: boolean) {
    return {
      age: parseFloat(age),
      sex,
      height_cm: parseFloat(heightCm),
      weight_kg: parseFloat(weightKg),
      steps_per_day: parseFloat(stepsPerDay) || 0,
      activities: activities.map(({ id: _id, ...a }) => a),
      goal,
      adjustment_pct: adjustmentPct,
      tdee: tdeeResult!.tdee,
      target_calories: effectiveMacros!.targetCals,
      target_protein: effectiveMacros!.proteinG,
      target_carbs: effectiveMacros!.carbG,
      target_fat: effectiveMacros!.fatG,
      apply_targets: applyTargets,
    }
  }

  async function handleSaveTdee() {
    if (!tdeeResult || !effectiveMacros) return
    setSavingTdee(true)
    // In manual mode, always apply the macro targets too — the coach explicitly set them
    const applyTargets = macroMethod === 'manual'
    await fetch(`/api/coach/clients/${clientId}/tdee`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(applyTargets)),
    })
    setSavedTdee(tdeeResult.tdee)
    if (applyTargets) {
      setSavedCals(effectiveMacros.targetCals)
      setSavedProtein(effectiveMacros.proteinG)
      setSavedCarbs(effectiveMacros.carbG)
      setSavedFat(effectiveMacros.fatG)
    }
    setSavingTdee(false)
    setSavedMsg(applyTargets ? 'TDEE & targets saved' : 'TDEE saved')
    setTimeout(() => { setSavedMsg(null); setExpanded(false) }, 1500)
  }

  async function handleSaveTargets() {
    if (!tdeeResult || !effectiveMacros) return
    setSavingTargets(true)
    await fetch(`/api/coach/clients/${clientId}/tdee`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(true)),
    })
    setSavedTdee(tdeeResult.tdee)
    setSavedCals(effectiveMacros.targetCals)
    setSavedProtein(effectiveMacros.proteinG)
    setSavedCarbs(effectiveMacros.carbG)
    setSavedFat(effectiveMacros.fatG)
    setSavingTargets(false)
    setSavedMsg('Targets saved')
    setTimeout(() => { setSavedMsg(null); setExpanded(false) }, 1500)
  }

  if (loading) return <div className="bg-white rounded-2xl border p-5"><p className="text-sm text-gray-400">Loading…</p></div>

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">TDEE & Targets</h3>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? 'Collapse' : savedTdee ? 'Recalculate' : 'Calculate'}
        </button>
      </div>

      {/* Collapsed summary */}
      {!expanded && (
        savedTdee ? (
          <div className="space-y-2">
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-gray-400">TDEE</p>
                <p className="text-xl font-bold text-gray-900">{savedTdee.toLocaleString()} <span className="text-xs font-normal text-gray-400">kcal/day</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Daily target</p>
                <p className="text-xl font-bold text-gray-900">{savedCals?.toLocaleString() ?? '—'} <span className="text-xs font-normal text-gray-400">kcal/day</span></p>
              </div>
            </div>
            {(savedProtein || savedCarbs || savedFat) && (
              <p className="text-xs text-gray-500">{savedProtein}g P · {savedCarbs}g C · {savedFat}g F</p>
            )}
            {hasActiveMealPlan && (
              <p className="text-xs text-blue-500 font-medium">Targets driven by active meal plan</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No TDEE calculated yet. Click Calculate to get started.</p>
        )
      )}

      {/* Expanded form */}
      {expanded && (
        <div className="space-y-5">
          {/* Sex */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Biological sex <span className="text-gray-400 font-normal">(for BMR)</span></label>
            <div className="flex gap-2">
              {(['male', 'female'] as TDEESex[]).map(s => (
                <button key={s} type="button" onClick={() => setSex(s)}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${sex === s ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Age / Height / Weight */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
              <input type="number" min="10" max="100" value={age} onChange={e => setAge(e.target.value)} placeholder="28"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Height (cm)</label>
              <input type="number" min="100" max="250" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="168"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Weight (kg)</label>
              <input type="number" min="30" max="300" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="70"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>

          {/* Steps */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Daily steps</label>
            <div className="flex items-center gap-3 mb-2">
              <input type="number" min="0" max="40000" step="500" value={stepsPerDay} onChange={e => setStepsPerDay(e.target.value)}
                className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <span className="text-xs text-gray-400">steps/day</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[3000, 5000, 8000, 10000, 15000].map(s => (
                <button key={s} type="button" onClick={() => setStepsPerDay(String(s))}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${stepsPerDay === String(s) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                  {s.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Activities */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Exercise sessions</label>
              <button type="button" onClick={addActivity}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 text-gray-700 transition-colors">
                + Add activity
              </button>
            </div>
            {activities.length === 0 && (
              <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">
                No activities — TDEE based on steps only
              </p>
            )}
            <div className="space-y-2">
              {activities.map(act => {
                const opt = TDEE_ACTIVITY_OPTIONS.find(o => o.value === act.type)
                return (
                  <div key={act.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <select value={act.type} onChange={e => updateActivity(act.id, { type: e.target.value as TDEEActivityType })}
                        className="text-sm font-medium text-gray-900 border-none bg-transparent focus:outline-none cursor-pointer">
                        {TDEE_ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <button type="button" onClick={() => removeActivity(act.id)} className="text-gray-300 hover:text-red-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">{opt?.hint} · MET {opt?.met}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Min/session</label>
                        <input type="number" min="5" max="300" value={act.duration_minutes}
                          onChange={e => updateActivity(act.id, { duration_minutes: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Sessions/week</label>
                        <input type="number" min="1" max="14" value={act.sessions_per_week}
                          onChange={e => updateActivity(act.id, { sessions_per_week: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Client goal</label>
            <div className="flex flex-wrap gap-2">
              {TDEE_GOALS.map(g => (
                <button key={g.value} type="button" onClick={() => { setGoal(g.value); setAdjustmentPct(defaultAdjPct(g.value)) }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${goal === g.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live result */}
          {tdeeResult && effectiveMacros && goal && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">TDEE</p>
                  <p className="text-2xl font-bold text-gray-900">{tdeeResult.tdee.toLocaleString()} <span className="text-xs font-normal text-gray-400">kcal/day</span></p>
                  <p className="text-xs text-gray-400">BMR: {tdeeResult.bmr.toLocaleString()} kcal</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Target</p>
                  <p className="text-2xl font-bold text-gray-900">{effectiveMacros.targetCals.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">kcal/day</p>
                </div>
              </div>

              {/* Deficit/surplus slider */}
              {(goal === 'fat_loss' || goal === 'muscle_gain') && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-medium">{goal === 'fat_loss' ? 'Deficit' : 'Surplus'}</span>
                    <span className="font-bold text-gray-900">{adjustmentPct}%</span>
                  </div>
                  <input type="range" min={5} max={goal === 'fat_loss' ? 30 : 25} step={5} value={adjustmentPct}
                    onChange={e => setAdjustmentPct(Number(e.target.value))} className="w-full accent-gray-900" />
                  {goal === 'fat_loss' && adjustmentPct > 20 && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">Deficits above 20% risk muscle loss. Recommended: 15–20%.</p>
                  )}
                </div>
              )}

              {/* Macro method toggle */}
              <div className="border-t border-gray-200 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Macro targets</p>
                  <div className="flex bg-gray-200 rounded-lg p-0.5">
                    {(['auto', 'manual'] as const).map(m => (
                      <button key={m} onClick={() => setMacroMethod(m)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${macroMethod === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {m === 'auto' ? 'Auto' : 'Manual'}
                      </button>
                    ))}
                  </div>
                </div>

                {macroMethod === 'manual' && (
                  <div className="space-y-2.5">
                    {/* Protein g/kg */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Protein g/kg BW <span className="text-gray-400">(1.4–2.2)</span></label>
                        <input type="number" step="0.1" min="1" max="3" value={proteinPerKg}
                          onChange={e => setProteinPerKg(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div className="text-right flex-shrink-0 pt-4">
                        <p className="text-base font-bold text-gray-900">{effectiveMacros.proteinG}g</p>
                        <p className="text-[10px] text-gray-400">{(effectiveMacros.proteinG * 4).toLocaleString()} kcal</p>
                      </div>
                    </div>

                    {/* Fat % of cals */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Fat % of calories <span className="text-gray-400">(20–40%)</span></label>
                        <input type="number" step="1" min="15" max="50" value={fatPct}
                          onChange={e => setFatPct(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div className="text-right flex-shrink-0 pt-4">
                        <p className="text-base font-bold text-gray-900">{effectiveMacros.fatG}g</p>
                        <p className="text-[10px] text-gray-400">{(effectiveMacros.fatG * 9).toLocaleString()} kcal</p>
                      </div>
                    </div>

                    {/* Carbs — remainder */}
                    <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-gray-100">
                      <div>
                        <p className="text-xs font-medium text-gray-700">Carbs <span className="font-normal text-gray-400">(remaining calories)</span></p>
                        <p className="text-[10px] text-gray-400">{(effectiveMacros.carbG * 4).toLocaleString()} kcal</p>
                      </div>
                      <p className="text-base font-bold text-gray-900">{effectiveMacros.carbG}g</p>
                    </div>
                  </div>
                )}

                {macroMethod === 'auto' && (
                  <p className="text-xs text-gray-500">{effectiveMacros.proteinG}g P · {effectiveMacros.carbG}g C · {effectiveMacros.fatG}g F</p>
                )}
              </div>
            </div>
          )}

          {savedMsg && (
            <p className="text-xs text-center font-semibold text-green-600">{savedMsg}</p>
          )}

          {/* Meal plan notice */}
          {hasActiveMealPlan && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700">Client has an active meal plan. Daily targets are driven by the meal plan and will override any targets saved here.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex gap-2">
              {/* Saves TDEE calculation without touching daily targets — coach view only */}
              <button onClick={handleSaveTdee} disabled={savingTdee || !tdeeResult || !effectiveMacros}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                {savingTdee ? 'Saving…' : macroMethod === 'manual' ? 'Save TDEE & targets' : 'Save TDEE data'}
              </button>

              {/* Writes target_calories/macros to client profile */}
              <button onClick={handleSaveTargets} disabled={savingTargets || !tdeeResult || !effectiveMacros}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors">
                {savingTargets ? 'Saving…' : hasActiveMealPlan ? 'Override daily targets' : 'Set as daily targets'}
              </button>
            </div>
            <div className="flex gap-2 text-[10px] text-gray-400 px-0.5">
              <span className="flex-1 text-center">Coach view only</span>
              <span className="flex-1 text-center">Shown on client dashboard</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Goals section (inside Overview) ───────────────────────────────────────────

function GoalsSection({ clientId }: { clientId: string }) {
  const [mainGoal, setMainGoal] = useState('')
  const [savedMainGoal, setSavedMainGoal] = useState('')
  const [miniGoals, setMiniGoals] = useState<string[]>([])
  const [newMini, setNewMini] = useState('')
  const [keyNotes, setKeyNotes] = useState<string[]>([])
  const [newKeyNote, setNewKeyNote] = useState('')
  const [editingKeyNoteIdx, setEditingKeyNoteIdx] = useState<number | null>(null)
  const [editingKeyNoteVal, setEditingKeyNoteVal] = useState('')
  const [editingMiniIdx, setEditingMiniIdx] = useState<number | null>(null)
  const [editingMiniVal, setEditingMiniVal] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [miniSaving, setMiniSaving] = useState(false)
  const [keyNotesSaving, setKeyNotesSaving] = useState(false)
  const miniGoalsRef = useRef<string[]>([])
  const mainGoalRef = useRef('')
  const keyNotesRef = useRef<string[]>([])

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/goals`)
      .then((r) => r.json())
      .then((d) => {
        const mg = d.main_goal ?? ''
        setMainGoal(mg); setSavedMainGoal(mg); mainGoalRef.current = mg
        const minis = Array.isArray(d.mini_goals) ? d.mini_goals : []
        setMiniGoals(minis); miniGoalsRef.current = minis
        const kn = Array.isArray(d.key_notes) ? d.key_notes : []
        setKeyNotes(kn); keyNotesRef.current = kn
      })
      .finally(() => setLoading(false))
  }, [clientId])

  const mainGoalDirty = mainGoal !== savedMainGoal

  async function putGoals(main: string, minis: string[], kn: string[]) {
    return fetch(`/api/coach/clients/${clientId}/goals`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ main_goal: main || null, mini_goals: minis, key_notes: kn }),
    })
  }

  async function saveMainGoal() {
    setSaving(true)
    await putGoals(mainGoal, miniGoalsRef.current, keyNotesRef.current)
    setSavedMainGoal(mainGoal); mainGoalRef.current = mainGoal
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addMini() {
    const val = newMini.trim()
    if (!val) return
    const next = [...miniGoalsRef.current, val]
    setMiniGoals(next); miniGoalsRef.current = next; setNewMini('')
    setMiniSaving(true)
    await putGoals(mainGoalRef.current, next, keyNotesRef.current)
    setMiniSaving(false)
  }

  async function removeMini(i: number) {
    const next = miniGoalsRef.current.filter((_, j) => j !== i)
    setMiniGoals(next); miniGoalsRef.current = next
    await putGoals(mainGoalRef.current, next, keyNotesRef.current)
  }

  async function saveMiniEdit(i: number) {
    const val = editingMiniVal.trim()
    if (!val) return
    const next = miniGoalsRef.current.map((g, j) => j === i ? val : g)
    setMiniGoals(next); miniGoalsRef.current = next
    setEditingMiniIdx(null); setEditingMiniVal('')
    setMiniSaving(true)
    await putGoals(mainGoalRef.current, next, keyNotesRef.current)
    setMiniSaving(false)
  }

  async function addKeyNote() {
    const val = newKeyNote.trim()
    if (!val) return
    const next = [...keyNotesRef.current, val]
    setKeyNotes(next); keyNotesRef.current = next; setNewKeyNote('')
    setKeyNotesSaving(true)
    await putGoals(mainGoalRef.current, miniGoalsRef.current, next)
    setKeyNotesSaving(false)
  }

  async function removeKeyNote(i: number) {
    const next = keyNotesRef.current.filter((_, j) => j !== i)
    setKeyNotes(next); keyNotesRef.current = next
    await putGoals(mainGoalRef.current, miniGoalsRef.current, next)
  }

  async function saveKeyNoteEdit(i: number) {
    const val = editingKeyNoteVal.trim()
    if (!val) return
    const next = keyNotesRef.current.map((n, j) => j === i ? val : n)
    setKeyNotes(next); keyNotesRef.current = next
    setEditingKeyNoteIdx(null); setEditingKeyNoteVal('')
    setKeyNotesSaving(true)
    await putGoals(mainGoalRef.current, miniGoalsRef.current, next)
    setKeyNotesSaving(false)
  }

  if (loading) return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border p-5 h-32 animate-pulse" />
      <div className="bg-white rounded-2xl border p-5 h-32 animate-pulse" />
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* ── Important Notes ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Important Notes</h3>
          </div>
          {keyNotesSaving && <span className="text-[11px] text-gray-400">Saving…</span>}
        </div>

        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {keyNotes.length === 0 && (
            <p className="text-xs text-gray-400 italic">No notes yet — add allergies, injuries, key context…</p>
          )}
          {keyNotes.map((n, i) => (
            <div key={i}>
              {editingKeyNoteIdx === i ? (
                <div className="flex gap-1.5 items-center">
                  <input
                    autoFocus
                    value={editingKeyNoteVal}
                    onChange={(e) => setEditingKeyNoteVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveKeyNoteEdit(i) } if (e.key === 'Escape') { setEditingKeyNoteIdx(null) } }}
                    className="border border-red-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300 bg-white w-40"
                  />
                  <button onClick={() => saveKeyNoteEdit(i)} className="text-xs font-semibold text-red-600 hover:text-red-800">Save</button>
                  <button onClick={() => setEditingKeyNoteIdx(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              ) : (
                <span className="group inline-flex items-center gap-1.5 bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                  <span>{n}</span>
                  <button onClick={() => { setEditingKeyNoteIdx(i); setEditingKeyNoteVal(n) }}
                    className="opacity-60 hover:opacity-100 transition-opacity">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => removeKeyNote(i)}
                    className="opacity-60 hover:opacity-100 transition-opacity">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <input
            value={newKeyNote}
            onChange={(e) => setNewKeyNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyNote())}
            placeholder="Add a note…"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-900"
          />
          <button onClick={addKeyNote} disabled={!newKeyNote.trim()}
            className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-40 px-2 transition-colors">
            Add
          </button>
        </div>
      </div>

      {/* ── Goals ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Goals</h3>
          </div>
          <button onClick={saveMainGoal} disabled={saving || !mainGoalDirty}
            className="text-xs font-semibold text-green-700 hover:text-green-900 disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : saved ? 'Saved ✓' : mainGoalDirty ? 'Save' : ''}
          </button>
        </div>

        {/* Main goal */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Main Goal</label>
          {savedMainGoal && !mainGoalDirty ? (
            <div className="bg-green-700 text-white rounded-xl px-4 py-3 group relative">
              <p className="text-sm font-medium leading-snug pr-6">{savedMainGoal}</p>
              <button
                onClick={() => setMainGoal(savedMainGoal + ' ')}
                className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            </div>
          ) : (
            <textarea
              autoFocus={mainGoalDirty}
              value={mainGoal}
              onChange={(e) => { setMainGoal(e.target.value); mainGoalRef.current = e.target.value }}
              placeholder="e.g. Lose 5 kg by summer, build consistent training habit…"
              rows={2}
              className={`w-full border rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 bg-white focus:outline-none focus:ring-2 resize-none ${
                mainGoalDirty ? 'border-green-400 focus:ring-green-300' : 'border-gray-200 focus:ring-green-200'
              }`}
            />
          )}
        </div>

        {/* Mini goals */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Mini Goals <span className="font-normal normal-case">(this week)</span></label>
            {miniSaving && <span className="text-xs text-gray-400">Saving…</span>}
          </div>
          <div className="space-y-1.5 min-h-[28px]">
            {miniGoals.length === 0 && <p className="text-xs text-gray-400 italic">No mini goals yet.</p>}
            {miniGoals.map((g, i) => (
              <div key={i}>
                {editingMiniIdx === i ? (
                  <div className="flex gap-1.5 items-center">
                    <input
                      autoFocus
                      value={editingMiniVal}
                      onChange={(e) => setEditingMiniVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveMiniEdit(i) } if (e.key === 'Escape') { setEditingMiniIdx(null) } }}
                      className="flex-1 border border-green-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                    />
                    <button onClick={() => saveMiniEdit(i)} className="text-xs font-semibold text-green-700 hover:text-green-900">Save</button>
                    <button onClick={() => setEditingMiniIdx(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                ) : (
                  <div className="group flex items-start gap-2 bg-green-50 rounded-xl px-3 py-2">
                    <span className="mt-1 w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                    <span className="flex-1 min-w-0 text-xs text-green-900 leading-relaxed break-words">{g}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                      <button onClick={() => { setEditingMiniIdx(i); setEditingMiniVal(g) }} className="text-green-600 hover:text-green-800" title="Edit">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => removeMini(i)} className="text-green-600 hover:text-red-500" title="Remove">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <input
              value={newMini}
              onChange={(e) => setNewMini(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMini())}
              placeholder="Add a mini goal…"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-300 text-gray-900"
            />
            <button onClick={addMini} disabled={!newMini.trim()}
              className="text-xs font-semibold text-green-700 hover:text-green-900 disabled:opacity-40 px-2 transition-colors">
              Add
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Client settings section (inside Overview) ─────────────────────────────────

const FOOD_LOG_OPTIONS: { value: 'full' | 'no_scan' | 'note_only' | 'off'; label: string; desc: string }[] = [
  { value: 'full',      label: 'Full access',   desc: 'Food log, AI scanning, and meal notes' },
  { value: 'no_scan',   label: 'No AI scan',    desc: 'Food log and meal notes, no camera scanning' },
  { value: 'note_only', label: 'Notes only',    desc: 'Meal photo & note section only — no food logging' },
  { value: 'off',       label: 'Off',           desc: 'Food log hidden entirely' },
]

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-checked={checked}
      role="switch"
      className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50', checked ? 'bg-blue-600' : 'bg-gray-200'].join(' ')}
    >
      <span className={['inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200', checked ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
    </button>
  )
}

function CycleReminderToggle({ clientId }: { clientId: string }) {
  const [isFemale, setIsFemale] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/cycle-reminder`)
      .then(r => r.json())
      .then(d => {
        setIsFemale(d.sex === 'female')
        setEnabled(d.cycle_reminders !== false)
      })
      .catch(() => {})
  }, [clientId])

  if (isFemale === false) return null
  if (isFemale === null) return null

  async function toggle() {
    const next = !enabled
    setEnabled(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/coach/clients/${clientId}/cycle-reminder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) setEnabled(!next)
    } catch {
      setEnabled(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">Cycle tracking reminders</p>
        <p className="text-xs text-gray-400 mt-0.5">Daily 8pm push notification to log symptoms if not already logged</p>
      </div>
      <Toggle checked={enabled} onChange={toggle} disabled={saving} />
    </div>
  )
}

function ClientSettingsSection({
  clientId,
  showDailyTargets,
  onToggle,
  saving,
  foodLogAccess,
  onFoodLogAccess,
  savingFoodLog,
}: {
  clientId: string
  showDailyTargets: boolean
  onToggle: () => void
  saving: boolean
  foodLogAccess: 'full' | 'no_scan' | 'note_only' | 'off'
  onFoodLogAccess: (v: 'full' | 'no_scan' | 'note_only' | 'off') => void
  savingFoodLog: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border p-5 space-y-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Client App Settings</h3>

      {/* Daily targets toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Show daily targets</p>
          <p className="text-xs text-gray-400 mt-0.5">Display calorie &amp; macro targets on the client&apos;s home page</p>
        </div>
        <Toggle checked={showDailyTargets} onChange={onToggle} disabled={saving} />
      </div>

      {/* Cycle reminder toggle (female clients only — self-fetching) */}
      <CycleReminderToggle clientId={clientId} />

      {/* Food log access */}
      <div className="space-y-2.5">
        <div>
          <p className="text-sm font-medium text-gray-900">Food log access</p>
          <p className="text-xs text-gray-400 mt-0.5">Control what parts of the food log this client can use</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FOOD_LOG_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onFoodLogAccess(opt.value)}
              disabled={savingFoodLog}
              className={[
                'text-left rounded-xl border p-3 transition-colors disabled:opacity-50',
                foodLogAccess === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
              ].join(' ')}
            >
              <p className={`text-xs font-semibold ${foodLogAccess === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>{opt.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Weight full chart ─────────────────────────────────────────────────────────

const WC_W = 600, WC_H = 220
const WC_PAD = { top: 16, right: 16, bottom: 48, left: 56 }
const WC_IW = WC_W - WC_PAD.left - WC_PAD.right
const WC_IH = WC_H - WC_PAD.top - WC_PAD.bottom

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function WeightFullChart({ logs }: { logs: WeightLog[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const defaultUnit = logs[0]?.weight_unit === 'kg' ? 'kg' : 'lbs'
  const [unit, setUnit] = useState<'lbs' | 'kg'>(defaultUnit as 'lbs' | 'kg')
  type TooltipState = { x: number; y: number; value: string; date: string } | null
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  if (logs.length < 2) return <p className="text-sm text-gray-400">Log at least 2 entries to see the trend.</p>

  const display = [...logs].reverse().map(l => ({
    date: l.logged_at,
    value: unit === 'kg' ? l.weight_lbs / 2.20462 : l.weight_lbs,
  }))

  const values = display.map(p => p.value)
  const minVal = Math.min(...values), maxVal = Math.max(...values)
  const spread = maxVal - minVal || 1
  const yMin = minVal - spread * 0.15, yMax = maxVal + spread * 0.15

  const toX = (i: number) => WC_PAD.left + (i / (display.length - 1)) * WC_IW
  const toY = (v: number) => WC_PAD.top + WC_IH - ((v - yMin) / (yMax - yMin)) * WC_IH

  const pathD = display.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`).join(' ')
  const areaD = pathD
    + ` L ${toX(display.length - 1).toFixed(1)} ${(WC_PAD.top + WC_IH).toFixed(1)}`
    + ` L ${WC_PAD.left.toFixed(1)} ${(WC_PAD.top + WC_IH).toFixed(1)} Z`

  const labelCount = Math.min(6, display.length)
  const labelStep = Math.floor((display.length - 1) / Math.max(labelCount - 1, 1)) || 1
  const labelIndices = Array.from({ length: labelCount }, (_, k) => Math.min(k * labelStep, display.length - 1))
  const yTicks = [0, 0.33, 0.67, 1].map(t => yMin + t * (yMax - yMin))

  const delta = display[display.length - 1].value - display[0].value
  const deltaColor = delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-500' : 'text-gray-500'
  const color = delta <= 0 ? '#22c55e' : '#f87171'

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const scaleX = WC_W / rect.width
    const mouseX = (e.clientX - rect.left) * scaleX - WC_PAD.left
    const idx = Math.max(0, Math.min(display.length - 1, Math.round((mouseX / WC_IW) * (display.length - 1))))
    const p = display[idx]
    setTooltip({ x: toX(idx), y: toY(p.value), value: `${p.value.toFixed(1)} ${unit}`, date: fmtShortDate(p.date) })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">{display.length} entries</p>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${deltaColor}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} {unit}</span>
          <button
            onClick={() => setUnit(u => u === 'lbs' ? 'kg' : 'lbs')}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full transition-colors"
          >
            {unit === 'lbs' ? 'Switch to kg' : 'Switch to lbs'}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg ref={svgRef} viewBox={`0 0 ${WC_W} ${WC_H}`} className="w-full min-w-[320px]" style={{ height: 220 }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
          <defs>
            <linearGradient id="wcgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y axis label */}
          <text x={12} y={WC_PAD.top + WC_IH / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill="#9ca3af" transform={`rotate(-90, 12, ${WC_PAD.top + WC_IH / 2})`}>
            Weight ({unit})
          </text>

          {/* Y grid + tick labels */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={WC_PAD.left} x2={WC_PAD.left + WC_IW} y1={toY(v)} y2={toY(v)} stroke="#f3f4f6" strokeWidth={1} />
              <text x={WC_PAD.left - 6} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#9ca3af">
                {v.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Area + line */}
          <path d={areaD} fill="url(#wcgrad)" />
          <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Dots */}
          {display.length <= 20 && display.map((p, i) => (
            <circle key={i} cx={toX(i)} cy={toY(p.value)} r={3} fill="white" stroke={color} strokeWidth={2} />
          ))}

          {/* X axis date labels */}
          {labelIndices.map(idx => (
            <text key={idx} x={toX(idx)} y={WC_PAD.top + WC_IH + 18} textAnchor="middle" fontSize={10} fill="#9ca3af">
              {fmtShortDate(display[idx].date)}
            </text>
          ))}

          {/* X axis label */}
          <text x={WC_PAD.left + WC_IW / 2} y={WC_H - 4} textAnchor="middle" fontSize={10} fill="#9ca3af">
            Date
          </text>

          {/* Tooltip */}
          {tooltip && (
            <>
              <line x1={tooltip.x} x2={tooltip.x} y1={WC_PAD.top} y2={WC_PAD.top + WC_IH} stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={tooltip.x} cy={tooltip.y} r={5} fill={color} />
              <rect x={Math.min(tooltip.x + 8, WC_W - 110)} y={tooltip.y - 28} width={100} height={36} rx={6}
                fill="white" stroke="#e5e7eb" strokeWidth={1} filter="drop-shadow(0 1px 2px rgba(0,0,0,0.08))" />
              <text x={Math.min(tooltip.x + 58, WC_W - 60)} y={tooltip.y - 13} textAnchor="middle" fontSize={11} fontWeight="600" fill="#111827">
                {tooltip.value}
              </text>
              <text x={Math.min(tooltip.x + 58, WC_W - 60)} y={tooltip.y + 3} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {tooltip.date}
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  )
}

// ── Upcoming personal/travel events panel ────────────────────────────────────

const EV_ICONS: Record<string, string> = { personal: '📌', travel: '✈️', birthday: '🎂' }
const EV_COLOURS: Record<string, string> = {
  personal: 'bg-orange-50 text-orange-700 border-orange-200',
  travel:   'bg-sky-50 text-sky-700 border-sky-200',
  birthday: 'bg-pink-50 text-pink-700 border-pink-200',
}

type RawEvent = { id: string; type: string; title: string; event_date: string }
type GroupedEvent = { key: string; type: string; title: string; start: string; end: string }

function groupEvents(evs: RawEvent[]): GroupedEvent[] {
  const groups: GroupedEvent[] = []
  for (const ev of evs) {
    const last = groups[groups.length - 1]
    const prevDate = last ? new Date(last.end + 'T00:00:00') : null
    const thisDate = new Date(ev.event_date + 'T00:00:00')
    const isConsecutive = prevDate && (thisDate.getTime() - prevDate.getTime() === 86400000)
    if (last && isConsecutive && last.type === ev.type && last.title === ev.title) {
      last.end = ev.event_date
    } else {
      groups.push({ key: ev.id, type: ev.type, title: ev.title, start: ev.event_date, end: ev.event_date })
    }
  }
  return groups
}

function fmtEvDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function UpcomingEventsPanel({ clientId }: { clientId: string }) {
  const [events, setEvents] = useState<RawEvent[]>([])

  useEffect(() => {
    const today = new Date()
    const start = today.toISOString().split('T')[0]
    const end = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    fetch(`/api/coach/clients/${clientId}/calendar?start_date=${start}&end_date=${end}`)
      .then((r) => r.json())
      .then((d) => {
        const evs = Array.isArray(d.events) ? d.events : []
        setEvents(evs.filter((e: { type: string }) => ['personal', 'travel', 'birthday'].includes(e.type)))
      })
  }, [clientId])

  const grouped = groupEvents(events)
  if (grouped.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-amber-200 p-5">
      <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Upcoming in next 30 days</h3>
      <div className="space-y-2">
        {grouped.map((ev) => (
          <div key={ev.key} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-medium ${EV_COLOURS[ev.type] ?? 'bg-gray-50 text-gray-600 border-gray-100'}`}>
            <span className="text-sm">{EV_ICONS[ev.type] ?? '📅'}</span>
            <span className="flex-1 min-w-0 break-words">{ev.type === 'birthday' ? 'Birthday' : ev.title}</span>
            <span className="flex-shrink-0 opacity-70">
              {ev.start === ev.end ? fmtEvDate(ev.start) : `${fmtEvDate(ev.start)} – ${fmtEvDate(ev.end)}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data, clientId }: {
  data: ClientData
  clientId: string
}) {
  const latestWeight = data.weightLogs[0] ?? null
  const prevWeight = data.weightLogs[1] ?? null

  // Find true latest check-in across all types
  type AnyCheckIn =
    | { kind: 'direct'; date: string; entry: ClientData['checkIns'][number] }
    | { kind: 'form'; date: string; entry: FormCheckIn }
    | { kind: 'autoflow'; date: string; entry: AutoflowCheckIn }

  const allCheckIns: AnyCheckIn[] = [
    ...data.checkIns.map((c) => ({ kind: 'direct' as const, date: c.created_at, entry: c })),
    ...(data.formCheckIns ?? []).map((f) => ({ kind: 'form' as const, date: f.submitted_at, entry: f })),
    ...(data.autoflowCheckIns ?? []).map((a) => ({ kind: 'autoflow' as const, date: a.submitted_at, entry: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const latestCI = allCheckIns[0] ?? null

  return (
    <div className="space-y-5">

      {/* Goals + Important Notes */}
      <GoalsSection clientId={clientId} />

      {/* Upcoming personal/travel events */}
      <UpcomingEventsPanel clientId={clientId} />

      {/* Row: Latest check-in + Progress photos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Latest check-in */}
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Latest Check-In</h3>
          {!latestCI ? (
            <p className="text-sm text-gray-400">No check-ins recorded.</p>
          ) : (
            <a href={`/coach/clients/${clientId}?tab=checkins`} className="block hover:opacity-80 transition-opacity space-y-3">
              <p className="text-xs font-medium text-gray-400">{fmt(latestCI.date)}</p>
              {latestCI.kind === 'direct' && (() => {
                const c = latestCI.entry
                return (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <Stat label="Sleep" value={c.sleep_hours != null ? `${c.sleep_hours}h` : '—'} />
                      <Stat label="Energy" value={c.energy_level ? (ENERGY_LABELS[c.energy_level]?.split('–')[0].trim() ?? c.energy_level) : '—'} />
                      <Stat label="HRV" value={c.hrv != null ? `${c.hrv} ms` : '—'} />
                    </div>
                    {c.notes && <p className="text-xs text-gray-500 italic border-t border-gray-50 pt-2 line-clamp-2">"{c.notes}"</p>}
                  </>
                )
              })()}
              {latestCI.kind === 'form' && (
                <p className="text-sm font-medium text-gray-800">{latestCI.entry.title}</p>
              )}
              {latestCI.kind === 'autoflow' && (
                <p className="text-sm font-medium text-gray-800">{latestCI.entry.flow_name} — Step {latestCI.entry.step_number}</p>
              )}
              <p className="text-[11px] text-blue-500 font-medium">View all check-ins →</p>
            </a>
          )}
        </div>

        {/* Progress photos */}
        <CoachProgressPhotos clientId={clientId} />
      </div>

      {/* Row: Weight stat + Weight chart */}
      {latestWeight && (
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Current Weight</h3>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-3xl font-bold text-gray-900">
                  {latestWeight.weight_unit === 'kg'
                    ? `${(latestWeight.weight_lbs / 2.20462).toFixed(1)}`
                    : `${latestWeight.weight_lbs.toFixed(1)}`}
                </p>
                <span className="text-sm text-gray-400 font-medium">{latestWeight.weight_unit}</span>
                {prevWeight && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    latestWeight.weight_lbs < prevWeight.weight_lbs
                      ? 'bg-green-50 text-green-600'
                      : 'bg-red-50 text-red-500'
                  }`}>
                    {latestWeight.weight_lbs < prevWeight.weight_lbs ? '▼' : '▲'}
                    {' '}{Math.abs(latestWeight.weight_lbs - prevWeight.weight_lbs).toFixed(1)} lbs
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{fmt(latestWeight.logged_at)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Weight Over Time</h3>
            <WeightFullChart logs={data.weightLogs} />
          </div>
        </div>
      )}

      {/* TDEE calculator */}
      <TDEESection clientId={clientId} />

    </div>
  )
}

// ── Coach Progress Photos ─────────────────────────────────────────────────────

type ProgressPhoto = {
  id: string
  storage_path: string
  taken_at: string
  category: 'front' | 'back' | 'side_left' | 'side_right'
  notes: string | null
  weight_kg: number | null
  url: string
}

const PHOTO_CATS: { value: ProgressPhoto['category']; label: string; short: string }[] = [
  { value: 'front',      label: 'Front',      short: 'F' },
  { value: 'back',       label: 'Back',       short: 'B' },
  { value: 'side_left',  label: 'Left Side',  short: 'L' },
  { value: 'side_right', label: 'Right Side', short: 'R' },
]

const PHOTO_CAT_COLORS: Record<ProgressPhoto['category'], string> = {
  front:      'bg-blue-100 text-blue-700',
  back:       'bg-purple-100 text-purple-700',
  side_left:  'bg-teal-100 text-teal-700',
  side_right: 'bg-orange-100 text-orange-700',
}

function photoCatLabel(c: ProgressPhoto['category']) {
  return PHOTO_CATS.find(x => x.value === c)?.label ?? c
}

function photoFmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function photoFmtMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

// Compare panel — mirrors client app ComparePanel
function PhotoComparePanel({ label, photo, onSelect }: {
  label: string
  photo: ProgressPhoto | null
  onSelect: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-500 text-center uppercase tracking-wide">{label}</p>
      <button onClick={onSelect}
        className={`w-full aspect-[3/4] rounded-xl overflow-hidden relative group ${
          !photo ? 'border-2 border-dashed border-gray-200 hover:border-gray-300 bg-gray-50' : ''
        }`}>
        {photo ? (
          <>
            <img src={photo.url} alt={photoCatLabel(photo.category)} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/50 px-3 py-1.5 rounded-lg transition-opacity">Change</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-3">
              <p className="text-white text-xs font-bold">{photoFmtDate(photo.taken_at)}</p>
              <p className="text-white/70 text-xs">{photoCatLabel(photo.category)}{photo.weight_kg ? ` · ${photo.weight_kg}kg` : ''}</p>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium">Select photo</span>
          </div>
        )}
      </button>
    </div>
  )
}

// Pick-photo modal — mirrors client app PickPhotoModal
function PhotoPickModal({ photos, onPick, onClose }: {
  photos: ProgressPhoto[]
  onPick: (p: ProgressPhoto) => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState<ProgressPhoto['category'] | 'all'>('all')
  const filtered = filter === 'all' ? photos : photos.filter(p => p.category === filter)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl w-full max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="font-bold text-gray-900">Select photo</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 px-5 py-3 border-b border-gray-50 flex-shrink-0 overflow-x-auto">
          {(['all', ...PHOTO_CATS.map(c => c.value)] as (ProgressPhoto['category'] | 'all')[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === f ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}>
              {f === 'all' ? 'All' : photoCatLabel(f)}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No photos in this category</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map(photo => (
                <button key={photo.id} onClick={() => { onPick(photo); onClose() }}
                  className="aspect-[3/4] rounded-xl overflow-hidden relative group">
                  <img src={photo.url} alt={photoCatLabel(photo.category)} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute top-1.5 left-1.5">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${PHOTO_CAT_COLORS[photo.category]}`}>
                      {photoCatLabel(photo.category).charAt(0)}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-white text-xs font-medium leading-tight">{photoFmtDate(photo.taken_at)}</p>
                    {photo.weight_kg && <p className="text-white/70 text-xs">{photo.weight_kg}kg</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CoachProgressPhotos({ clientId }: { clientId: string }) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState<ProgressPhoto['category'] | 'all'>('all')
  const [compareMode, setCompareMode] = useState(false)
  const [compareLeft, setCompareLeft] = useState<ProgressPhoto | null>(null)
  const [compareRight, setCompareRight] = useState<ProgressPhoto | null>(null)
  const [pickingFor, setPickingFor] = useState<'left' | 'right' | null>(null)
  const [lightbox, setLightbox] = useState<ProgressPhoto | null>(null)

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/progress-photos`)
      .then((r) => r.json())
      .then((d) => setPhotos(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [clientId])

  const filtered = filterCat === 'all' ? photos : photos.filter((p) => p.category === filterCat)

  const byMonth: Record<string, ProgressPhoto[]> = {}
  for (const p of filtered) {
    const key = p.taken_at.slice(0, 7)
    ;(byMonth[key] ??= []).push(p)
  }

  const weightDelta = compareLeft?.weight_kg && compareRight?.weight_kg
    ? (compareRight.weight_kg - compareLeft.weight_kg).toFixed(1)
    : null

  return (
    <div className="bg-white rounded-2xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Progress Photos</h3>
        {photos.length >= 2 && (
          <button onClick={() => setCompareMode(m => !m)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              compareMode ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700 hover:border-gray-400'
            }`}>
            Compare
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-gray-400">No progress photos uploaded yet.</p>
      ) : (
        <div className="space-y-4">

          {/* Compare view */}
          {compareMode && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Side-by-side comparison</p>
              <div className="grid grid-cols-2 gap-3">
                <PhotoComparePanel label="Before" photo={compareLeft} onSelect={() => setPickingFor('left')} />
                <PhotoComparePanel label="After" photo={compareRight} onSelect={() => setPickingFor('right')} />
              </div>
              {weightDelta !== null && (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-xs font-medium text-gray-500">Weight change</span>
                  <span className={`text-sm font-bold ${
                    parseFloat(weightDelta) < 0 ? 'text-teal-600' :
                    parseFloat(weightDelta) > 0 ? 'text-orange-500' : 'text-gray-600'
                  }`}>
                    {parseFloat(weightDelta) > 0 ? '+' : ''}{weightDelta}kg
                  </span>
                </div>
              )}
              {compareLeft && compareRight && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400">
                    {(() => {
                      const [ly, lm, ld] = compareLeft.taken_at.split('-').map(Number)
                      const [ry, rm, rd] = compareRight.taken_at.split('-').map(Number)
                      const days = Math.abs(Math.round((new Date(ry, rm - 1, rd).getTime() - new Date(ly, lm - 1, ld).getTime()) / 86400000))
                      return days === 0 ? 'Same day' : `${days} days between photos`
                    })()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Category filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {(['all', ...PHOTO_CATS.map(c => c.value)] as (ProgressPhoto['category'] | 'all')[]).map(f => (
              <button key={f} onClick={() => setFilterCat(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  filterCat === f ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
                {f === 'all' ? `All (${photos.length})` : photoCatLabel(f)}
              </button>
            ))}
          </div>

          {/* Gallery grouped by month */}
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400">No photos in this category.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(byMonth)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([ym, group]) => (
                  <div key={ym}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{photoFmtMonth(ym)}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {group.map((p) => (
                        <button key={p.id} onClick={() => setLightbox(p)}
                          className="aspect-[3/4] rounded-xl overflow-hidden relative group">
                          <img src={p.url} alt={photoCatLabel(p.category)} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          <div className="absolute top-1.5 left-1.5">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${PHOTO_CAT_COLORS[p.category]}`}>
                              {photoCatLabel(p.category).charAt(0)}
                            </span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent p-2">
                            <p className="text-white text-xs font-medium leading-tight">{photoFmtDate(p.taken_at)}</p>
                            {p.weight_kg && <p className="text-white/70 text-xs">{p.weight_kg}kg</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <div className="absolute inset-0 bg-black/85" />
          <div className="relative w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={photoCatLabel(lightbox.category)}
              className="w-full max-h-[75vh] object-contain rounded-2xl" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-2xl p-5">
              <p className="text-white font-bold text-base">{photoFmtDate(lightbox.taken_at)}</p>
              <p className="text-white/70 text-sm mt-0.5">
                {photoCatLabel(lightbox.category)}{lightbox.weight_kg ? ` · ${lightbox.weight_kg}kg` : ''}
              </p>
              {lightbox.notes && <p className="text-white/60 text-xs mt-1">{lightbox.notes}</p>}
            </div>
            <button onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Pick photo modal */}
      {pickingFor && (
        <PhotoPickModal
          photos={photos}
          onPick={(p) => {
            if (pickingFor === 'left') setCompareLeft(p)
            else setCompareRight(p)
          }}
          onClose={() => setPickingFor(null)}
        />
      )}
    </div>
  )
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

// ── Rich text toolbar ─────────────────────────────────────────────────────────

const FONT_COLORS = ['#111827', '#ef4444', '#f97316', '#eab308', '#22c55e', '#1D9E75', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

function RichToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const highlightInputRef = useRef<HTMLInputElement>(null)

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        type="button"
        title={title}
        onMouseDown={(e) => { e.preventDefault(); onClick() }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900 text-sm font-semibold select-none"
      >
        {children}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-0.5 flex-wrap border border-gray-200 rounded-xl px-2 py-1.5 bg-gray-50">
      <ToolBtn title="Bold" onClick={() => exec('bold')}><span className="font-bold">B</span></ToolBtn>
      <ToolBtn title="Italic" onClick={() => exec('italic')}><span className="italic">I</span></ToolBtn>
      <ToolBtn title="Underline" onClick={() => exec('underline')}><span className="underline">U</span></ToolBtn>
      <ToolBtn title="Strikethrough" onClick={() => exec('strikeThrough')}><span className="line-through">S</span></ToolBtn>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      {/* Font color swatches */}
      {FONT_COLORS.map(c => (
        <button
          key={c}
          type="button"
          title={`Colour ${c}`}
          onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c) }}
          className="w-5 h-5 rounded-full border border-white shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: c }}
        />
      ))}
      {/* Custom colour picker */}
      <button
        type="button"
        title="Custom colour"
        onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click() }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>
      <input ref={colorInputRef} type="color" className="sr-only" onChange={e => exec('foreColor', e.target.value)} />

      <div className="w-px h-5 bg-gray-200 mx-1" />

      {/* Highlight */}
      <ToolBtn title="Highlight" onClick={() => highlightInputRef.current?.click()}>
        <span style={{ background: 'linear-gradient(transparent 50%, #fde047 50%)' }} className="px-0.5">H</span>
      </ToolBtn>
      <input ref={highlightInputRef} type="color" defaultValue="#fde047" className="sr-only" onChange={e => exec('hiliteColor', e.target.value)} />

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <ToolBtn title="Heading" onClick={() => exec('formatBlock', '<h3>')}><span className="font-bold text-xs">H</span></ToolBtn>
      <ToolBtn title="Paragraph" onClick={() => exec('formatBlock', '<p>')}><span className="text-xs">¶</span></ToolBtn>
      <ToolBtn title="Bullet list" onClick={() => exec('insertUnorderedList')}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </ToolBtn>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <ToolBtn title="Clear formatting" onClick={() => exec('removeFormat')}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </ToolBtn>
    </div>
  )
}

function NotesTab({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<{ id: string; name: string; body: string }[]>([])
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/coach/notes/${clientId}`).then((r) => r.json()),
      fetch('/api/coach/note-templates').then((r) => r.json()),
    ]).then(([notesData, tmplData]) => {
      setNotes(Array.isArray(notesData) ? notesData : [])
      setTemplates(Array.isArray(tmplData) ? tmplData : [])
    }).finally(() => setLoading(false))
  }, [clientId])

  function getHtml() { return editorRef.current?.innerHTML ?? '' }

  async function doSave(html: string, noteId: string | null): Promise<string | null> {
    const stripped = html.replace(/<[^>]*>/g, '').trim()
    if (!stripped) return noteId
    setSaveStatus('saving')
    if (noteId) {
      const res = await fetch(`/api/coach/notes/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, body: html }),
      })
      if (res.ok) {
        const updated = await res.json()
        setNotes((prev) => prev.map((n) => n.id === noteId ? updated : n))
      }
      setSaveStatus('saved')
      return noteId
    } else {
      const res = await fetch(`/api/coach/notes/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: html }),
      })
      if (res.ok) {
        const note = await res.json()
        setNotes((prev) => [note, ...prev])
        setSaveStatus('saved')
        return note.id
      }
      setSaveStatus('idle')
      return null
    }
  }

  function scheduleAutoSave() {
    setSaveStatus('idle')
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      const html = getHtml()
      const id = await doSave(html, currentNoteId)
      if (id && !currentNoteId) setCurrentNoteId(id)
    }, 1500)
  }

  function startNew() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (editorRef.current) editorRef.current.innerHTML = ''
    setCurrentNoteId(null)
    setSaveStatus('idle')
  }

  function editNote(note: Note) {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (editorRef.current) editorRef.current.innerHTML = note.body
    setCurrentNoteId(note.id)
    setSaveStatus('saved')
    editorRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteNote(id: string) {
    await fetch(`/api/coach/notes/${clientId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId: id }),
    })
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (currentNoteId === id) startNew()
  }

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">Loading notes…</p>

  return (
    <div className="space-y-4">
      {/* Editor */}
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentNoteId && (
              <button onClick={startNew} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {currentNoteId ? 'Editing note' : 'New note'}
            </label>
            {saveStatus === 'saving' && <span className="text-[11px] text-gray-400">Saving…</span>}
            {saveStatus === 'saved' && <span className="text-[11px] text-green-500">Saved</span>}
          </div>
          <div className="flex items-center gap-3">
            {templates.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => {
                  const t = templates.find((t) => t.id === e.target.value)
                  if (t && editorRef.current) {
                    editorRef.current.innerHTML = noteBodyToHtml(t.body)
                    scheduleAutoSave()
                    e.target.value = ''
                  }
                }}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="" disabled>Use template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {templates.length === 0 && (
              <a href="/coach/note-templates" className="text-xs text-blue-500 hover:underline">+ Create templates</a>
            )}
          </div>
        </div>

        <RichToolbar editorRef={editorRef} />

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={scheduleAutoSave}
          data-placeholder="Write a note about this client… or pick a template above"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed overflow-auto prose prose-sm max-w-none"
          style={{ minHeight: '55vh' }}
        />
      </div>

      {/* Notes history */}
      {notes.length === 0 && <Empty label="No notes yet." />}
      {notes.map((note) => (
        <div key={note.id} className={`bg-white rounded-2xl border p-5 group relative transition-all ${currentNoteId === note.id ? 'border-blue-300 bg-blue-50' : ''}`}>
          <div
            className="text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: note.body }}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">{fmtFull(note.created_at)}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => editNote(note)} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
                Edit
              </button>
              <button onClick={() => deleteNote(note.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Files tab ─────────────────────────────────────────────────────────────────

type ClientFile = { id?: string; url: string; label: string; formTitle: string; submittedAt: string; source?: string }

function FilesTab({ clientId }: { clientId: string }) {
  const [files, setFiles] = useState<ClientFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function loadFiles() {
    return fetch(`/api/coach/clients/${clientId}/files`)
      .then((r) => r.json())
      .then((d) => setFiles(Array.isArray(d) ? d : []))
  }

  useEffect(() => {
    loadFiles().finally(() => setLoading(false))
  }, [clientId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)

    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `coach-uploads/${clientId}/${Date.now()}.${ext}`

    const { data: storageData, error: storageError } = await supabase.storage
      .from('client-uploads')
      .upload(path, file, { upsert: false })

    if (storageError || !storageData) {
      setUploadError(storageError?.message ?? 'Upload failed')
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const { data: urlData } = supabase.storage.from('client-uploads').getPublicUrl(storageData.path)
    const publicUrl = urlData.publicUrl

    const res = await fetch(`/api/coach/clients/${clientId}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: publicUrl, name: file.name }),
    })

    if (!res.ok) {
      const d = await res.json()
      setUploadError(d.error ?? 'Failed to save file record')
    } else {
      await loadFiles()
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function startRename(file: ClientFile) {
    setRenamingId(file.id!)
    setRenameValue(file.label)
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return
    const res = await fetch(`/api/coach/clients/${clientId}/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    if (res.ok) {
      setFiles((prev) => prev.map((f) => f.id === id ? { ...f, label: renameValue.trim() } : f))
    }
    setRenamingId(null)
  }

  async function handleDelete(file: ClientFile) {
    if (!confirm(`Delete "${file.label}"? This cannot be undone.`)) return
    setDeletingId(file.id!)
    const res = await fetch(`/api/coach/clients/${clientId}/files/${file.id}`, { method: 'DELETE' })
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
    }
    setDeletingId(null)
  }

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">Loading files…</p>

  return (
    <div className="space-y-3">
      {/* Upload section */}
      <div className="bg-white rounded-2xl border p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upload file for client</p>
        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${uploading ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? 'Uploading…' : 'Choose file'}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        </div>
      </div>

      {files.length === 0 && <Empty label="No files uploaded yet." />}
      {files.map((f, i) => {
        const isFormResponse = f.source === 'form'
        const filename = isFormResponse ? '' : decodeURIComponent(f.url.split('/').pop()?.split('?')[0] ?? 'file')
        const ext = filename.split('.').pop()?.toLowerCase() ?? ''
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)
        return (
          <div key={i} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${isFormResponse ? 'border-indigo-100' : ''}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isFormResponse ? 'bg-indigo-50' : 'bg-blue-50'}`}>
              {isFormResponse ? (
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              ) : isImage ? (
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {renamingId === f.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(f.id!); if (e.key === 'Escape') setRenamingId(null) }}
                    className="text-sm border border-blue-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
                  />
                  <button onClick={() => handleRename(f.id!)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Save</button>
                  <button onClick={() => setRenamingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate">{f.label}</p>
                  {isFormResponse && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-500 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">Form</span>
                  )}
                  {f.source === 'coach' && (
                    <span className="text-[10px] bg-purple-50 text-purple-500 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">Coach</span>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400">{f.formTitle} · {fmtFull(f.submittedAt)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={f.url}
                target={isFormResponse ? '_self' : '_blank'}
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {isFormResponse ? 'View response' : 'View'}
              </a>
              {f.source === 'coach' && f.id && renamingId !== f.id && (
                <>
                  <button
                    onClick={() => startRename(f)}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(f)}
                    disabled={deletingId === f.id}
                    className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50"
                  >
                    {deletingId === f.id ? '…' : 'Delete'}
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Program tab ───────────────────────────────────────────────────────────────

type PMetrics = 'weight+reps' | 'reps' | 'weight+time' | 'time' | 'calories'
const PMETRICS_LABELS: Record<PMetrics, string> = {
  'weight+reps': 'Wt + Reps', 'reps': 'Reps only', 'weight+time': 'Wt + Time',
  'time': 'Time', 'calories': 'Cals',
}
type PMetricsCfg = { col1: string; col2?: string; f1: keyof PSet; f2?: keyof PSet }
const PMETRICS_CONFIG: Record<PMetrics, PMetricsCfg> = {
  'weight+reps': { col1: 'Weight', col2: 'Reps',       f1: 'weight',   f2: 'reps'     },
  'reps':        { col1: 'Reps',                        f1: 'reps'                      },
  'weight+time': { col1: 'Weight', col2: 'Time (sec)',  f1: 'weight',   f2: 'duration' },
  'time':        { col1: 'Time (sec)',                  f1: 'duration'                  },
  'calories':    { col1: 'Calories', col2: 'Time (sec)',f1: 'calories', f2: 'duration' },
}
type PSet = { id: string; setNumber: number; weight: string; reps: string; duration: string; calories: string; rest: string }
type PLibEx = { id: string; name: string; category: string; equipment: string; muscles?: string; video_url?: string | null }
type PExercise = {
  type: 'exercise'; id: string; exercise_id: string | null
  name: string; category: string; equipment: string; video_url: string
  metrics: PMetrics; showRest: boolean; sets: PSet[]; notes: string
}
type PScoreType = 'time' | 'reps' | 'rounds' | 'weight' | 'distance' | 'calories' | 'custom'
type PSection = { type: 'section'; id: string; title: string; notes: string; scoreType: PScoreType | 'none'; scoreValue: string }
type PDayItem = PExercise | PSection
type PDay = { id: string; name: string; items: PDayItem[] }
type PWeek = { id: string; label: string; days: PDay[] }

type ClientProgram = {
  id: string
  program_id: string | null
  name: string
  content: PWeek[]
  start_date: string
  status: string
  created_at: string
  updated_at: string
}

type ProgramTemplate = {
  id: string
  name: string
  description: string | null
  week_count: number
}

const PCATS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other']

function pNewSet(num: number, prev?: PSet): PSet {
  return { id: crypto.randomUUID(), setNumber: num, weight: prev?.weight ?? '', reps: prev?.reps ?? '', duration: prev?.duration ?? '', calories: prev?.calories ?? '', rest: prev?.rest ?? '' }
}
function pNewEx(lib?: PLibEx): PExercise {
  return { type: 'exercise', id: crypto.randomUUID(), exercise_id: lib?.id ?? null, name: lib?.name ?? '', category: lib?.category ?? '', equipment: lib?.equipment ?? '', video_url: lib?.video_url ?? '', metrics: lib?.category === 'cardio' ? 'calories' : 'weight+reps', showRest: false, sets: [pNewSet(1)], notes: '' }
}
function pNewSection(): PSection { return { type: 'section', id: crypto.randomUUID(), title: '', notes: '', scoreType: 'none', scoreValue: '' } }
function pNewDay(n: number): PDay { return { id: crypto.randomUUID(), name: `Day ${n}`, items: [] } }
function pNewWeek(n: number): PWeek { return { id: crypto.randomUUID(), label: `Week ${n}`, days: [] } }
function pCloneWeek(src: PWeek, label: string): PWeek {
  return { id: crypto.randomUUID(), label, days: src.days.map((d) => ({ ...d, id: crypto.randomUUID(), items: d.items.map((it) => ({ ...it, id: crypto.randomUUID(), ...(it.type === 'exercise' ? { sets: it.sets.map((s) => ({ ...s, id: crypto.randomUUID() })) } : {}) })) as PDayItem[] })) }
}

// Migrate old content formats to new PWeek[] format
function migrateOldPEx(ex: Record<string, unknown>): PExercise {
  const n = Number(ex.sets) || 3
  return {
    type: 'exercise', id: (ex.id as string) || crypto.randomUUID(), exercise_id: (ex.exercise_id as string | null) || null,
    name: (ex.name as string) || '', category: (ex.category as string) || '', equipment: (ex.equipment as string) || '',
    video_url: (ex.video_url as string) || '', metrics: 'weight+reps', showRest: false,
    sets: Array.from({ length: n }, (_, i) => ({ id: crypto.randomUUID(), setNumber: i + 1, weight: String(ex.weight || ''), reps: String(ex.reps || '8-12'), duration: '', calories: '', rest: '' })),
    notes: (ex.notes as string) || '',
  }
}
function migratePDay(raw: Record<string, unknown>): PDay {
  if (Array.isArray(raw.items)) {
    const items = (raw.items as PDayItem[]).map((item) => {
      if (item.type === 'section') {
        return { ...item, scoreType: (item as PSection).scoreType ?? 'none', scoreValue: (item as PSection).scoreValue ?? '' } as PSection
      }
      return item
    })
    return { ...(raw as unknown as PDay), items }
  }
  const items: PDayItem[] = []
  if (Array.isArray(raw.sections)) {
    for (const sec of raw.sections as Record<string, unknown>[]) {
      if ((sec.title as string)?.trim()) items.push({ type: 'section', id: crypto.randomUUID(), title: sec.title as string, notes: '', scoreType: 'none', scoreValue: '' })
      for (const ex of (sec.exercises as Record<string, unknown>[]) || []) items.push(migrateOldPEx(ex))
    }
  } else {
    for (const ex of (raw.exercises as Record<string, unknown>[]) || []) items.push(migrateOldPEx(ex))
  }
  return { id: (raw.id as string) || crypto.randomUUID(), name: (raw.name as string) || 'Day', items }
}
function migratePContent(content: unknown[]): PWeek[] {
  return content.map((w) => {
    const wk = w as Record<string, unknown>
    return { id: (wk.id as string) || crypto.randomUUID(), label: (wk.label as string) || 'Week', days: ((wk.days as Record<string, unknown>[]) || []).map(migratePDay) }
  })
}

// ── Program sub-components ────────────────────────────────────────────────────

function PMoveButtons({ onUp, onDown, canUp, canDown }: { onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <button onClick={onUp} disabled={!canUp} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-default transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
      </button>
      <button onClick={onDown} disabled={!canDown} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-default transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  )
}

function PExercisePicker({ onSelect, onClose }: { onSelect: (ex: PLibEx) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PLibEx[]>([])
  const [recent, setRecent] = useState<PLibEx[]>([])
  const [category, setCategory] = useState('all')
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCategory, setCreateCategory] = useState('other')
  const [createEquipment, setCreateEquipment] = useState('bodyweight')
  const [createSaving, setCreateSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetch('/api/exercises/recent').then((r) => r.json()).then(setRecent).catch(() => {})
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ q: query })
      if (category !== 'all') p.set('category', category)
      const res = await fetch(`/api/exercises/search?${p}`)
      setResults(await res.json())
    }, 250)
    return () => clearTimeout(t)
  }, [query, category])

  async function handleCreate() {
    if (!createName.trim()) return
    setCreateSaving(true)
    const res = await fetch('/api/exercises/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: createName, category: createCategory, equipment: createEquipment }) })
    setCreateSaving(false)
    if (res.ok) onSelect(await res.json())
  }

  const list = query.length >= 2 ? results : recent

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercise library…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-1">✕</button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {['all', ...PCATS].map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {query.length >= 2 && !creating && (
          <button onClick={() => { setCreateName(query); setCreating(true) }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 border-b transition-colors">
            + Create &quot;{query}&quot; as custom exercise
          </button>
        )}
        {creating && (
          <div className="p-3 space-y-2 bg-gray-50 border-b">
            <input autoFocus value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Exercise name"
              className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="flex gap-2">
              <select value={createCategory} onChange={(e) => setCreateCategory(e.target.value)} className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                {PCATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={createEquipment} onChange={(e) => setCreateEquipment(e.target.value)} className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                {['bodyweight','barbell','dumbbell','machine','cable','kettlebell','bands','other'].map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={createSaving || !createName.trim()}
                className="flex-1 bg-blue-600 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createSaving ? 'Creating…' : 'Add exercise'}
              </button>
              <button onClick={() => setCreating(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
            </div>
          </div>
        )}
        {query.length < 2 && recent.length > 0 && <p className="text-xs text-gray-400 font-medium px-3 pb-1">Recently used</p>}
        {list.length === 0 && query.length < 2 && !creating && <p className="text-sm text-gray-400 text-center py-4">Type to search exercises</p>}
        {list.length === 0 && query.length >= 2 && !creating && <p className="text-sm text-gray-400 text-center py-4">No exercises found</p>}
        {list.map((ex) => (
          <button key={ex.id} onClick={() => onSelect(ex)} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-gray-900">{ex.name}</p>
            <p className="text-xs text-gray-400 capitalize">{ex.category} · {ex.equipment}{ex.muscles ? ` · ${ex.muscles}` : ''}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

const P_SCORE_TYPES: Array<PScoreType | 'none'> = ['none', 'time', 'rounds', 'reps', 'weight', 'distance', 'calories', 'custom']
const P_SCORE_LABEL: Record<PScoreType | 'none', string> = {
  none: 'No score', time: 'Time', rounds: 'Rounds+Reps', reps: 'Reps', weight: 'Weight', distance: 'Distance', calories: 'Calories', custom: 'Custom',
}

function PSectionScoreInput({ scoreType, value, onChange }: { scoreType: PScoreType | 'none'; value: string; onChange: (v: string) => void }) {
  if (scoreType === 'none') return null
  if (scoreType === 'time') {
    const [mm, ss] = value.split(':')
    return (
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} placeholder="00" value={mm ?? ''} onChange={(e) => onChange(`${e.target.value}:${ss ?? '00'}`)}
          className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-gray-400 font-medium">:</span>
        <input type="number" min={0} max={59} placeholder="00" value={ss ?? ''} onChange={(e) => onChange(`${mm ?? '0'}:${e.target.value}`)}
          className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-xs text-gray-400">min : sec (target / cap)</span>
      </div>
    )
  }
  if (scoreType === 'rounds') {
    const [r, rp] = value.split('+')
    return (
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} placeholder="0" value={r ?? ''} onChange={(e) => onChange(`${e.target.value}+${rp ?? '0'}`)}
          className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-gray-400 font-medium">+</span>
        <input type="number" min={0} placeholder="0" value={rp ?? ''} onChange={(e) => onChange(`${r ?? '0'}+${e.target.value}`)}
          className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-300" />
        <span className="text-xs text-gray-400">rounds + reps (target)</span>
      </div>
    )
  }
  const units: Partial<Record<PScoreType, string>> = { reps: 'reps', weight: 'kg / lbs', distance: 'm', calories: 'cals' }
  return (
    <div className="flex items-center gap-2">
      <input type={scoreType === 'custom' ? 'text' : 'number'} min={0} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={scoreType === 'custom' ? 'e.g. Rx, scaled, 21-15-9…' : '0'}
        className="w-36 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-300" />
      {units[scoreType] && <span className="text-xs text-gray-400">{units[scoreType]} (target)</span>}
    </div>
  )
}

function PSectionBlock({ section, canUp, canDown, onChange, onRemove, onMoveUp, onMoveDown }: {
  section: PSection; canUp: boolean; canDown: boolean
  onChange: (s: PSection) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PMoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">Section</span>
        <input value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })}
          placeholder="Section title (e.g. Warm Up, Metcon, WOD)"
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-gray-300 min-w-0" />
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0">×</button>
      </div>
      <textarea value={section.notes} onChange={(e) => onChange({ ...section, notes: e.target.value })}
        placeholder="Add notes, WOD description, or instructions…"
        rows={3}
        className="w-full text-sm text-gray-700 border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 placeholder:text-gray-300" />
      {/* Score type */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Score type</p>
        <div className="flex gap-1.5 flex-wrap">
          {P_SCORE_TYPES.map((t) => (
            <button key={t} onClick={() => onChange({ ...section, scoreType: t, scoreValue: '' })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${section.scoreType === t ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {P_SCORE_LABEL[t]}
            </button>
          ))}
        </div>
        <PSectionScoreInput scoreType={section.scoreType} value={section.scoreValue}
          onChange={(v) => onChange({ ...section, scoreValue: v })} />
      </div>
    </div>
  )
}

function PExerciseBlock({ we, canUp, canDown, onMoveUp, onMoveDown, onChange, onRemove }: {
  we: PExercise; canUp: boolean; canDown: boolean
  onMoveUp: () => void; onMoveDown: () => void
  onChange: (u: PExercise) => void; onRemove: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const cfg = PMETRICS_CONFIG[we.metrics]
  const hasTwoCols = !!cfg.col2
  const gridCols = we.showRest
    ? hasTwoCols ? 'grid-cols-[24px_1fr_1fr_72px_28px]' : 'grid-cols-[24px_1fr_72px_28px]'
    : hasTwoCols ? 'grid-cols-[24px_1fr_1fr_28px]'    : 'grid-cols-[24px_1fr_28px]'

  function updateSet(setId: string, field: keyof PSet, value: string) {
    onChange({ ...we, sets: we.sets.map((s) => s.id === setId ? { ...s, [field]: value } : s) })
  }
  function addSet() {
    const prev = we.sets[we.sets.length - 1]
    onChange({ ...we, sets: [...we.sets, pNewSet(we.sets.length + 1, prev)] })
  }
  function removeSet(setId: string) {
    const sets = we.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 }))
    onChange({ ...we, sets })
  }
  function handleLibSelect(lib: PLibEx) {
    onChange({ ...we, exercise_id: lib.id, name: lib.name, category: lib.category, equipment: lib.equipment, video_url: lib.video_url ?? '', metrics: lib.category === 'cardio' ? 'calories' : we.metrics })
    setShowPicker(false)
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-start gap-2">
        <PMoveButtons onUp={onMoveUp} onDown={onMoveDown} canUp={canUp} canDown={canDown} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{we.name || <span className="text-gray-300 italic font-normal">Unnamed exercise</span>}</p>
          {(we.category || we.equipment) && <p className="text-xs text-gray-400 capitalize mt-0.5">{we.category}{we.equipment ? ` · ${we.equipment}` : ''}</p>}
        </div>
        <button onClick={() => setShowPicker(true)}
          className="text-xs text-blue-500 hover:text-blue-700 border border-blue-100 rounded-lg px-2 py-1 flex-shrink-0 font-medium transition-colors">
          {we.exercise_id ? 'Change' : 'Search'}
        </button>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0">×</button>
      </div>
      {showPicker && <PExercisePicker onSelect={handleLibSelect} onClose={() => setShowPicker(false)} />}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(Object.keys(PMETRICS_LABELS) as PMetrics[]).map((m) => (
          <button key={m} onClick={() => onChange({ ...we, metrics: m })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${we.metrics === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {PMETRICS_LABELS[m]}
          </button>
        ))}
        <button onClick={() => onChange({ ...we, showRest: !we.showRest })}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ml-auto ${we.showRest ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          ⏱ Rest
        </button>
      </div>
      <div className={`${gridCols} gap-2 text-xs text-gray-400 font-medium px-1 grid`}>
        <span className="text-center">#</span>
        <span className="text-center">{cfg.col1}</span>
        {cfg.col2 && <span className="text-center">{cfg.col2}</span>}
        {we.showRest && <span className="text-center">Rest (s)</span>}
        <span />
      </div>
      {we.sets.map((set) => (
        <div key={set.id} className={`${gridCols} gap-2 items-center grid`}>
          <span className="text-sm text-gray-500 text-center">{set.setNumber}</span>
          <input type="text" placeholder="—" value={set[cfg.f1] as string}
            onChange={(e) => updateSet(set.id, cfg.f1, e.target.value)}
            className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300" />
          {cfg.col2 && cfg.f2 && (
            <input type="text" placeholder="—" value={set[cfg.f2] as string}
              onChange={(e) => updateSet(set.id, cfg.f2!, e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300" />
          )}
          {we.showRest && (
            <input type="number" inputMode="numeric" placeholder="90" value={set.rest}
              onChange={(e) => updateSet(set.id, 'rest', e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-300" />
          )}
          <button onClick={() => removeSet(set.id)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 text-xl">×</button>
        </div>
      ))}
      <button onClick={addSet} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Set</button>
      <textarea value={we.notes} onChange={(e) => onChange({ ...we, notes: e.target.value })}
        placeholder="Coaching notes, cues, or tempo…"
        rows={we.notes ? 2 : 1}
        className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300" />
    </div>
  )
}

function PDayEditor({ day, onChange, onClose }: { day: PDay; onChange: (d: PDay) => void; onClose: () => void }) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  function updateItem(i: number, item: PDayItem) {
    const items = [...day.items]; items[i] = item; onChange({ ...day, items })
  }
  function removeItem(i: number) {
    onChange({ ...day, items: day.items.filter((_, idx) => idx !== i) })
  }
  function moveItem(i: number, dir: 'up' | 'down') {
    const next = dir === 'up' ? i - 1 : i + 1
    if (next < 0 || next >= day.items.length) return
    const items = [...day.items];
    [items[i], items[next]] = [items[next], items[i]]
    onChange({ ...day, items })
  }
  function addExercise(lib: PLibEx) {
    onChange({ ...day, items: [...day.items, pNewEx(lib)] })
    setShowSearch(false); setShowAddMenu(false)
  }
  function addSection() {
    onChange({ ...day, items: [...day.items, pNewSection()] })
    setShowAddMenu(false)
  }

  return (
    <div className="border-t border-blue-100 bg-blue-50/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">{day.name}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕ Close</button>
      </div>
      <div className="space-y-3">
        {day.items.length === 0 && !showSearch && (
          <p className="text-sm text-gray-400 text-center py-4">No exercises yet. Add one below.</p>
        )}
        {day.items.map((item, i) =>
          item.type === 'exercise' ? (
            <PExerciseBlock key={item.id} we={item}
              canUp={i > 0} canDown={i < day.items.length - 1}
              onMoveUp={() => moveItem(i, 'up')} onMoveDown={() => moveItem(i, 'down')}
              onChange={(u) => updateItem(i, u)} onRemove={() => removeItem(i)} />
          ) : (
            <PSectionBlock key={item.id} section={item}
              canUp={i > 0} canDown={i < day.items.length - 1}
              onChange={(u) => updateItem(i, u)} onRemove={() => removeItem(i)}
              onMoveUp={() => moveItem(i, 'up')} onMoveDown={() => moveItem(i, 'down')} />
          )
        )}
        {showSearch && <PExercisePicker onSelect={addExercise} onClose={() => { setShowSearch(false); setShowAddMenu(false) }} />}
        {!showSearch && (
          showAddMenu ? (
            <div className="flex gap-2">
              <button onClick={() => setShowSearch(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Add Exercise
              </button>
              <button onClick={addSection}
                className="flex-1 flex items-center justify-center gap-2 border border-purple-200 text-purple-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-purple-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                Add Section
              </button>
              <button onClick={() => setShowAddMenu(false)}
                className="w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl text-lg">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddMenu(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add
            </button>
          )
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full">Active</span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">Completed</span>
    )
  }
  return (
    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full capitalize">{status}</span>
  )
}

function AssignedProgramCard({
  assignment,
  clientId,
  onUnassign,
  onUpdated,
  onSaveAsTemplate,
  savingTemplateId,
  savedTemplateId,
}: {
  assignment: ClientProgram
  clientId: string
  onUnassign: (id: string) => void
  onUpdated: (updated: ClientProgram) => void
  onSaveAsTemplate?: (id: string) => void
  savingTemplateId?: string | null
  savedTemplateId?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [localContent, setLocalContent] = useState<PWeek[]>(() =>
    migratePContent(Array.isArray(assignment.content) ? assignment.content : [])
  )
  const [editingStartDate, setEditingStartDate] = useState(false)
  const [localStartDate, setLocalStartDate] = useState(assignment.start_date)
  // selectedDay: [weekIndex, dayIndex] | null
  const [selectedDay, setSelectedDay] = useState<[number, number] | null>(null)
  const [dragFrom, setDragFrom] = useState<[number, number] | null>(null)
  const [dragOver, setDragOver] = useState<[number, number] | null>(null)
  const [renamingDay, setRenamingDay] = useState<[number, number] | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dayEditorRef = useRef<HTMLDivElement>(null)

  // Scroll to day editor when a day is selected
  useEffect(() => {
    if (selectedDay && dayEditorRef.current) {
      dayEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedDay])

  // Compute end date from start + weeks
  const numWeeks = localContent.length
  const startDateObj = new Date(localStartDate + 'T00:00:00')
  const endDateObj = new Date(startDateObj)
  endDateObj.setDate(startDateObj.getDate() + numWeeks * 7 - 1)
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  function updateContent(next: PWeek[]) { setLocalContent(next); setDirty(true); setSaveStatus('idle') }

  async function handleSave(contentOverride?: PWeek[], startDateOverride?: string) {
    if (saving) return
    setSaving(true)
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: contentOverride ?? localContent, start_date: startDateOverride ?? localStartDate }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      onUpdated(updated)
      setDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
    }
  }

  // Auto-save 1.5 s after last change
  useEffect(() => {
    if (!dirty) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    const snap = { content: localContent, startDate: localStartDate }
    autoSaveTimer.current = setTimeout(() => handleSave(snap.content, snap.startDate), 1500)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, localContent, localStartDate])

  async function handleStartDateChange(newDate: string) {
    setLocalStartDate(newDate)
    setEditingStartDate(false)
    setDirty(true)
    setSaveStatus('idle')
  }

  async function handleStatusChange(status: string) {
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) onUpdated(await res.json())
  }

  async function handleUnassign() {
    if (!confirm(`Remove "${assignment.name}" from this client?`)) return
    const res = await fetch(`/api/coach/clients/${clientId}/programs/${assignment.id}`, { method: 'DELETE' })
    if (res.ok) onUnassign(assignment.id)
  }

  function addWeek() {
    const next = [...localContent, pNewWeek(localContent.length + 1)]
    updateContent(next)
  }

  function duplicateWeek(i: number) {
    const copy = pCloneWeek(localContent[i], `Week ${localContent.length + 1}`)
    const next = [...localContent.slice(0, i + 1), copy, ...localContent.slice(i + 1)]
    updateContent(next)
    if (selectedDay?.[0] === i) setSelectedDay(null)
  }

  function deleteWeek(i: number) {
    if (!confirm(`Delete ${localContent[i].label}?`)) return
    const next = localContent.filter((_, wi) => wi !== i)
    updateContent(next)
    if (selectedDay?.[0] === i) setSelectedDay(null)
  }

  function addDay(weekIdx: number) {
    const week = localContent[weekIdx]
    const next = localContent.map((w, i) => i !== weekIdx ? w : { ...w, days: [...w.days, pNewDay(w.days.length + 1)] })
    updateContent(next)
    setSelectedDay([weekIdx, week.days.length])
  }

  function updateDay(weekIdx: number, dayIdx: number, day: PDay) {
    updateContent(localContent.map((w, i) => {
      if (i !== weekIdx) return w
      const days = [...w.days]; days[dayIdx] = day; return { ...w, days }
    }))
  }

  function deleteDay(weekIdx: number, dayIdx: number) {
    if (!confirm('Remove this day?')) return
    updateContent(localContent.map((w, i) => i !== weekIdx ? w : { ...w, days: w.days.filter((_, di) => di !== dayIdx) }))
    if (selectedDay?.[0] === weekIdx && selectedDay?.[1] === dayIdx) setSelectedDay(null)
  }

  function moveDay(weekIdx: number, from: number, to: number) {
    if (from === to) return
    const week = localContent[weekIdx]
    if (!week) return
    const days = [...week.days]
    const [moved] = days.splice(from, 1)
    days.splice(to, 0, moved)
    updateContent(localContent.map((w, i) => i === weekIdx ? { ...w, days } : w))
    if (selectedDay?.[0] === weekIdx && selectedDay?.[1] === from) setSelectedDay([weekIdx, to])
  }

  const maxDays = Math.max(4, ...localContent.map((w) => w.days.length))
  const cols = Math.min(maxDays, 7)

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button onClick={() => setExpanded((v) => !v)} className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors text-left">{assignment.name}</button>
            <StatusBadge status={assignment.status} />
          </div>
          {/* Editable start date + computed date range */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {editingStartDate ? (
              <input
                type="date"
                autoFocus
                defaultValue={localStartDate}
                onBlur={(e) => handleStartDateChange(e.target.value || localStartDate)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStartDateChange((e.target as HTMLInputElement).value || localStartDate); if (e.key === 'Escape') setEditingStartDate(false) }}
                className="text-xs border border-blue-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <button
                onClick={() => setEditingStartDate(true)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors group"
                title="Edit start date"
              >
                {fmtDate(startDateObj)}
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                </svg>
              </button>
            )}
            {numWeeks > 0 && (
              <span className="text-xs text-gray-400">
                → {fmtDate(endDateObj)} · {numWeeks} week{numWeeks !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-3 flex-wrap justify-end">
          <select
            value={assignment.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          {!saving && saveStatus === 'saved' && <span className="text-xs text-green-500">Saved</span>}
          {!saving && saveStatus === 'error' && <span className="text-xs text-red-500">Save failed</span>}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {onSaveAsTemplate && (
            <button
              onClick={() => onSaveAsTemplate(assignment.id)}
              disabled={savingTemplateId === assignment.id}
              className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {savedTemplateId === assignment.id ? 'Saved ✓' : savingTemplateId === assignment.id ? 'Saving…' : 'Save as Template'}
            </button>
          )}
          <button onClick={handleUnassign} className="text-gray-300 hover:text-red-400 transition-colors" title="Remove program">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded: calendar grid */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Calendar grid header */}
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Program Calendar</p>
            <button onClick={addWeek} className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Add Week</button>
          </div>

          {localContent.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400 mb-3">No weeks yet.</p>
              <button onClick={addWeek} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700">+ Add Week 1</button>
            </div>
          ) : (
            <div className="px-5 pb-4 overflow-x-auto">
              <div style={{ minWidth: `${cols * 130 + 110}px` }}>
                {/* Column headers */}
                <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: `106px repeat(${cols}, 1fr)` }}>
                  <div />
                  {Array.from({ length: cols }, (_, i) => (
                    <div key={i} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center py-1">Day {i + 1}</div>
                  ))}
                </div>
                {/* Week rows */}
                {localContent.map((week, wi) => (
                  <div key={week.id} className="grid gap-2 mb-3" style={{ gridTemplateColumns: `106px repeat(${cols}, 1fr)` }}>
                    {/* Week label + actions */}
                    <div className="flex flex-col items-end justify-start pr-2 pt-2 gap-1">
                      <span className="text-xs font-bold text-gray-700 truncate max-w-full">{week.label}</span>
                      <button onClick={() => addDay(wi)} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">+ Day</button>
                      <button onClick={() => duplicateWeek(wi)} className="text-[10px] text-gray-400 hover:text-gray-600">Dupe</button>
                      <button onClick={() => deleteWeek(wi)} className="text-[10px] text-gray-300 hover:text-red-400">Del</button>
                    </div>
                    {/* Day cells */}
                    {Array.from({ length: cols }, (_, di) => {
                      const day = week.days[di]
                      const exercises = (day?.items ?? []).filter((it) => it.type === 'exercise') as PExercise[]
                      const isSelected = selectedDay?.[0] === wi && selectedDay?.[1] === di
                      const isDragging = dragFrom?.[0] === wi && dragFrom?.[1] === di
                      const isDropTarget = dragOver?.[0] === wi && dragOver?.[1] === di && dragFrom?.[0] === wi && !isDragging
                      return (
                        <div key={di}
                          draggable={!!day}
                          onDragStart={day ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragFrom([wi, di]) } : undefined}
                          onDragOver={day ? (e) => { e.preventDefault(); setDragOver([wi, di]) } : (e) => e.preventDefault()}
                          onDragEnter={dragFrom?.[0] === wi ? (e) => { e.preventDefault(); setDragOver([wi, di]) } : undefined}
                          onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (dragFrom && dragFrom[0] === wi) moveDay(wi, dragFrom[1], di)
                            setDragFrom(null); setDragOver(null)
                          }}
                          onClick={() => day && !dragFrom && setSelectedDay(isSelected ? null : [wi, di])}
                          className={`min-h-[80px] rounded-xl border p-2 transition-all ${
                            isDragging
                              ? 'opacity-40 border-blue-300 bg-blue-50 cursor-grabbing'
                              : isDropTarget
                                ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                                : day
                                  ? isSelected
                                    ? 'bg-blue-50 border-blue-400 shadow-sm cursor-pointer'
                                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-grab'
                                  : dragFrom?.[0] === wi
                                    ? 'bg-blue-50/30 border-dashed border-blue-200'
                                    : 'bg-gray-50/40 border-dashed border-gray-100'
                          }`}>
                          {day ? (
                            <>
                              <div className="flex items-start justify-between gap-1 mb-1">
                                {renamingDay?.[0] === wi && renamingDay?.[1] === di ? (
                                  <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={(e) => {
                                      e.stopPropagation()
                                      const name = renameValue.trim() || day.name
                                      updateDay(wi, di, { ...day, name })
                                      setRenamingDay(null)
                                    }}
                                    onKeyDown={(e) => {
                                      e.stopPropagation()
                                      if (e.key === 'Enter' || e.key === 'Escape') {
                                        const name = renameValue.trim() || day.name
                                        updateDay(wi, di, { ...day, name })
                                        setRenamingDay(null)
                                      }
                                    }}
                                    className="text-[10px] font-bold text-blue-700 flex-1 bg-transparent border-b border-blue-400 outline-none min-w-0 w-full"
                                  />
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setRenameValue(day.name); setRenamingDay([wi, di]) }}
                                    className="text-[10px] font-bold text-blue-700 truncate flex-1 text-left hover:text-blue-500 transition-colors"
                                    title="Click to rename"
                                  >
                                    {day.name || 'Day'}
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); deleteDay(wi, di) }}
                                  className="text-gray-200 hover:text-red-400 text-xs leading-none flex-shrink-0">×</button>
                              </div>
                              <div className="space-y-0.5">
                                {exercises.slice(0, 4).map((ex, i) => (
                                  <p key={i} className="text-[10px] text-gray-500 truncate">{ex.name || <span className="text-gray-300 italic">Unnamed</span>}</p>
                                ))}
                                {exercises.length > 4 && <p className="text-[10px] text-gray-300">+{exercises.length - 4} more</p>}
                                {exercises.length === 0 && <p className="text-[10px] text-gray-300 italic">Empty</p>}
                              </div>
                            </>
                          ) : (
                            <p className="text-[10px] text-gray-200 text-center mt-5">—</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day editor panel */}
          {selectedDay && (() => {
            const [wi, di] = selectedDay
            const day = localContent[wi]?.days[di]
            if (!day) return null
            return (
              <div ref={dayEditorRef}>
                <PDayEditor
                  day={day}
                  onChange={(d) => updateDay(wi, di, d)}
                  onClose={() => setSelectedDay(null)}
                />
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function AssignProgramModal({
  clientId,
  onClose,
  onAssigned,
}: {
  clientId: string
  onClose: () => void
  onAssigned: (assignment: ClientProgram) => void
}) {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/programs')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .finally(() => setLoadingTemplates(false))
  }, [])

  async function handleAssign() {
    if (!selectedId) return
    setAssigning(true)
    setError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/programs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_id: selectedId, start_date: startDate }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to assign program')
      setAssigning(false)
      return
    }
    onAssigned(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Assign Program</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loadingTemplates ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading programs…</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-3">No programs yet.</p>
            <a
              href="/coach/programs"
              className="text-sm font-semibold text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create a program first →
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                    selectedId === t.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {t.week_count} week{t.week_count !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedId || assigning}
                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {assigning ? 'Assigning…' : 'Assign Program'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProgramTab({ clientId }: { clientId: string }) {
  const [assignments, setAssignments] = useState<ClientProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [savingProgTemplateId, setSavingProgTemplateId] = useState<string | null>(null)
  const [savedProgTemplateId, setSavedProgTemplateId] = useState<string | null>(null)

  async function loadPrograms() {
    const d = await fetch(`/api/coach/clients/${clientId}/programs`).then((r) => r.json())
    const list: ClientProgram[] = Array.isArray(d) ? d : []

    // Sort by start_date descending (most recent first)
    list.sort((a, b) => b.start_date.localeCompare(a.start_date))

    // Auto-complete expired programs
    const today = new Date().toISOString().slice(0, 10)
    const toComplete = list.filter((a) => {
      if (a.status !== 'active') return false
      const numWeeks = Array.isArray(a.content) ? a.content.length : 0
      if (numWeeks === 0) return false
      const end = new Date(a.start_date + 'T00:00:00')
      end.setDate(end.getDate() + numWeeks * 7 - 1)
      return end.toISOString().slice(0, 10) < today
    })
    await Promise.all(
      toComplete.map((a) =>
        fetch(`/api/coach/clients/${clientId}/programs/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }).then((r) => r.ok ? r.json() : null)
          .then((updated) => { if (updated) { const idx = list.findIndex((x) => x.id === updated.id); if (idx >= 0) list[idx] = updated } })
      )
    )
    setAssignments([...list])
  }

  useEffect(() => {
    loadPrograms().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function handleAssigned(assignment: ClientProgram) {
    setAssignments((prev) => [...prev, assignment].sort((a, b) => b.start_date.localeCompare(a.start_date)))
  }

  function handleUnassign(id: string) {
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  function handleUpdated(updated: ClientProgram) {
    setAssignments((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
          .sort((a, b) => b.start_date.localeCompare(a.start_date))
    )
  }

  async function handleCreateProgram() {
    const name = prompt('Program name:')
    if (!name?.trim()) return
    const blankContent = [pNewWeek(1)]
    const res = await fetch(`/api/coach/clients/${clientId}/programs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_id: null,
        name: name.trim(),
        content: blankContent,
        start_date: new Date().toISOString().split('T')[0],
      }),
    })
    if (res.ok) {
      await loadPrograms()
    }
  }

  async function handleSaveProgAsTemplate(assignmentId: string) {
    setSavingProgTemplateId(assignmentId)
    await fetch(`/api/coach/clients/${clientId}/programs/${assignmentId}/save-as-template`, { method: 'POST' })
    setSavingProgTemplateId(null)
    setSavedProgTemplateId(assignmentId)
    setTimeout(() => setSavedProgTemplateId(null), 3000)
  }

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">Loading programs…</p>
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {assignments.length === 0 ? 'No programs assigned' : `${assignments.length} program${assignments.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateProgram}
            className="text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create New
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Assign Program
          </button>
        </div>
      </div>

      {assignments.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 mb-1">No programs assigned yet</p>
          <p className="text-xs text-gray-400 mb-4">Assign a training program template to this client.</p>
          <button
            onClick={() => setShowAssignModal(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            + Assign Program
          </button>
        </div>
      )}

      {assignments.map((a) => (
        <AssignedProgramCard
          key={a.id}
          assignment={a}
          clientId={clientId}
          onUnassign={handleUnassign}
          onUpdated={handleUpdated}
          onSaveAsTemplate={handleSaveProgAsTemplate}
          savingTemplateId={savingProgTemplateId}
          savedTemplateId={savedProgTemplateId}
        />
      ))}

      {showAssignModal && (
        <AssignProgramModal
          clientId={clientId}
          onClose={() => setShowAssignModal(false)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  )
}

// ── Calendar tab ──────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string
  event_date: string
  type: string
  title: string
  content: Record<string, unknown>
  created_at?: string | null
}

type CalHabit = { id: string; name: string; type: string; target: number | null; unit: string | null; icon: string | null }
type MacroDay = { cal: number; protein: number; carbs: number; fat: number }

const EVENT_COLORS: Record<string, string> = {
  task:           'bg-rose-50 text-rose-700 border-rose-200',
  workout:        'bg-blue-50 text-blue-700 border-blue-200',
  steps:          'bg-green-50 text-green-700 border-green-200',
  note:           'bg-yellow-50 text-yellow-700 border-yellow-200',
  habit:          'bg-purple-50 text-purple-700 border-purple-200',
  autoflow:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  personal:       'bg-orange-50 text-orange-700 border-orange-200',
  travel:         'bg-sky-50 text-sky-700 border-sky-200',
  extra_activity: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  birthday:       'bg-pink-50 text-pink-700 border-pink-200',
  custom:         'bg-gray-50 text-gray-700 border-gray-200',
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date); d.setDate(d.getDate() + days); return d
}

function toDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type CalWorkoutItem = {
  type: 'exercise' | 'section'
  id: string
  name?: string
  title?: string
  notes?: string
  scoreType?: string
  scoreValue?: string
  sets?: Array<{ setNumber: number; reps: string; weight: string }>
}

type CalWorkoutForDate = {
  programId: string
  programName: string
  dayName: string
  weekIdx: number
  dayIdx: number
  exerciseCount: number
  items: CalWorkoutItem[]
  dateStr: string
  result: CalendarEvent | null
}

// Handles both old format (exercises[]) and new format (items: DayItem[])
function getWorkoutsForDate(
  programs: { id: string; name: string; start_date: string; content: unknown[] }[],
  date: Date,
  events: CalendarEvent[]
) {
  const out: CalWorkoutForDate[] = []
  const dateStr = toDateStr(date)

  // Build override map: "programId-weekIdx-dayIdx" → override event_date
  const overrideMap: Record<string, string> = {}
  for (const e of events) {
    if (e.type === 'program_workout_override') {
      const c = e.content as Record<string, unknown>
      overrideMap[`${c.program_id}-${c.week_index}-${c.day_index}`] = e.event_date
    }
  }

  // Helper to add a workout from a program at a specific weekIdx/dayIdx
  function addWorkout(prog: { id: string; name: string; content: unknown[] }, weekIdx: number, dayIdx: number) {
    const week = (prog.content[weekIdx] ?? {}) as Record<string, unknown>
    const day = ((week.days ?? []) as Record<string, unknown>[])[dayIdx]
    if (!day) return
    const items = day.items as CalWorkoutItem[] | undefined
    const exes = day.exercises as unknown[] | undefined
    const count = Array.isArray(items)
      ? items.filter((it) => it.type === 'exercise').length
      : Array.isArray(exes) ? exes.length : 0
    if (count === 0 && !Array.isArray(items)) return
    if (!count && (!Array.isArray(items) || items.length === 0)) return
    const result = events.find(
      (e) =>
        e.type === 'program_workout_result' &&
        (e.content as Record<string, unknown>).program_id === prog.id &&
        (e.content as Record<string, unknown>).week_index === weekIdx &&
        (e.content as Record<string, unknown>).day_index === dayIdx
    ) ?? null
    out.push({
      programId: prog.id,
      programName: prog.name,
      dayName: (day.name as string) || `Day ${dayIdx + 1}`,
      weekIdx,
      dayIdx,
      exerciseCount: count,
      items: Array.isArray(items) ? items : [],
      dateStr,
      result,
    })
  }

  // 1. Show workouts overridden to THIS date
  for (const e of events) {
    if (e.type === 'program_workout_override' && e.event_date === dateStr) {
      const c = e.content as Record<string, unknown>
      const prog = programs.find((p) => p.id === (c.program_id as string))
      if (prog) addWorkout(prog, c.week_index as number, c.day_index as number)
    }
  }

  // 2. Show workouts that are scheduled for today (unless overridden away)
  for (const prog of programs) {
    const start = new Date(prog.start_date + 'T00:00:00')
    // Use local date components from the Date object directly — toISOString() returns UTC
    // which gives the wrong date in UTC+10 timezones (e.g. AEST midnight → previous day UTC).
    const startUTC  = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
    const targetUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    const dayOffset = Math.round((targetUTC - startUTC) / 86400000)
    if (dayOffset < 0) continue
    const weekIdx = Math.floor(dayOffset / 7)
    const dayIdx = dayOffset % 7
    const overrideKey = `${prog.id}-${weekIdx}-${dayIdx}`
    if (overrideMap[overrideKey]) continue // overridden to a different date — skip
    addWorkout(prog, weekIdx, dayIdx)
  }

  return out
}

// ── Coach workout result viewer ───────────────────────────────────────────────

type SavedExercise = {
  id: string
  name: string
  sets: Array<{ weight: string; reps: string }>
  videoPath?: string
  clientNote?: string
  coachNote?: string
}

function CoachVideoPlayer({ path, clientId }: { path: string; clientId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/workouts/video-url?path=${encodeURIComponent(path)}&clientId=${clientId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.url) setUrl(j.url) })
      .finally(() => setLoading(false))
  }, [path, clientId])
  if (loading) return <div className="h-8 flex items-center text-xs text-gray-400">Loading video…</div>
  if (!url) return <div className="text-xs text-red-400">Could not load video</div>
  return <video src={url} controls playsInline className="w-full rounded-lg mt-1 max-h-48 bg-black" />
}

function CoachWorkoutModal({ workout, clientId, clientTimezone, onClose }: {
  workout: CalWorkoutForDate
  clientId: string
  clientTimezone: string | null
  onClose: () => void
}) {
  const result = workout.result
  const savedSections = result
    ? ((result.content.sections ?? []) as Array<{ id: string; title: string; scoreType: string; scoreValue: string; coachNote?: string }>)
    : []
  const savedExercises = result
    ? ((result.content.exercises ?? []) as SavedExercise[])
    : []

  const [coachNotes, setCoachNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(savedExercises.filter((e) => e.coachNote).map((e) => [e.id, e.coachNote!]))
  )
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  async function saveFeedback() {
    if (!result) return
    setSavingFeedback(true)
    setFeedbackError(null)
    try {
      const exerciseFeedback = Object.entries(coachNotes).map(([id, coachNote]) => ({ id, coachNote }))
      const res = await fetch(`/api/workouts/program-session/${result.id}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseFeedback }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
      }
      setFeedbackSaved(true)
      setTimeout(() => setFeedbackSaved(false), 2500)
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : 'Failed to save feedback')
    } finally {
      setSavingFeedback(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{workout.programName}</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{workout.dayName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(workout.dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {result && (() => {
              const completedTime = result.created_at
                ? new Intl.DateTimeFormat('en-AU', {
                    hour: 'numeric', minute: '2-digit', hour12: true,
                    timeZone: clientTimezone ?? undefined,
                  }).format(new Date(result.created_at))
                : null
              const tzLabel = clientTimezone ? clientTimezone.split('/').pop()?.replace(/_/g, ' ') : null
              return (
                <div className="flex flex-col gap-0.5 mt-2">
                  <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5 w-fit">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-semibold text-green-700">
                      Completed {new Date(result.event_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  {completedTime && (
                    <p className="text-[11px] text-gray-400 pl-1">
                      Logged at {completedTime}{tzLabel ? ` (${tzLabel})` : ''}
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!result && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-400 text-center">
              Client hasn't logged this workout yet.
            </div>
          )}

          {workout.items.map((item) => {
            if (item.type === 'section') {
              const hasScore = item.scoreType && item.scoreType !== 'none'
              const savedScore = savedSections.find((s) => s.id === item.id)
              return (
                <div key={item.id} className="bg-indigo-50 rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{item.title}</span>
                    {hasScore && (
                      <span className="text-[10px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase">{item.scoreType}</span>
                    )}
                  </div>
                  {item.notes && <p className="text-xs text-indigo-800 whitespace-pre-line leading-relaxed">{item.notes}</p>}
                  {hasScore && result && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-gray-500">Client score:</span>
                      <span className="text-sm font-bold text-indigo-700">{savedScore?.scoreValue || '—'}</span>
                    </div>
                  )}
                  {savedScore?.coachNote && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mt-1">
                      <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5">Your feedback</p>
                      <p className="text-xs text-amber-900">{savedScore.coachNote}</p>
                    </div>
                  )}
                </div>
              )
            }

            const savedEx = savedExercises.find((e) => e.id === item.id)
            return (
              <div key={item.id} className="border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                <p className="text-xs text-gray-400">Target: {item.sets?.length ?? 0} sets × {item.sets?.[0]?.reps ?? '—'}</p>

                {savedEx && savedEx.sets.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {savedEx.sets.map((s, si) => (
                      <p key={si} className="text-xs text-gray-600">
                        Set {si + 1}: {s.weight ? `${s.weight} kg × ` : ''}{s.reps} reps
                      </p>
                    ))}
                  </div>
                )}
                {result && !savedEx && <p className="text-xs text-gray-300 italic">No sets logged</p>}

                {/* Client uploaded video */}
                {savedEx?.videoPath && (
                  <CoachVideoPlayer path={savedEx.videoPath} clientId={clientId} />
                )}

                {/* Client note */}
                {savedEx?.clientNote && (
                  <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Client note</p>
                    <p className="text-xs text-gray-600">{savedEx.clientNote}</p>
                  </div>
                )}

                {/* Coach feedback input */}
                {result && (
                  <div className="pt-1">
                    <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-1">Feedback</p>
                    <textarea
                      value={coachNotes[item.id] ?? savedEx?.coachNote ?? ''}
                      onChange={(e) => setCoachNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Add feedback for this exercise…"
                      rows={2}
                      className="w-full text-xs border border-amber-100 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-300 placeholder:text-gray-300 bg-amber-50"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-4 border-t space-y-2">
          {feedbackError && (
            <p className="text-xs text-red-500 text-center">{feedbackError}</p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              Close
            </button>
            {result && (
              <button onClick={saveFeedback} disabled={savingFeedback}
                className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {savingFeedback ? 'Saving…' : feedbackSaved ? 'Saved ✓' : 'Save Feedback'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Coach personal workout viewer ─────────────────────────────────────────────

type PersonalWorkoutDetail = {
  id: string
  name: string
  started_at: string
  ended_at: string | null
  duration_min: number | null
  exercises: Array<{
    weId: string
    name: string
    category: string
    notes: string | null
    sets: Array<{ setNumber: number; weightLbs: number | null; reps: number | null; durationSeconds: number | null; calories: number | null }>
  }>
  sections: Array<{ title: string; notes: string; scoreType: string; scoreValue: string }>
}

function CoachPersonalWorkoutModal({ event, clientId, onClose }: {
  event: CalendarEvent
  clientId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<PersonalWorkoutDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const workoutId = (event.content as Record<string, unknown>)?.workout_id as string | undefined

  useEffect(() => {
    if (!workoutId) { setLoading(false); return }
    fetch(`/api/coach/clients/${clientId}/workouts/${workoutId}`)
      .then((r) => r.ok ? r.json() : r.json().then((b: { error?: string }) => { throw new Error(b.error ?? 'Failed') }))
      .then((d) => setDetail(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [workoutId, clientId])

  function fmtSet(s: PersonalWorkoutDetail['exercises'][0]['sets'][0]): string {
    const parts: string[] = []
    if (s.weightLbs != null) parts.push(`${s.weightLbs} kg`)
    if (s.reps != null) parts.push(`${s.reps} reps`)
    if (s.durationSeconds != null) parts.push(`${s.durationSeconds}s`)
    if (s.calories != null) parts.push(`${s.calories} cal`)
    return parts.join(' × ') || '—'
  }

  const dateDisplay = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Personal workout</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{event.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{dateDisplay}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}
          {error && <p className="text-sm text-red-500 text-center py-4">{error}</p>}
          {!loading && !error && !workoutId && (
            <p className="text-sm text-gray-400 text-center py-4">No workout data linked.</p>
          )}
          {detail && (
            <>
              {detail.duration_min != null && (
                <p className="text-xs text-gray-400">{detail.duration_min} min</p>
              )}
              {detail.exercises.map((ex) => (
                <div key={ex.weId} className="border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-sm font-semibold text-gray-800">{ex.name}
                    <span className="text-xs font-normal text-gray-400 ml-1.5 capitalize">{ex.category}</span>
                  </p>
                  {ex.sets.length > 0 ? (
                    <div className="space-y-0.5">
                      {ex.sets.map((s) => (
                        <p key={s.setNumber} className="text-xs text-gray-600">
                          Set {s.setNumber}: {fmtSet(s)}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No sets recorded</p>
                  )}
                  {ex.notes && <p className="text-xs text-gray-500 italic">"{ex.notes}"</p>}
                </div>
              ))}
              {detail.sections.map((s, i) => (
                <div key={i} className="bg-purple-50 rounded-xl px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Section</span>
                    {s.title && <p className="text-sm font-semibold text-gray-800">{s.title}</p>}
                  </div>
                  {s.notes && <p className="text-sm text-gray-600">{s.notes}</p>}
                  {s.scoreValue && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium capitalize">{s.scoreType}:</span> {s.scoreValue}
                    </p>
                  )}
                </div>
              ))}
              {detail.exercises.length === 0 && detail.sections.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No exercises recorded.</p>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t">
          <button onClick={onClose} className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function getMonthGridDays(monthStart: Date): Date[] {
  const firstDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)
  const lastDay  = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const gridStart = getWeekStart(firstDay)
  const lastDow = lastDay.getDay()
  const gridEnd = addDays(lastDay, lastDow === 0 ? 0 : 7 - lastDow)
  const days: Date[] = []
  let cur = new Date(gridStart)
  while (cur <= gridEnd) { days.push(new Date(cur)); cur = addDays(cur, 1) }
  return days
}

// ── Food Logs tab ─────────────────────────────────────────────────────────────

type FoodLogEntry = {
  id: string
  log_date: string
  meal_type: string
  food_name: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  scan_image_url: string | null
  meal_notes: string | null
  meal_photo_url: string | null
  created_at: string | null
}

type MealNoteEntry = {
  log_date: string
  meal_type: string
  note: string | null
  photo_url: string | null
}

function localDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function FoodLogsTab({ clientId }: { clientId: string }) {
  const today = localDateStr(new Date())
  const weekAgo = localDateStr(new Date(Date.now() - 6 * 86400000))

  const [startDate, setStartDate] = useState(weekAgo)
  const [endDate, setEndDate] = useState(today)
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([])
  const [mealNotes, setMealNotes] = useState<MealNoteEntry[]>([])
  const [clientTimezone, setClientTimezone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    fetch(`/api/coach/clients/${clientId}/food-logs?start_date=${startDate}&end_date=${endDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else {
          setFoodLogs(d.foodLogs ?? [])
          setMealNotes(d.mealNotes ?? [])
          setClientTimezone(d.clientTimezone ?? null)
        }
      })
      .catch(() => setError('Failed to load food logs'))
      .finally(() => setLoading(false))
  }, [clientId, startDate, endDate])

  // Group by date
  const byDate = foodLogs.reduce<Record<string, FoodLogEntry[]>>((acc, f) => {
    acc[f.log_date] = acc[f.log_date] ?? []; acc[f.log_date].push(f); return acc
  }, {})

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      {/* Date range picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {/* Quick range buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          {([['7d', 7], ['14d', 14], ['30d', 30]] as [string, number][]).map(([label, days]) => (
            <button key={label} onClick={() => {
              setEndDate(today)
              setStartDate(localDateStr(new Date(Date.now() - (days - 1) * 86400000)))
            }} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-medium">
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500 text-center py-10">{error}</p>
      ) : dates.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center">
          <p className="text-sm text-gray-400">No food logs in this date range.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dates.map((date) => {
            const logs = byDate[date]
            const totals = logs.reduce((a, l) => ({
              cal: a.cal + l.calories, p: a.p + l.protein, c: a.c + l.carbs, f: a.f + l.fat,
            }), { cal: 0, p: 0, c: 0, f: 0 })
            const byMeal = logs.reduce<Record<string, FoodLogEntry[]>>((acc, l) => {
              acc[l.meal_type] = acc[l.meal_type] ?? []; acc[l.meal_type].push(l); return acc
            }, {})
            const dayNotes = mealNotes.filter((n) => n.log_date === date)
            const allMealTypes = Array.from(new Set([...Object.keys(byMeal), ...dayNotes.map((n) => n.meal_type)]))

            return (
              <div key={date} className="bg-white rounded-2xl border overflow-hidden">
                {/* Day header */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {Math.round(totals.cal)} kcal · {Math.round(totals.p)}g P · {Math.round(totals.c)}g C · {Math.round(totals.f)}g F
                  </p>
                </div>

                {allMealTypes.map((mealType) => {
                  const mealLogs = byMeal[mealType] ?? []
                  const mealNote = dayNotes.find((n) => n.meal_type === mealType)
                  return (
                    <div key={mealType}>
                      {/* Meal label row */}
                      <div className="px-5 pt-3 pb-1">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide capitalize">{mealType}</p>
                      </div>

                      {/* Meal-level note / photo */}
                      {(mealNote?.note || mealNote?.photo_url) && (
                        <div className="px-5 py-2 mx-5 mb-1 rounded-xl bg-blue-50 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {mealNote.note && <p className="text-xs text-blue-700 italic">"{mealNote.note}"</p>}
                          </div>
                          {mealNote.photo_url && (
                            <a href={mealNote.photo_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                              <img src={mealNote.photo_url} alt="Meal photo" className="h-16 w-24 object-cover rounded-lg border border-blue-100 hover:opacity-80 transition-opacity" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Food items */}
                      {mealLogs.map((l) => {
                        const loggedAt = l.created_at
                          ? new Intl.DateTimeFormat('en-AU', {
                              hour: 'numeric', minute: '2-digit', hour12: true,
                              timeZone: clientTimezone ?? undefined,
                            }).format(new Date(l.created_at))
                          : null
                        return (
                        <div key={l.id} className="px-5 py-2.5 border-t border-gray-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <p className="text-sm text-gray-800">{l.food_name ?? 'Food entry'}</p>
                                {loggedAt && (
                                  <span className="text-[10px] text-gray-400">{loggedAt}{clientTimezone ? ` (${clientTimezone.split('/').pop()?.replace('_', ' ')})` : ''}</span>
                                )}
                              </div>
                              {l.meal_notes && (
                                <p className="text-xs text-blue-500 italic mt-0.5">"{l.meal_notes}"</p>
                              )}
                              {l.scan_image_url && (
                                <div className="mt-2">
                                  <a href={l.scan_image_url} target="_blank" rel="noopener noreferrer">
                                    <img src={l.scan_image_url} alt="AI meal scan" className="h-20 w-28 object-cover rounded-lg border border-gray-100 hover:opacity-80 transition-opacity" />
                                  </a>
                                  <p className="text-[10px] text-gray-400 mt-0.5">AI scanned</p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-start gap-2 flex-shrink-0">
                              {l.meal_photo_url && (
                                <a href={l.meal_photo_url} target="_blank" rel="noopener noreferrer">
                                  <img src={l.meal_photo_url} alt="Meal photo" className="h-12 w-16 object-cover rounded-lg border border-gray-100 hover:opacity-80 transition-opacity" />
                                </a>
                              )}
                              <p className="text-xs text-gray-500 mt-0.5">{Math.round(l.calories)} kcal</p>
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CalendarTab({ clientId }: { clientId: string }) {
  const [calView, setCalView] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [monthStart, setMonthStart] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [programs, setPrograms] = useState<{ id: string; name: string; start_date: string; content: unknown[] }[]>([])
  const [foodByDate, setFoodByDate] = useState<Record<string, MacroDay>>({})
  const [habits, setHabits] = useState<CalHabit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientTimezone, setClientTimezone] = useState<string | null>(null)
  const datePickerRef = useRef<HTMLInputElement>(null)
  const [addingEvent, setAddingEvent] = useState<string | null>(null)
  const [newEvent, setNewEvent] = useState({ type: 'task', title: '', content: '', repeat: 'none' })
  const [saving, setSaving] = useState(false)
  const [deletingSeriesId, setDeletingSeriesId] = useState<string | null>(null)
  const [viewingWorkout, setViewingWorkout] = useState<CalWorkoutForDate | null>(null)
  const [viewingPersonalWorkout, setViewingPersonalWorkout] = useState<CalendarEvent | null>(null)
  const [viewingAutoflow, setViewingAutoflow] = useState<{ title: string; flowId: string; stepNumber: number } | null>(null)
  const [autoflowStepData, setAutoflowStepData] = useState<{ core_questions: { id: string; label: string; type: string }[]; questions: { id: string; label: string; type: string }[]; response: { answers: Record<string, string>; submitted_at: string } | null } | null>(null)
  const [autoflowLoading, setAutoflowLoading] = useState(false)
  const [dragEventId, setDragEventId] = useState<string | null>(null)
  const [dragWorkout, setDragWorkout] = useState<{ programId: string; weekIdx: number; dayIdx: number } | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  async function openAutoflowStep(evt: CalendarEvent) {
    const flowId = evt.content.flow_id as string
    const stepNumber = evt.content.step_number as number
    if (!flowId || !stepNumber) return
    setViewingAutoflow({ title: evt.title, flowId, stepNumber })
    setAutoflowStepData(null)
    setAutoflowLoading(true)
    const d = await fetch(`/api/coach/clients/${clientId}/autoflows/${flowId}`).then(r => r.json())
    if (!d.error) {
      const step = (d.steps ?? []).find((s: { step_number: number }) => s.step_number === stepNumber)
      const tpl = d.autoflow_templates as { core_questions: { id: string; label: string; type: string }[] } | null
      setAutoflowStepData({
        core_questions: tpl?.core_questions ?? [],
        questions: step?.questions ?? [],
        response: step?.response ?? null,
      })
    }
    setAutoflowLoading(false)
  }

  const weekEnd = addDays(weekStart, 6)
  const monthGridDays = getMonthGridDays(monthStart)
  const rangeStart = calView === 'week' ? weekStart : monthGridDays[0]
  const rangeEnd   = calView === 'week' ? weekEnd   : monthGridDays[monthGridDays.length - 1]

  async function loadData(start: Date, end: Date) {
    setLoading(true); setError(null)
    try {
      const res = await fetch(
        `/api/coach/clients/${clientId}/calendar?start_date=${toDateStr(start)}&end_date=${toDateStr(end)}`
      )
      if (!res.ok) { setError('Failed to load calendar'); return }
      const data = await res.json()
      setEvents(data.events ?? [])
      setPrograms(data.programs ?? [])
      setFoodByDate(data.foodByDate ?? {})
      setHabits(data.habits ?? [])
      if (data.clientTimezone) setClientTimezone(data.clientTimezone)
    } catch {
      setError('Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData(rangeStart, rangeEnd) }, [calView, weekStart, monthStart]) // eslint-disable-line react-hooks/exhaustive-deps

  function prevPeriod() {
    if (calView === 'week') setWeekStart((d) => addDays(d, -7))
    else setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function nextPeriod() {
    if (calView === 'week') setWeekStart((d) => addDays(d, 7))
    else setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }
  function goToToday() {
    const now = new Date()
    setWeekStart(getWeekStart(now))
    setMonthStart(new Date(now.getFullYear(), now.getMonth(), 1))
  }
  function switchView(v: 'week' | 'month') {
    if (v === 'month') setMonthStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1))
    else setWeekStart(getWeekStart(monthStart))
    setCalView(v)
  }

  function handleDatePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return
    const [y, m, d] = e.target.value.split('-').map(Number)
    const picked = new Date(y, m - 1, d)
    if (calView === 'week') {
      setWeekStart(getWeekStart(picked))
    } else {
      setMonthStart(new Date(y, m - 1, 1))
    }
  }

  const datePickerValue = calView === 'week' ? toDateStr(weekStart) : toDateStr(monthStart)

  async function saveEvent(date: string) {
    if (!newEvent.title.trim()) return
    setSaving(true)
    const res = await fetch(`/api/coach/clients/${clientId}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_date: date,
        type: newEvent.type,
        title: newEvent.title,
        content: newEvent.content ? { note: newEvent.content } : {},
        repeat_rule: newEvent.repeat !== 'none' ? newEvent.repeat : undefined,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      // API returns { events: [...] } for recurring, or a single event for one-off
      const created = Array.isArray(data.events) ? data.events : [data]
      setEvents((prev) => [...prev, ...created])
    }
    setAddingEvent(null); setNewEvent({ type: 'task', title: '', content: '', repeat: 'none' }); setSaving(false)
  }

  async function deleteEvent(id: string) {
    const evt = events.find(e => e.id === id)
    const recurrenceId = evt?.content?.recurrence_id as string | undefined
    if (recurrenceId) {
      // Show series delete prompt
      setDeletingSeriesId(id)
      return
    }
    await fetch(`/api/coach/clients/${clientId}/calendar/${id}`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  async function deleteOnlyThis(id: string) {
    await fetch(`/api/coach/clients/${clientId}/calendar/${id}`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setDeletingSeriesId(null)
  }

  async function deleteAllFuture(id: string) {
    const evt = events.find(e => e.id === id)
    const recurrenceId = evt?.content?.recurrence_id as string | undefined
    const today = toDateStr(new Date())
    const toDelete = events.filter(e =>
      (e.id === id || (recurrenceId && (e.content?.recurrence_id as string) === recurrenceId)) &&
      e.event_date >= today
    )
    await Promise.all(toDelete.map(e =>
      fetch(`/api/coach/clients/${clientId}/calendar/${e.id}`, { method: 'DELETE' })
    ))
    setEvents((prev) => prev.filter(e => !toDelete.some(d => d.id === e.id)))
    setDeletingSeriesId(null)
  }

  async function moveEvent(id: string, newDate: string) {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, event_date: newDate } : e))
    await fetch(`/api/coach/clients/${clientId}/calendar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date: newDate }),
    })
  }

  function handleDragStart(e: React.DragEvent, eventId: string) {
    setDragEventId(eventId)
    e.dataTransfer.effectAllowed = 'move'
  }

  async function moveWorkout(programId: string, weekIdx: number, dayIdx: number, newDate: string) {
    // Find existing override event for this workout
    const existing = events.find(
      (e) =>
        e.type === 'program_workout_override' &&
        (e.content as Record<string, unknown>).program_id === programId &&
        (e.content as Record<string, unknown>).week_index === weekIdx &&
        (e.content as Record<string, unknown>).day_index === dayIdx
    )
    if (existing) {
      setEvents((prev) => prev.map((e) => e.id === existing.id ? { ...e, event_date: newDate } : e))
      await fetch(`/api/coach/clients/${clientId}/calendar/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_date: newDate }),
      })
    } else {
      const res = await fetch(`/api/coach/clients/${clientId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_date: newDate,
          type: 'program_workout_override',
          title: '',
          content: { program_id: programId, week_index: weekIdx, day_index: dayIdx },
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setEvents((prev) => [...prev, created])
      }
    }
  }

  function handleDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(dateStr)
  }

  function handleDrop(e: React.DragEvent, dateStr: string) {
    e.preventDefault()
    if (dragEventId) moveEvent(dragEventId, dateStr)
    else if (dragWorkout) moveWorkout(dragWorkout.programId, dragWorkout.weekIdx, dragWorkout.dayIdx, dateStr)
    setDragEventId(null)
    setDragWorkout(null)
    setDragOverDate(null)
  }

  function handleDragEnd() {
    setDragEventId(null)
    setDragWorkout(null)
    setDragOverDate(null)
  }

  const today = toDateStr(new Date())

  const periodLabel = calView === 'week'
    ? `${weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : monthStart.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="space-y-4">
      {/* Nav bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={goToToday} className="text-xs font-semibold text-blue-600 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100">Today</button>
          <button onClick={nextPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button
            onClick={() => datePickerRef.current?.showPicker()}
            className="text-sm font-semibold text-gray-700 ml-1 hover:text-blue-600 transition-colors cursor-pointer"
            title="Jump to date"
          >
            {periodLabel}
          </button>
          <input
            ref={datePickerRef}
            type="date"
            className="sr-only"
            value={datePickerValue}
            onChange={handleDatePickerChange}
          />
        </div>
        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          <button onClick={() => switchView('week')}
            className={`px-3 py-1.5 transition-colors ${calView === 'week' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            Week
          </button>
          <button onClick={() => switchView('month')}
            className={`px-3 py-1.5 transition-colors ${calView === 'month' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            Month
          </button>
        </div>
      </div>

      {/* Habits legend */}
      {habits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {habits.map((h) => (
            <span key={h.id} className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-2 py-0.5">
              {h.icon ?? '✅'} {h.name}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading calendar…</p>
      ) : error ? (
        <p className="text-sm text-red-500 text-center py-10">{error}</p>
      ) : calView === 'week' ? (
        /* ── Week grid ── */
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
            const dateStr = toDateStr(day)
            const isToday = dateStr === today
            const isPast = dateStr < today
            const dayEvents = events.filter((e) => e.event_date === dateStr && e.type !== 'program_workout_result' && e.type !== 'program_workout_override')
            const workouts = getWorkoutsForDate(programs, day, events)
            const macros = foodByDate[dateStr]
            const hasContent = workouts.length > 0 || dayEvents.length > 0 || macros

            return (
              <div
                key={dateStr}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDrop={(e) => handleDrop(e, dateStr)}
                onDragLeave={() => setDragOverDate(null)}
                className={`rounded-xl border p-2 min-h-[150px] flex flex-col gap-1 transition-colors ${
                  dragOverDate === dateStr ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-300' :
                  isToday ? 'border-blue-400 bg-blue-50/40' : isPast ? 'bg-gray-50/50 border-gray-100' : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">{day.toLocaleDateString('en-AU', { weekday: 'short' })}</p>
                    <button
                    onClick={() => { setMonthStart(new Date(day.getFullYear(), day.getMonth(), 1)); switchView('month') }}
                    title="View in month"
                    className={`text-sm font-bold leading-none transition-colors ${isToday ? 'text-blue-600' : 'text-gray-800 hover:text-blue-500'}`}
                  >{day.getDate()}</button>
                  </div>
                  <button onClick={() => setAddingEvent(dateStr)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-300 hover:text-gray-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>
                {workouts.map((w, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragWorkout({ programId: w.programId, weekIdx: w.weekIdx, dayIdx: w.dayIdx }) }}
                    onDragEnd={handleDragEnd}
                    className={`w-full text-left text-[10px] rounded-md px-1.5 py-1 font-medium transition-colors cursor-grab active:cursor-grabbing ${dragWorkout?.programId === w.programId && dragWorkout?.weekIdx === w.weekIdx && dragWorkout?.dayIdx === w.dayIdx ? 'opacity-40' : ''} ${
                      w.result ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}
                  >
                    <button className="w-full text-left" onClick={() => setViewingWorkout(w)}>
                      <div className="flex items-center gap-1">
                        <p className="truncate font-semibold flex-1">💪 {w.dayName}</p>
                        {w.result && <svg className="w-3 h-3 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <p className="opacity-70 truncate">{w.programName} · {w.result ? `done ${new Date(w.result.event_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : `${w.exerciseCount} ex`}</p>
                    </button>
                  </div>
                ))}
                {macros && (
                  <div className="text-[10px] bg-orange-50 text-orange-700 border border-orange-100 rounded-md px-1.5 py-1 space-y-0.5">
                    <p className="font-semibold">{Math.round(macros.cal)} kcal</p>
                    <p className="opacity-80">P {Math.round(macros.protein)}g · C {Math.round(macros.carbs)}g · F {Math.round(macros.fat)}g</p>
                  </div>
                )}
                {habits.length > 0 && (
                  <div className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 rounded-md px-1.5 py-0.5 font-medium">
                    {habits.length} habit{habits.length !== 1 ? 's' : ''}
                  </div>
                )}
                {dayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, evt.id)}
                    onDragEnd={handleDragEnd}
                    className={`text-[10px] rounded-md px-1.5 py-0.5 font-medium truncate border flex items-center justify-between gap-0.5 group cursor-grab active:cursor-grabbing ${dragEventId === evt.id ? 'opacity-40' : ''} ${EVENT_COLORS[evt.type] ?? EVENT_COLORS.custom}`}
                  >
                    {evt.type === 'autoflow' ? (
                      <button onClick={() => openAutoflowStep(evt)} className="truncate text-left hover:underline flex-1">⚡ {evt.title}</button>
                    ) : evt.type === 'workout' ? (
                      <button onClick={() => setViewingPersonalWorkout(evt)} className="truncate text-left hover:underline flex-1">💪 {evt.title}</button>
                    ) : (
                      <span className="truncate flex-1">{evt.title}</span>
                    )}
                    <button onClick={() => deleteEvent(evt.id)} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                {!hasContent && habits.length === 0 && (
                  <p className="text-[10px] text-gray-300 mt-auto text-center pb-1">Rest</p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Month grid ── */
        <div>
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {DAY_HEADERS.map((d) => (
              <p key={d} className="text-[10px] font-semibold text-gray-400 uppercase text-center py-1">{d}</p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {monthGridDays.map((day) => {
              const dateStr = toDateStr(day)
              const isToday = dateStr === today
              const isCurrentMonth = day.getMonth() === monthStart.getMonth()
              const dayEvents = events.filter((e) => e.event_date === dateStr && e.type !== 'program_workout_result' && e.type !== 'program_workout_override')
              const workouts = getWorkoutsForDate(programs, day, events)
              const macros = foodByDate[dateStr]

              return (
                <div
                key={dateStr}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDrop={(e) => handleDrop(e, dateStr)}
                onDragLeave={() => setDragOverDate(null)}
                className={`min-h-[90px] p-1.5 flex flex-col gap-0.5 transition-colors ${
                  dragOverDate === dateStr ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' :
                  isToday ? 'bg-blue-50' : isCurrentMonth ? 'bg-white' : 'bg-gray-50/60'
                }`}
              >
                  {/* Date number + add button */}
                  <div className="flex items-center justify-between mb-0.5">
                    <button
                      onClick={() => { setWeekStart(getWeekStart(day)); switchView('week') }}
                      title="View this week"
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                        isToday ? 'bg-blue-500 text-white' : isCurrentMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                    <button onClick={() => setAddingEvent(dateStr)} className="w-4 h-4 flex items-center justify-center text-gray-200 hover:text-gray-400">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>

                  {/* Workouts */}
                  {workouts.map((w, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragWorkout({ programId: w.programId, weekIdx: w.weekIdx, dayIdx: w.dayIdx }) }}
                      onDragEnd={handleDragEnd}
                      className={`w-full text-left text-[9px] leading-tight rounded px-1 py-0.5 font-semibold truncate cursor-grab active:cursor-grabbing ${dragWorkout?.programId === w.programId && dragWorkout?.weekIdx === w.weekIdx && dragWorkout?.dayIdx === w.dayIdx ? 'opacity-40' : ''} ${
                        w.result ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <button className="w-full text-left truncate" onClick={() => setViewingWorkout(w)}>
                        {w.result ? '✓ ' : ''}{w.dayName}
                      </button>
                    </div>
                  ))}

                  {/* Macros dot */}
                  {macros && (
                    <div className="text-[9px] bg-orange-50 text-orange-600 rounded px-1 py-0.5 font-semibold truncate">
                      {Math.round(macros.cal)} kcal
                    </div>
                  )}

                  {/* Custom events */}
                  {dayEvents.slice(0, 2).map((evt) => (
                    <div
                      key={evt.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, evt.id)}
                      onDragEnd={handleDragEnd}
                      className={`text-[9px] rounded px-1 py-0.5 font-medium truncate cursor-grab active:cursor-grabbing ${dragEventId === evt.id ? 'opacity-40' : ''} ${EVENT_COLORS[evt.type] ?? EVENT_COLORS.custom}`}
                    >
                      {evt.type === 'autoflow' ? (
                        <button onClick={() => openAutoflowStep(evt)} className="w-full text-left hover:opacity-80 truncate">⚡ {evt.title}</button>
                      ) : evt.type === 'workout' ? (
                        <button onClick={() => setViewingPersonalWorkout(evt)} className="w-full text-left hover:opacity-80 truncate">💪 {evt.title}</button>
                      ) : evt.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="text-[9px] text-gray-400 px-1">+{dayEvents.length - 2} more</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Autoflow step modal */}
      {viewingAutoflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <p className="text-[11px] text-orange-500 font-semibold uppercase tracking-wide mb-0.5">Autoflow step</p>
                <h3 className="text-sm font-bold text-gray-900 leading-snug">{viewingAutoflow.title}</h3>
              </div>
              <button onClick={() => { setViewingAutoflow(null); setAutoflowStepData(null) }} className="text-gray-400 hover:text-gray-600 ml-3 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {autoflowLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : autoflowStepData ? (
                <>
                  {/* Submission status */}
                  {autoflowStepData.response ? (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <p className="text-xs text-green-700 font-medium">Submitted {new Date(autoflowStepData.response.submitted_at).toLocaleDateString()}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>
                      <p className="text-xs text-gray-500">Not yet submitted</p>
                    </div>
                  )}

                  {/* Core questions */}
                  {autoflowStepData.core_questions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Core questions (every step)</p>
                      {autoflowStepData.core_questions.map((q, i) => (
                        <div key={q.id ?? i} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                          <p className="text-xs text-gray-700">{i + 1}. {q.label}</p>
                          {autoflowStepData.response?.answers?.[q.id] && (
                            <p className="text-xs font-medium text-gray-900 mt-1 pl-3 border-l-2 border-gray-300">{String(autoflowStepData.response.answers[q.id])}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step questions */}
                  {autoflowStepData.questions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Step questions</p>
                      {autoflowStepData.questions.map((q, i) => (
                        <div key={q.id ?? i} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                          <p className="text-xs text-gray-700">{i + 1}. {q.label}</p>
                          {autoflowStepData.response?.answers?.[q.id] && (
                            <p className="text-xs font-medium text-gray-900 mt-1 pl-3 border-l-2 border-gray-300">{String(autoflowStepData.response.answers[q.id])}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {autoflowStepData.core_questions.length === 0 && autoflowStepData.questions.length === 0 && (
                    <p className="text-xs text-gray-400">No questions configured for this step.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">Could not load step data.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workout results modal */}
      {viewingPersonalWorkout && (
        <CoachPersonalWorkoutModal event={viewingPersonalWorkout} clientId={clientId} onClose={() => setViewingPersonalWorkout(null)} />
      )}
      {viewingWorkout && (
        <CoachWorkoutModal workout={viewingWorkout} clientId={clientId} clientTimezone={clientTimezone} onClose={() => setViewingWorkout(null)} />
      )}

      {/* Add event modal */}
      {addingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Add Event — {new Date(addingEvent + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
              <button onClick={() => setAddingEvent(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <select value={newEvent.type} onChange={(e) => setNewEvent((n) => ({ ...n, type: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <optgroup label="Coach events">
                <option value="task">📌 Task</option>
                <option value="note">📝 Note</option>
                <option value="workout">💪 Workout</option>
                <option value="steps">👟 Steps Goal</option>
                <option value="habit">✅ Habit</option>
                <option value="custom">⚡ Custom</option>
              </optgroup>
              <optgroup label="Client events (on their behalf)">
                <option value="personal">🎉 Personal / Social</option>
                <option value="travel">✈️ Travel / Away</option>
                <option value="extra_activity">🏃 Extra Activity</option>
              </optgroup>
            </select>
            <input type="text" value={newEvent.title} onChange={(e) => setNewEvent((n) => ({ ...n, title: e.target.value }))}
              placeholder={
                newEvent.type === 'task' ? 'e.g. Weigh in, Submit check-in…' :
                newEvent.type === 'personal' ? 'Birthday dinner, date night…' :
                newEvent.type === 'travel' ? 'Holiday, trip, going away…' :
                newEvent.type === 'extra_activity' ? 'Walk, swim, bike ride…' :
                newEvent.type === 'steps' ? '10,000 steps today' :
                newEvent.type === 'workout' ? 'Upper body session' :
                'Title'
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
            <textarea value={newEvent.content} onChange={(e) => setNewEvent((n) => ({ ...n, content: e.target.value }))}
              placeholder={
                newEvent.type === 'travel' ? 'Where are you going? Any context for the coach…' :
                newEvent.type === 'personal' ? 'Any notes for the coach…' :
                'Notes (optional)'
              } rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />

            {/* Repeat — available for all coach event types */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Repeat</label>
              <select value={newEvent.repeat} onChange={(e) => setNewEvent((n) => ({ ...n, repeat: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="none">Does not repeat</option>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Every month</option>
              </select>
              {newEvent.repeat !== 'none' && (
                <p className="text-[11px] text-gray-400">
                  {newEvent.repeat === 'weekly' && `Repeats every ${new Date(addingEvent + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long' })} for 1 year`}
                  {newEvent.repeat === 'biweekly' && `Repeats every 2 weeks on ${new Date(addingEvent + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long' })} for 1 year`}
                  {newEvent.repeat === 'monthly' && `Repeats on the ${new Date(addingEvent + 'T00:00:00').getDate()}th of each month for 1 year`}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setAddingEvent(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
              <button onClick={() => saveEvent(addingEvent)} disabled={!newEvent.title.trim() || saving}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : newEvent.repeat !== 'none' ? 'Add recurring' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Series delete prompt */}
      {deletingSeriesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Delete recurring event</h3>
            <p className="text-sm text-gray-500">This is part of a recurring series. What would you like to delete?</p>
            <div className="space-y-2">
              <button onClick={() => deleteOnlyThis(deletingSeriesId)}
                className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                This event only
              </button>
              <button onClick={() => deleteAllFuture(deletingSeriesId)}
                className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50">
                This and all future events in series
              </button>
              <button onClick={() => setDeletingSeriesId(null)}
                className="w-full text-gray-400 py-2 text-sm hover:text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Meal Plan tab ─────────────────────────────────────────────────────────────

type ClientMealPlan = {
  id: string
  meal_plan_id: string | null
  name: string
  content: { id: string; label: string; foods: { food_name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }[] }[]
  start_date: string
  end_date: string | null
  status: string
  show_macros?: boolean
}

type MealPlanTemplate = {
  id: string
  name: string
  goal: string
  total_calories: number
  content: unknown[]
}

function MealPlanTab({ clientId }: { clientId: string }) {
  const [assignments, setAssignments] = useState<ClientMealPlan[]>([])
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCalories, setCreateCalories] = useState('')
  const [createStartDate, setCreateStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [createEndDate, setCreateEndDate] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null)
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [editingDatesId, setEditingDatesId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [savingDatesId, setSavingDatesId] = useState<string | null>(null)

  async function loadPlans() {
    const [plans, tmpl] = await Promise.all([
      fetch(`/api/coach/clients/${clientId}/meal-plans`).then((r) => r.json()),
      fetch('/api/coach/meal-plans').then((r) => r.json()),
    ])
    const list: ClientMealPlan[] = Array.isArray(plans) ? plans : []
    list.sort((a, b) => b.start_date.localeCompare(a.start_date))
    setAssignments(list)
    setTemplates(Array.isArray(tmpl) ? tmpl : [])
  }

  useEffect(() => {
    loadPlans().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  async function handleCreateNew(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim()) return
    setCreating(true)
    setCreateError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createName.trim(),
        content: [],
        total_calories: parseInt(createCalories) || 0,
        start_date: createStartDate,
        end_date: createEndDate || null,
      }),
    })
    if (res.ok) {
      setShowCreateModal(false)
      setCreateName('')
      setCreateCalories('')
      setCreateStartDate(new Date().toISOString().slice(0, 10))
      setCreateEndDate('')
      await loadPlans()
    } else {
      const body = await res.json().catch(() => ({}))
      setCreateError(body.error ?? 'Failed to create meal plan')
    }
    setCreating(false)
  }

  async function handleSaveAsTemplate(planId: string) {
    setSavingTemplateId(planId)
    await fetch(`/api/coach/clients/${clientId}/meal-plans/${planId}/save-as-template`, { method: 'POST' })
    setSavingTemplateId(null)
    setSavedTemplateId(planId)
    setTimeout(() => setSavedTemplateId(null), 3000)
  }

  async function handleAssign() {
    if (!selectedTemplateId) return
    setAssigning(true)
    setAssignError(null)
    const template = templates.find((t) => t.id === selectedTemplateId)
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_plan_id: selectedTemplateId,
        name: template?.name ?? 'Meal Plan',
        content: template?.content ?? [],
        start_date: startDate,
        end_date: endDate || null,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setAssignments((prev) => [...prev, created].sort((a, b) => b.start_date.localeCompare(a.start_date)))
      setShowAssign(false)
      setEndDate('')
    } else {
      const body = await res.json().catch(() => ({}))
      setAssignError(body.error ?? 'Failed to assign meal plan')
    }
    setAssigning(false)
  }

  async function handleDuplicate(plan: ClientMealPlan) {
    setDuplicatingId(plan.id)
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans/${plan.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Copy of ${plan.name}` }),
    })
    if (res.ok) {
      const created = await res.json()
      setAssignments((prev) => [...prev, created].sort((a, b) => b.start_date.localeCompare(a.start_date)))
    }
    setDuplicatingId(null)
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this meal plan from client?')) return
    await fetch(`/api/coach/clients/${clientId}/meal-plans/${id}`, { method: 'DELETE' })
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  function openDateEditor(plan: ClientMealPlan) {
    setEditingDatesId(plan.id)
    setEditStartDate(plan.start_date)
    setEditEndDate(plan.end_date ?? '')
  }

  async function handleSaveDates(planId: string) {
    setSavingDatesId(planId)
    const today = new Date().toISOString().split('T')[0]
    const newEndDate = editEndDate || null
    // Auto-expire if end date is in the past
    const autoStatus = newEndDate && newEndDate < today ? 'inactive' : undefined
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_date: editStartDate,
        end_date: newEndDate,
        ...(autoStatus ? { status: autoStatus } : {}),
      }),
    })
    if (res.ok) {
      setAssignments((prev) =>
        prev.map((a) => a.id === planId
          ? { ...a, start_date: editStartDate, end_date: newEndDate, ...(autoStatus ? { status: autoStatus } : {}) }
          : a
        ).sort((a, b) => b.start_date.localeCompare(a.start_date))
      )
      setEditingDatesId(null)
    }
    setSavingDatesId(null)
  }

  async function handleToggleStatus(plan: ClientMealPlan) {
    const newStatus = plan.status === 'active' ? 'inactive' : 'active'
    const res = await fetch(`/api/coach/clients/${clientId}/meal-plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setAssignments((prev) => prev.map((a) => a.id === plan.id ? { ...a, status: newStatus } : a))
    }
  }

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Loading meal plans…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {assignments.length === 0 ? 'No meal plans assigned' : `${assignments.length} plan${assignments.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create New
          </button>
          <button
            onClick={() => setShowAssign(true)}
            className="text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Assign Template
          </button>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
        <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-xs text-blue-700">Clients can see <strong>all active meal plans</strong> and switch between them using tabs — useful for e.g. a training day and a rest day plan. Plans without an end date stay active indefinitely alongside any others.</p>
      </div>

      {assignments.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 mb-1">No meal plan assigned</p>
          <p className="text-xs text-gray-400 mb-4">Assign a nutrition plan template to this client.</p>
          <button onClick={() => setShowAssign(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            + Assign Plan
          </button>
        </div>
      )}

      {assignments.map((plan) => {
        const totalCals = plan.content.reduce((a, slot) => a + slot.foods.reduce((b, f) => b + f.calories, 0), 0)
        const isEditingDates = editingDatesId === plan.id
        return (
          <div key={plan.id} className={`bg-white rounded-2xl border overflow-hidden ${plan.status !== 'active' ? 'opacity-75' : ''}`}>
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                  <button
                    onClick={() => handleToggleStatus(plan)}
                    title={plan.status === 'active' ? 'Mark as inactive' : 'Mark as active'}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                      plan.status === 'active'
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${plan.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {plan.status === 'active' ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs text-gray-400">
                    {new Date(plan.start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {plan.end_date ? ` – ${new Date(plan.end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    {' · '}{Math.round(totalCals)} kcal/day
                  </p>
                  {plan.show_macros === false && (
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-1.5 py-0.5 leading-none">macros hidden</span>
                  )}
                  <button
                    onClick={() => isEditingDates ? setEditingDatesId(null) : openDateEditor(plan)}
                    className="text-gray-300 hover:text-blue-500 transition-colors"
                    title="Edit dates"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}
                  className="text-xs font-semibold text-blue-600 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  {expanded === plan.id ? 'Hide' : 'View'}
                </button>
                <button onClick={() => handleRemove(plan.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Inline date editor */}
            {isEditingDates && (
              <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                <div className="flex items-end gap-3 pt-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Start date</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">End date <span className="font-normal">(optional)</span></label>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {editEndDate && (
                    <button
                      onClick={() => setEditEndDate('')}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors pb-2"
                    >
                      Clear end
                    </button>
                  )}
                  <button
                    onClick={() => handleSaveDates(plan.id)}
                    disabled={savingDatesId === plan.id || !editStartDate}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingDatesId === plan.id ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingDatesId(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {expanded === plan.id && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {plan.content.map((slot) => (
                  <div key={slot.id} className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{slot.label}</p>
                    <div className="space-y-1.5">
                      {slot.foods.map((f, fi) => (
                        <div key={fi} className="flex items-center justify-between text-sm">
                          <span className="text-gray-800">{f.food_name}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{f.grams}g</span>
                            <span className="font-medium text-gray-600">{f.calories} kcal</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Action buttons */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-gray-50">
              <a
                href={`/coach/clients/${clientId}/meal-plans/${plan.id}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Edit Plan →
              </a>
              <span className="text-gray-200">|</span>
              <button
                onClick={() => handleDuplicate(plan)}
                disabled={duplicatingId === plan.id}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {duplicatingId === plan.id ? 'Duplicating…' : 'Duplicate'}
              </button>
              <span className="text-gray-200">|</span>
              <button
                onClick={() => handleSaveAsTemplate(plan.id)}
                disabled={savingTemplateId === plan.id}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {savedTemplateId === plan.id ? 'Saved ✓' : savingTemplateId === plan.id ? 'Saving…' : 'Save as Template'}
              </button>
            </div>
          </div>
        )
      })}

      {/* Assign modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Assign Meal Plan</h2>
              <button onClick={() => { setShowAssign(false); setAssignError(null) }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {assignError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{assignError}</div>
            )}

            {templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-3">No meal plan templates yet.</p>
                <a href="/coach/meal-plans" className="text-sm font-semibold text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                  Create a plan first →
                </a>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                        selectedTemplateId === t.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{t.goal} · {t.total_calories.toLocaleString()} kcal</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End date <span className="font-normal text-gray-400">(optional)</span></label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowAssign(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedTemplateId || assigning}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {assigning ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create New modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Create New Meal Plan</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateNew} className="space-y-4">
              {createError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{createError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Plan name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Cut Phase Week 1"
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Calorie target
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={createCalories}
                    onChange={(e) => setCreateCalories(e.target.value)}
                    placeholder="2000"
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kcal</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
                  <input
                    type="date"
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End date <span className="font-normal text-gray-400">(optional)</span></label>
                  <input
                    type="date"
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createName.trim()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Habits tab ────────────────────────────────────────────────────────────────

type Habit = {
  id: string
  name: string
  type: string
  target: number
  unit: string
  icon: string
  active: boolean
}

const HABIT_PRESETS = [
  { name: 'Daily Steps', icon: '👟', unit: 'steps', target: 10000 },
  { name: 'Water Intake', icon: '💧', unit: 'glasses', target: 8 },
  { name: 'Sleep Hours', icon: '😴', unit: 'hours', target: 8 },
  { name: 'Protein Target', icon: '🥩', unit: 'g protein', target: 150 },
  { name: 'No Alcohol', icon: '🚫', unit: 'times', target: 1 },
  { name: 'Morning Walk', icon: '🌅', unit: 'times', target: 1 },
]

// ── CheckinSchedulesPanel ─────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type CheckinSchedule = {
  id: string
  title: string
  form_id: string | null
  form_title: string | null
  day_of_week: number
  repeat_type: string
  start_date: string
  is_active: boolean
  created_at: string
}

type ScheduleForm = {
  id: string
  title: string
  type: string
}

type ScheduleModalState = {
  open: boolean
  editing: CheckinSchedule | null
}

const REPEAT_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'One-time' },
]

// Ensures the schedule's form is a client-specific copy, then opens the editor
function EditFormButton({ scheduleId, clientId }: { scheduleId: string; clientId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch(
      `/api/coach/clients/${clientId}/checkin-schedules/${scheduleId}/ensure-copy`,
      { method: 'POST' }
    )
    setLoading(false)
    if (!res.ok) { alert('Could not open form editor'); return }
    const { form_id } = await res.json()
    window.open(`/coach/forms/${form_id}/edit?clientId=${clientId}`, '_blank')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
    >
      {loading ? 'Opening…' : 'Edit Form'}
    </button>
  )
}

// ── Expandable check-in response cards ───────────────────────────────────────

function AnswerRow({ label, value, type }: { label: string; value: string; type: string }) {
  let display = value
  if (type === 'yesno') display = value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) display = parsed.join(', ')
  } catch { /* not JSON */ }
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{display || '—'}</p>
    </div>
  )
}

function CheckinFeedbackViaMessages({ clientId, checkinDate, checkinLabel, responseId, patchUrl, initialReviewed, initialFeedback }: {
  clientId: string
  checkinDate: string
  checkinLabel: string
  responseId?: string
  patchUrl?: string
  initialReviewed?: boolean
  initialFeedback?: string
}) {
  const [reviewed, setReviewed] = useState(initialReviewed ?? false)
  const [feedback, setFeedback] = useState(initialFeedback ?? '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const effectivePatchUrl = patchUrl ?? (responseId ? `/api/coach/clients/${clientId}/autoflow-responses/${responseId}` : null)

  async function handleSend() {
    if (!feedback.trim()) return
    setSending(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const convoRes = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId: session.user.id, clientId }),
      })
      if (!convoRes.ok) return
      const { id: conversationId } = await convoRes.json()

      const date = new Date(checkinDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      const body = `Re: ${checkinLabel} (${date})\n\n${feedback.trim()}`

      const [msgRes] = await Promise.all([
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        }),
        effectivePatchUrl
          ? fetch(effectivePatchUrl, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ coach_feedback: feedback.trim() }),
            })
          : Promise.resolve(),
      ])
      if (msgRes.ok) {
        setSent(true)
        setTimeout(() => setSent(false), 3000)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coach feedback</p>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={async (e) => {
              const val = e.target.checked
              setReviewed(val)
              if (effectivePatchUrl) {
                await fetch(effectivePatchUrl, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reviewed_by_coach: val }),
                })
              }
            }}
            className="rounded"
          />
          <span className={`text-xs font-medium ${reviewed ? 'text-green-600' : 'text-gray-400'}`}>
            {reviewed ? 'Reviewed' : 'Mark as reviewed'}
          </span>
        </label>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={6}
        placeholder="Write feedback to send to client…"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
      <button
        onClick={handleSend}
        disabled={sending || !feedback.trim()}
        className="text-xs font-semibold bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {sending ? 'Sending…' : sent ? 'Sent via messages!' : 'Send check-in feedback (sent via messages)'}
      </button>
    </div>
  )
}

function ExpandableAutoflowCheckIn({ item, clientId, onDelete }: { item: AutoflowCheckIn; clientId: string; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const hasAnswers = item.questions.length > 0 && Object.keys(item.answers).length > 0

  async function handleDelete() {
    if (!confirm('Delete this check-in response?')) return
    setDeleting(true)
    const res = await fetch(`/api/coach/clients/${clientId}/autoflow-responses/${item.id}`, { method: 'DELETE' })
    if (res.ok) onDelete(item.id)
    else setDeleting(false)
  }

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-xs font-medium text-gray-400">{fmt(item.submitted_at)}</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{item.flow_name} — Step {item.step_number}</p>
          <p className="text-xs text-gray-400 mt-0.5">Autoflow check-in</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? '…' : 'Delete'}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
          >
            {open ? 'Hide' : 'View responses'}
            <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="px-5 pb-3 border-t border-gray-100">
          {item.questions.length === 0 ? (
            <p className="text-xs text-gray-400 pt-3">No answers recorded.</p>
          ) : (
            <div className="pt-2">
              {item.questions.map((q) => (
                q.id in item.answers
                  ? <AnswerRow key={q.id} label={q.label} value={item.answers[q.id]} type={q.type} />
                  : (
                    <div key={q.id} className="py-2 border-b border-gray-50 last:border-0">
                      <p className="text-xs text-gray-400">{q.label}</p>
                      <p className="text-sm text-gray-400 italic mt-0.5">Client did not answer</p>
                    </div>
                  )
              ))}
            </div>
          )}
        </div>
      )}
      <div className="px-5 pb-5 border-t border-gray-100">
        <CheckinFeedbackViaMessages
          clientId={clientId}
          checkinDate={item.submitted_at}
          checkinLabel={`${item.flow_name} — Step ${item.step_number}`}
          responseId={item.id}
          initialReviewed={item.reviewed_by_coach ?? false}
          initialFeedback={item.coach_feedback ?? ''}
        />
      </div>
    </div>
  )
}

function ExpandableFormCheckIn({ item, clientId, onDelete }: { item: FormCheckIn; clientId: string; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<{ label: string; type: string; value: string | null; answered: boolean }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleExpand() {
    const next = !open
    setOpen(next)
    if (next && answers === null) {
      setLoading(true)
      try {
        const res = await fetch(`/api/coach/forms/${item.form_id}/responses/${item.id}`)
        if (res.ok) {
          const d = await res.json()
          setAnswers(d.answers ?? [])
        } else {
          setAnswers([])
        }
      } finally {
        setLoading(false)
      }
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this check-in response?')) return
    setDeleting(true)
    const res = await fetch(`/api/coach/forms/${item.form_id}/responses/${item.id}`, { method: 'DELETE' })
    if (res.ok) onDelete(item.id)
    else setDeleting(false)
  }

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-xs font-medium text-gray-400">{fmt(item.submitted_at)}</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{item.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">Check-in form</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? '…' : 'Delete'}
          </button>
          <button
            onClick={handleExpand}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
          >
            {open ? 'Hide' : 'View responses'}
            <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="px-5 pb-3 border-t border-gray-100">
          {loading ? (
            <p className="text-xs text-gray-400 pt-3">Loading…</p>
          ) : !answers?.length ? (
            <p className="text-xs text-gray-400 pt-3">No answers recorded.</p>
          ) : (
            <div className="pt-2">
              {answers.map((a, i) => (
                a.answered
                  ? <AnswerRow key={i} label={a.label} value={a.value ?? ''} type={a.type} />
                  : (
                    <div key={i} className="py-2 border-b border-gray-50 last:border-0">
                      <p className="text-xs text-gray-400">{a.label}</p>
                      <p className="text-sm text-gray-400 italic mt-0.5">Client did not answer</p>
                    </div>
                  )
              ))}
            </div>
          )}
        </div>
      )}
      <div className="px-5 pb-5 border-t border-gray-100">
        <CheckinFeedbackViaMessages
          clientId={clientId}
          checkinDate={item.submitted_at}
          checkinLabel={item.title}
          patchUrl={`/api/coach/forms/${item.form_id}/responses/${item.id}`}
          initialReviewed={item.viewed_by_coach ?? false}
          initialFeedback={item.coach_feedback ?? ''}
        />
      </div>
    </div>
  )
}

function CheckinSchedulesPanel({ clientId }: { clientId: string }) {
  const [schedules, setSchedules] = useState<CheckinSchedule[]>([])
  const [coachForms, setCoachForms] = useState<ScheduleForm[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ScheduleModalState>({ open: false, editing: null })

  // Form state
  const [title, setTitle] = useState('')
  const [formId, setFormId] = useState<string>('new')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [repeatType, setRepeatType] = useState('weekly')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  async function loadSchedules() {
    const res = await fetch(`/api/coach/clients/${clientId}/checkin-schedules`)
    if (res.ok) {
      const data: CheckinSchedule[] = await res.json()
      setSchedules(data)
    }
  }

  async function loadForms() {
    const res = await fetch('/api/forms')
    if (res.ok) {
      const data: ScheduleForm[] = await res.json()
      setCoachForms(data.filter((f) => f.type === 'weekly_checkin'))
    }
  }

  useEffect(() => {
    Promise.all([loadSchedules(), loadForms()]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function openAddModal() {
    setModal({ open: true, editing: null })
    setTitle('')
    setFormId('new')
    setDayOfWeek(1)
    setRepeatType('weekly')
    setStartDate(new Date().toISOString().split('T')[0])
    setIsActive(true)
    setModalError(null)
  }

  function openEditModal(s: CheckinSchedule) {
    setModal({ open: true, editing: s })
    setTitle(s.title)
    setFormId(s.form_id ?? 'new')
    setDayOfWeek(s.day_of_week)
    setRepeatType(s.repeat_type)
    setStartDate(s.start_date)
    setIsActive(s.is_active)
    setModalError(null)
  }

  function closeModal() {
    setModal({ open: false, editing: null })
    setModalError(null)
  }

  async function handleSave() {
    if (!title.trim()) { setModalError('Title is required'); return }
    setSaving(true)
    setModalError(null)

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        day_of_week: dayOfWeek,
        repeat_type: repeatType,
        start_date: startDate,
        is_active: isActive,
      }
      if (formId !== 'new') body.form_id = formId

      let res: Response
      if (modal.editing) {
        res = await fetch(`/api/coach/clients/${clientId}/checkin-schedules/${modal.editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`/api/coach/clients/${clientId}/checkin-schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const d = await res.json()
        setModalError(d.error ?? 'Something went wrong')
        return
      }

      await loadSchedules()
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(s: CheckinSchedule) {
    await fetch(`/api/coach/clients/${clientId}/checkin-schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !s.is_active }),
    })
    await loadSchedules()
  }

  async function handleDelete(s: CheckinSchedule) {
    if (!confirm(`Delete schedule "${s.title}"?`)) return
    await fetch(`/api/coach/clients/${clientId}/checkin-schedules/${s.id}`, { method: 'DELETE' })
    await loadSchedules()
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Loading schedules…</p>

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Scheduled Check-ins</p>
        <button
          onClick={openAddModal}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-900 hover:opacity-90 transition-colors"
          style={{ backgroundColor: '#1D9E75' }}
        >
          + Add Schedule
        </button>
      </div>

      {schedules.length === 0 && (
        <p className="text-sm text-gray-400">No check-in schedules yet. Add one to prompt the client automatically.</p>
      )}

      <div className="space-y-3">
        {schedules.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {DAY_NAMES[s.day_of_week]} · {REPEAT_OPTIONS.find((r) => r.value === s.repeat_type)?.label ?? s.repeat_type}
                {s.form_title ? ` · ${s.form_title}` : ' · No form'}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => openEditModal(s)}
                className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-white transition-colors"
              >
                Edit
              </button>
              {s.form_id && (
                <EditFormButton scheduleId={s.id} clientId={clientId} />
              )}
              <button
                onClick={() => handleToggleActive(s)}
                className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-white transition-colors"
              >
                {s.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => handleDelete(s)}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">
              {modal.editing ? 'Edit Schedule' : 'Add Check-in Schedule'}
            </h3>

            {modalError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{modalError}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Weekly Check-in"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Day of Week</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {DAY_NAMES.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Repeat</label>
                <select
                  value={repeatType}
                  onChange={(e) => setRepeatType(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {REPEAT_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Form</label>
                <select
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="new">Create new form</option>
                  {coachForms.map((f) => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="schedule-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="schedule-active" className="text-sm text-gray-700">Active</label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={closeModal}
                className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl text-gray-900 hover:opacity-90 transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#1D9E75' }}
              >
                {saving ? 'Saving…' : modal.editing ? 'Save Changes' : 'Add Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HabitsTab({ clientId }: { clientId: string }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '✓', unit: 'times', target: '1' })
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [editForm, setEditForm] = useState({ name: '', icon: '', unit: '', target: '' })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/habits`)
      .then((r) => r.json())
      .then((d) => setHabits(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [clientId])

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch(`/api/coach/clients/${clientId}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, icon: form.icon, unit: form.unit, target: Number(form.target) || 1, type: 'daily' }),
    })
    if (res.ok) {
      const created = await res.json()
      setHabits((prev) => [created, ...prev])
      setShowAdd(false)
      setForm({ name: '', icon: '✓', unit: 'times', target: '1' })
    }
    setSaving(false)
  }

  async function toggleActive(habit: Habit) {
    await fetch(`/api/coach/clients/${clientId}/habits/${habit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !habit.active }),
    })
    setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, active: !h.active } : h))
  }

  function openEdit(habit: Habit) {
    setEditingHabit(habit)
    setEditForm({ name: habit.name, icon: habit.icon, unit: habit.unit, target: String(habit.target) })
  }

  async function handleEdit() {
    if (!editingHabit || !editForm.name.trim()) return
    setEditSaving(true)
    const res = await fetch(`/api/coach/clients/${clientId}/habits/${editingHabit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        icon: editForm.icon,
        unit: editForm.unit,
        target: Number(editForm.target) || 1,
        active: editingHabit.active,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setHabits((prev) => prev.map((h) => h.id === updated.id ? updated : h))
      setEditingHabit(null)
    }
    setEditSaving(false)
  }

  async function deleteHabit(id: string) {
    if (!confirm('Remove this habit from client?')) return
    await fetch(`/api/coach/clients/${clientId}/habits/${id}`, { method: 'DELETE' })
    setHabits((prev) => prev.filter((h) => h.id !== id))
  }

  function usePreset(preset: typeof HABIT_PRESETS[0]) {
    setForm({ name: preset.name, icon: preset.icon, unit: preset.unit, target: String(preset.target) })
  }

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Loading habits…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {habits.length === 0 ? 'No habits assigned' : `${habits.filter((h) => h.active).length} active habits`}
          </p>
          {habits.some((h) => h.active) && (
            <p className="text-xs text-gray-400 mt-0.5">Active habits appear every day in your client&apos;s app.</p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Add Habit
        </button>
      </div>

      {habits.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm text-gray-500 mb-1">No habits assigned</p>
          <p className="text-xs text-gray-400 mb-4">Add daily habits like steps, water, sleep targets for your client to track.</p>
          <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            Add first habit
          </button>
        </div>
      )}

      {habits.map((habit) => (
        <div key={habit.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${!habit.active ? 'opacity-50' : ''}`}>
          <span className="text-2xl">{habit.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{habit.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Target: {habit.target} {habit.unit} · {habit.type}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Edit */}
            <button
              onClick={() => openEdit(habit)}
              className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              title="Edit habit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {/* Active/Deactivate toggle */}
            <button
              onClick={() => toggleActive(habit)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                habit.active
                  ? 'bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500'
                  : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600'
              }`}
              title={habit.active ? 'Click to deactivate' : 'Click to activate'}
            >
              {habit.active ? 'Active' : 'Inactive'}
            </button>
            {/* Delete */}
            <button onClick={() => deleteHabit(habit.id)} className="text-gray-300 hover:text-red-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      {/* Edit habit modal */}
      {editingHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Edit Habit</h2>
              <button onClick={() => setEditingHabit(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editForm.icon}
                  onChange={(e) => setEditForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="🎯"
                  className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Habit name"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={editForm.target}
                  onChange={(e) => setEditForm((f) => ({ ...f, target: e.target.value }))}
                  placeholder="Target"
                  className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={editForm.unit}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="unit (steps, glasses…)"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* Deactivate toggle inside edit modal */}
              <button
                onClick={() => setEditingHabit((h) => h ? { ...h, active: !h.active } : h)}
                className={`w-full py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  editingHabit.active
                    ? 'border-red-200 text-red-500 hover:bg-red-50'
                    : 'border-green-200 text-green-600 hover:bg-green-50'
                }`}
              >
                {editingHabit.active ? 'Deactivate this habit' : 'Activate this habit'}
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingHabit(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!editForm.name.trim() || editSaving}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add habit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Add Habit</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Presets */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick add</p>
              <div className="grid grid-cols-3 gap-1.5">
                {HABIT_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => usePreset(p)}
                    className="text-xs text-left border border-gray-200 rounded-lg p-2 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-base">{p.icon}</span>
                    <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{p.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="🎯"
                  className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Habit name"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                  placeholder="Target"
                  className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="unit (steps, glasses…)"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim() || saving}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add Habit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

// ── Autoflow check-ins linked section ────────────────────────────────────────

type LinkedAutoflow = {
  id: string
  name: string
  start_date: string
  status: string
  autoflow_templates: { type: string; total_steps: number } | null
  autoflow_responses: { step_number: number }[]
}

function AssignAutoflowButton({ clientId, onAssigned }: { clientId: string; onAssigned?: () => void }) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<{ id: string; name: string; type: string }[] | null>(null)
  const [templateId, setTemplateId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [showAsCheckin, setShowAsCheckin] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpen() {
    setOpen(true)
    setDone(false)
    setError(null)
    setTemplateId('')
    setShowAsCheckin(true)
    if (!templates) {
      const res = await fetch('/api/coach/autoflows')
      if (res.ok) setTemplates(await res.json())
    }
  }

  async function handleAssign() {
    if (!templateId) return
    setAssigning(true)
    setError(null)
    const res = await fetch(`/api/coach/clients/${clientId}/autoflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, start_date: startDate, show_as_checkin_prompt: showAsCheckin }),
    })
    setAssigning(false)
    if (res.ok) { setDone(true); onAssigned?.() }
    else { const d = await res.json(); setError(d.error ?? 'Failed') }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full bg-white border border-dashed border-gray-300 rounded-2xl px-4 py-3 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-center"
      >
        + Assign check-in autoflow
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-900">Assign autoflow</h2>

            {done ? (
              <div className="space-y-4">
                <p className="text-sm text-green-600 font-medium">Assigned successfully!</p>
                <button onClick={() => setOpen(false)} className="w-full bg-gray-100 text-gray-700 font-semibold py-2 rounded-xl text-sm hover:bg-gray-200 transition-colors">Close</button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Autoflow</label>
                  {!templates ? (
                    <p className="text-sm text-gray-400">Loading…</p>
                  ) : templates.length === 0 ? (
                    <p className="text-sm text-gray-400">No autoflows found. Create one first.</p>
                  ) : (
                    <select
                      value={templateId}
                      onChange={e => setTemplateId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an autoflow…</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Assign as check-in</p>
                    <p className="text-xs text-gray-400">Shows as a check-in prompt on client dashboard</p>
                  </div>
                  <div
                    onClick={() => setShowAsCheckin(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${showAsCheckin ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showAsCheckin ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </label>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setOpen(false)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2 rounded-xl text-sm hover:bg-gray-200 transition-colors">Cancel</button>
                  <button
                    onClick={handleAssign}
                    disabled={!templateId || assigning}
                    className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {assigning ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function AutoflowCheckinsLinked({ clientId, onViewFlows, refreshKey }: { clientId: string; onViewFlows: () => void; refreshKey?: number }) {
  const [flows, setFlows] = useState<LinkedAutoflow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    fetch(`/api/coach/clients/${clientId}/autoflows`)
      .then(r => r.json())
      .then(d => {
        const all: LinkedAutoflow[] = Array.isArray(d) ? d : []
        setFlows(all.filter(f => f.autoflow_templates?.type === 'weekly_checkin'))
      })
      .finally(() => setLoaded(true))
  }, [clientId, refreshKey])

  if (!loaded || flows.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Autoflow Check-ins</p>
      {flows.map(f => {
        const completed = f.autoflow_responses?.length ?? 0
        const total = f.autoflow_templates?.total_steps ?? 0
        return (
          <button
            key={f.id}
            onClick={onViewFlows}
            className="w-full text-left bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:border-orange-300 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{f.name}</p>
                <p className="text-xs text-gray-500">{completed}/{total} steps completed · started {new Date(f.start_date + 'T00:00:00').toLocaleDateString()}</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-orange-600 group-hover:text-orange-800 flex-shrink-0 flex items-center gap-1">
              View
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Client Resources Tab ──────────────────────────────────────────────────────

type ClientResource = {
  id: string
  assigned_at: string
  coach_resources: {
    id: string
    name: string
    description: string | null
    type: 'link' | 'video' | 'pdf' | 'document'
    url: string | null
    coach_resource_folders: { id: string; name: string; color: string; icon: string } | null
  } | null
}

type CoachResource = {
  id: string
  name: string
  description: string | null
  type: 'link' | 'video' | 'pdf' | 'document'
  url: string | null
  folder_id: string | null
  coach_resource_folders: { id: string; name: string; color: string; icon: string } | null
}

const RESOURCE_TYPE_ICON: Record<string, string> = { link: '🔗', video: '🎬', pdf: '📄', document: '📝' }

function ClientResourcesTab({ clientId }: { clientId: string }) {
  const [assignments, setAssignments] = useState<ClientResource[]>([])
  const [library, setLibrary] = useState<CoachResource[]>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  async function load() {
    const [aRes, lRes] = await Promise.all([
      fetch(`/api/coach/clients/${clientId}/resources`).then(r => r.json()),
      fetch('/api/coach/resources').then(r => r.json()),
    ])
    setAssignments(Array.isArray(aRes) ? aRes : [])
    setLibrary(Array.isArray(lRes) ? lRes : [])
  }

  useEffect(() => { load().finally(() => setLoading(false)) }, [clientId])

  async function handleAssign(resourceId: string) {
    setAssigning(resourceId)
    const res = await fetch(`/api/coach/clients/${clientId}/resources`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_id: resourceId }),
    })
    if (res.ok) {
      const row = await res.json()
      setAssignments(prev => [row, ...prev.filter(a => a.coach_resources?.id !== resourceId)])
    }
    setAssigning(null)
  }

  async function handleRemove(resourceId: string) {
    if (!confirm('Remove this resource from the client?')) return
    await fetch(`/api/coach/clients/${clientId}/resources/${resourceId}`, { method: 'DELETE' })
    setAssignments(prev => prev.filter(a => a.coach_resources?.id !== resourceId))
  }

  const assignedIds = new Set(assignments.map(a => a.coach_resources?.id).filter(Boolean))
  const unassigned = library.filter(r => !assignedIds.has(r.id))

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">Loading resources…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {assignments.length === 0 ? 'No resources assigned' : `${assignments.length} resource${assignments.length !== 1 ? 's' : ''} assigned`}
        </p>
        <button onClick={() => setShowPicker(v => !v)}
          className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          + Assign resource
        </button>
      </div>

      {showPicker && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-800">Pick from your library</p>
          {unassigned.length === 0 ? (
            <p className="text-sm text-blue-600">All resources are already assigned, or your library is empty.{' '}
              <a href="/coach/resources" target="_blank" className="underline">Add resources →</a>
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {unassigned.map(r => (
                <button key={r.id} onClick={() => handleAssign(r.id)} disabled={assigning === r.id}
                  className="text-left flex items-start gap-2 bg-white rounded-xl border border-blue-200 hover:border-blue-400 p-3 transition-colors disabled:opacity-50">
                  <span className="text-base flex-shrink-0 mt-0.5">{RESOURCE_TYPE_ICON[r.type] ?? '📝'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                    {r.coach_resource_folders && (
                      <p className="text-xs text-gray-400">{r.coach_resource_folders.icon} {r.coach_resource_folders.name}</p>
                    )}
                  </div>
                  {assigning === r.id && <span className="ml-auto text-xs text-blue-500">Adding…</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-3xl mb-2">📚</div>
          <p className="text-sm text-gray-500 mb-1">No resources assigned yet.</p>
          <p className="text-xs text-gray-400">Assign resources from your library for this client to access.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assignments.map(a => {
            const r = a.coach_resources
            if (!r) return null
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start justify-between gap-3 group">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0 mt-0.5">{RESOURCE_TYPE_ICON[r.type] ?? '📝'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                    {r.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{r.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {r.coach_resource_folders && (
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {r.coach_resource_folders.icon} {r.coach_resource_folders.name}
                        </span>
                      )}
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-blue-500 hover:underline truncate max-w-[120px]">
                          Open →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleRemove(r.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ClientServeGuide ─────────────────────────────────────────────────────────

type ServeFood = {
  id: string; food_name: string; serving_desc: string | null
  calories_per_serve: number | null; protein_per_serve: number | null
  carbs_per_serve: number | null; fat_per_serve: number | null
  serve_category: string; secondary_categories: string[]
}
type ServeTargets = {
  protein_serves: number; carb_serves: number; fat_serves: number
  fruit_serves: number; veg_unlimited: boolean; notes: string | null
} | null

const CAT_CONFIG: Record<string, { label: string; serve: string; badge: string; color: string }> = {
  protein:   { label: 'Protein',      serve: '1 serve ≈ 30g protein',  badge: 'bg-pink-100 text-pink-700',    color: 'bg-pink-50' },
  carb:      { label: 'Carbs',        serve: '1 serve ≈ 20g carbs',    badge: 'bg-purple-100 text-purple-700',color: 'bg-purple-50' },
  fruit:     { label: 'Fruit',        serve: '1 serve ≈ 20g carbs',    badge: 'bg-orange-100 text-orange-700',color: 'bg-orange-50' },
  fat:       { label: 'Fats',         serve: '1 serve ≈ 10g fat',      badge: 'bg-green-100 text-green-700',  color: 'bg-green-50' },
  condiment: { label: 'Condiments',   serve: '~1 fat or carb serve',   badge: 'bg-blue-100 text-blue-700',    color: 'bg-blue-50' },
  free:      { label: 'Free Foods',   serve: 'Unlimited',              badge: 'bg-gray-100 text-gray-600',    color: 'bg-gray-50' },
}
const SEC_LABELS: Record<string, string> = { fat: '+ 1 fat', carb: '+ 1 carb', fat_half: '+ ½ fat', carb_half: '+ ½ carb', protein_half: '+ ½ protein', protein: '+ 1 protein' }
const SEC_COLORS: Record<string, string> = { fat: 'bg-green-100 text-green-700', carb: 'bg-purple-100 text-purple-700', fat_half: 'bg-green-50 text-green-600', carb_half: 'bg-purple-50 text-purple-600', protein_half: 'bg-pink-50 text-pink-600', protein: 'bg-pink-100 text-pink-700' }

function macrosToServes(macros: { proteinG: number; carbG: number; fatG: number }) {
  const roundHalf = (n: number) => Math.round(n * 2) / 2
  const fruit_serves = 2
  // Reserve carb budget for fruit (2 × 20g) and veg (~150 kcal ÷ 4 kcal/g ≈ 38g carbs)
  const vegCarbG = Math.round(150 / 4)
  const remainingCarbG = Math.max(0, macros.carbG - fruit_serves * 20 - vegCarbG)
  return {
    protein_serves: roundHalf(macros.proteinG / 30),
    carb_serves: roundHalf(remainingCarbG / 20),
    fat_serves: roundHalf(macros.fatG / 10),
    fruit_serves,
    veg_unlimited: true,
  }
}

function ClientServeGuide({ clientId }: { clientId: string }) {
  const [foods, setFoods] = useState<ServeFood[]>([])
  const [targets, setTargets] = useState<ServeTargets>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'simple' | 'detailed'>('simple')
  const [editingTargets, setEditingTargets] = useState(false)
  const [draft, setDraft] = useState({ protein_serves: 0, carb_serves: 0, fat_serves: 0, fruit_serves: 0, veg_unlimited: true, notes: '' })
  const [savingTargets, setSavingTargets] = useState(false)
  const [removingTargets, setRemovingTargets] = useState(false)
  const [autoAssign, setAutoAssign] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/coach/food-serves').then(r => r.json()),
      fetch(`/api/coach/clients/serve-targets?clientId=${clientId}`).then(r => r.json()),
    ]).then(([fd, td]) => {
      setFoods(fd.foods ?? [])
      if (td.targets) {
        setTargets(td.targets)
        setDraft({ ...td.targets, notes: td.targets.notes ?? '' })
      }
    }).finally(() => setLoading(false))
  }, [clientId])

  function applyMacrosToServes(macros: { proteinG: number; carbG: number; fatG: number }) {
    const serves = macrosToServes(macros)
    setDraft(d => ({ ...d, ...serves }))
    setEditingTargets(true)
    setAutoAssign(true)
  }

  async function removeTargets() {
    if (!confirm('Remove serve targets for this client? They will no longer see the serve guide in their app.')) return
    setRemovingTargets(true)
    await fetch(`/api/coach/clients/serve-targets?clientId=${clientId}`, { method: 'DELETE' })
    setTargets(null)
    setEditingTargets(false)
    setRemovingTargets(false)
  }

  async function saveTargets() {
    setSavingTargets(true)
    const r = await fetch('/api/coach/clients/serve-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, ...draft }),
    })
    const d = await r.json()
    setTargets(d.targets)
    setEditingTargets(false)
    setSavingTargets(false)
    setAutoAssign(false)
  }

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm animate-pulse">Loading…</div>

  return (
    <div className="space-y-5">
      {/* TDEE calculator */}
      <TDEESection clientId={clientId} onApplyToServes={applyMacrosToServes} />

      {/* Serve targets panel */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Daily Serve Targets</h3>
            <p className="text-xs text-gray-400 mt-0.5">Set how many serves per day for this client</p>
          </div>
          <div className="flex items-center gap-3">
            {targets && !editingTargets && (
              <button onClick={removeTargets} disabled={removingTargets} className="text-xs text-red-500 hover:text-red-600 font-medium disabled:opacity-50">
                {removingTargets ? 'Removing…' : 'Remove'}
              </button>
            )}
            <button onClick={() => setEditingTargets(v => !v)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              {editingTargets ? 'Cancel' : targets ? 'Edit' : 'Set Targets'}
            </button>
          </div>
        </div>

        {editingTargets ? (
          <div className="space-y-4">
            {autoAssign && (
              <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5">
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-teal-700">Serves auto-calculated from TDEE — adjust if needed, then save.</p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { key: 'protein_serves', label: 'Protein', color: 'text-pink-600' },
                { key: 'carb_serves', label: 'Carbs', color: 'text-purple-600' },
                { key: 'fat_serves', label: 'Fats', color: 'text-green-600' },
                { key: 'fruit_serves', label: 'Fruit', color: 'text-orange-500' },
              ] as const).map(({ key, label, color }) => (
                <div key={key}>
                  <label className={`text-xs font-medium block mb-1 ${color}`}>{label} serves</label>
                  <input type="number" min="0" max="20" step="0.5"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
            {/* Estimated daily calories + macros */}
            {(draft.protein_serves > 0 || draft.carb_serves > 0 || draft.fat_serves > 0) && (() => {
              // Real-food estimates per serve (primary macro + typical mixed macros in real food):
              // Protein 135 kcal = 30g P (120) + ~3g fat typical in lean meat/eggs (+27, rounded down)
              // Carb    90 kcal = 20g C (80)  + ~3g protein typical in grains/legumes (+12, rounded down)
              // Fat     95 kcal = 10g F (90)  + small protein/carbs in nuts/seeds (+5)
              // Fruit   80 kcal = 20g C (80), minimal other macros
              // Veg     150 kcal = unlimited non-starchy veg (~500g typical day, accounts for variety incl. starchy veg)
              const vegCal = draft.veg_unlimited ? 150 : 0
              const estCal = Math.round(
                draft.protein_serves * 135 +
                draft.carb_serves   *  90 +
                draft.fat_serves    *  95 +
                draft.fruit_serves  *  80 +
                vegCal
              )
              const estP = Math.round(draft.protein_serves * 30)
              const estC = Math.round(draft.carb_serves * 20 + draft.fruit_serves * 20)
              const estF = Math.round(draft.fat_serves * 10)
              return (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700">Estimated daily <span className="font-normal text-amber-600">(real-food total, incl. ~{vegCal} kcal veg)</span></span>
                    <span className="text-sm font-bold text-amber-800">~{estCal} kcal</span>
                  </div>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-pink-600">~{estP}g P</span>
                    <span className="text-purple-600">~{estC}g C</span>
                    <span className="text-green-600">~{estF}g F</span>
                    <span className="text-gray-400 font-normal">(primary macros only)</span>
                  </div>
                  <p className="text-[11px] text-amber-600">Estimate includes real-food mixed macros (e.g. fat in protein foods, protein in grains) + ~150 kcal for veg. Note: the 150 kcal veg estimate is drawn from the carb budget when auto-assigning from TDEE.</p>
                </div>
              )
            })()}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes for client</label>
              <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="e.g. Choose 2 protein serves at dinner, 1 at lunch…" />
            </div>
            <div className="flex justify-end">
              <button onClick={saveTargets} disabled={savingTargets} className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingTargets ? 'Saving…' : 'Save Targets'}
              </button>
            </div>
          </div>
        ) : targets ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Protein', value: targets.protein_serves, color: 'bg-pink-50 text-pink-700 border-pink-100' },
                { label: 'Carbs', value: targets.carb_serves, color: 'bg-purple-50 text-purple-700 border-purple-100' },
                { label: 'Fats', value: targets.fat_serves, color: 'bg-green-50 text-green-700 border-green-100' },
                { label: 'Fruit', value: targets.fruit_serves, color: 'bg-orange-50 text-orange-700 border-orange-100' },
                { label: 'Veg', value: targets.veg_unlimited ? '∞' : '—', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
              ].map(s => (
                <div key={s.label} className={`border rounded-xl px-4 py-2.5 text-center min-w-[80px] ${s.color}`}>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              ~{Math.round(targets.protein_serves * 135 + targets.carb_serves * 90 + targets.fat_serves * 95 + targets.fruit_serves * 80 + 150)} kcal/day estimated (real-food total incl. mixed macros + ~150 kcal veg) · Veg is unlimited and already included in this estimate.
            </p>
            <p className="text-xs text-blue-500">
              Client can now see the &quot;Food Cheat Sheet&quot; link in their food log.
            </p>
            {targets.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 whitespace-pre-wrap">{targets.notes}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No targets set yet. Click "Set Targets" above.</p>
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setView('simple')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'simple' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Simple</button>
          <button onClick={() => setView('detailed')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'detailed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Detailed</button>
        </div>
        <p className="text-xs text-gray-400">Manage the food list in <a href="/coach/cheat-sheet" className="text-blue-500 hover:underline">Cheat Sheet settings</a></p>
      </div>

      {/* Food categories */}
      {foods.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-10 text-center">
          <p className="text-sm text-gray-400">No foods in cheat sheet yet.</p>
          <a href="/coach/cheat-sheet" className="text-xs text-blue-500 hover:underline mt-1 block">Add foods in Cheat Sheet settings →</a>
        </div>
      )}
      {Object.entries(CAT_CONFIG).map(([catId, cfg]) => {
        const catFoods = foods.filter(f => f.serve_category === catId)
        if (catFoods.length === 0) return null
        return (
          <div key={catId} className={`rounded-2xl border border-gray-100 overflow-hidden ${cfg.color}`}>
            <div className="px-5 py-3.5 flex items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{cfg.label}</h3>
                <p className="text-xs text-gray-500">{cfg.serve}</p>
              </div>
              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{catFoods.length}</span>
            </div>
            {view === 'detailed' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-white/60">
                      <th className="text-left px-5 py-2 text-xs font-semibold text-gray-400">Food / Serving</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Cal</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Carbs</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Fat</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Protein</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right">Extra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/60 bg-white/50">
                    {catFoods.map(f => (
                      <tr key={f.id} className="hover:bg-white/80 transition-colors">
                        <td className="px-5 py-2.5">
                          <span className="font-medium text-gray-900">{f.food_name}</span>
                          {f.serving_desc && <span className="text-gray-400 text-xs ml-2">{f.serving_desc}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums text-xs">{f.calories_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-purple-700 font-medium tabular-nums text-xs">{f.carbs_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-green-700 font-medium tabular-nums text-xs">{f.fat_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-pink-700 font-medium tabular-nums text-xs">{f.protein_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex gap-1 justify-end">
                            {(f.secondary_categories ?? []).map(s => (
                              <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${SEC_COLORS[s] ?? 'bg-gray-100 text-gray-500'}`}>
                                {SEC_LABELS[s] ?? s}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {catFoods.map(f => (
                  <div key={f.id} className="bg-white rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{f.food_name}</p>
                      {f.serving_desc && <p className="text-xs text-gray-400">{f.serving_desc}</p>}
                      {(f.secondary_categories ?? []).length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {f.secondary_categories.map(s => (
                            <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SEC_COLORS[s] ?? 'bg-gray-100 text-gray-500'}`}>
                              {SEC_LABELS[s] ?? s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Supplements Tab ───────────────────────────────────────────────────────────

type LibSupplement = {
  id: string; coach_id: string | null; name: string
  default_dosage: string | null; benefits: string | null; brand_url: string | null; considerations: string | null
}
type ClientSupplement = {
  id: string; supplement_id: string | null; name: string
  dosage: string | null; benefits: string | null; brand_url: string | null; notes: string | null; considerations: string | null
}

function SupplementsTab({ clientId }: { clientId: string }) {
  const [library, setLibrary] = useState<LibSupplement[]>([])
  const [assigned, setAssigned] = useState<ClientSupplement[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newDosage, setNewDosage] = useState('')
  const [newBenefits, setNewBenefits] = useState('')
  const [newBrandUrl, setNewBrandUrl] = useState('')
  const [newConsiderations, setNewConsiderations] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingLibId, setEditingLibId] = useState<string | null>(null)
  const [libEdits, setLibEdits] = useState<Partial<LibSupplement>>({})
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function startEditLib(sup: LibSupplement) {
    setEditingLibId(sup.id)
    setLibEdits({ name: sup.name, default_dosage: sup.default_dosage ?? '', benefits: sup.benefits ?? '', brand_url: sup.brand_url ?? '', considerations: sup.considerations ?? '' })
  }

  async function saveLibEdit(id: string) {
    const res = await fetch(`/api/coach/supplements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(libEdits),
    })
    if (res.ok) {
      const updated = await res.json()
      setLibrary(p => p.map(s => s.id === id ? updated : s))
    }
    setEditingLibId(null)
  }

  async function deleteLib(id: string) {
    await fetch(`/api/coach/supplements/${id}`, { method: 'DELETE' })
    setLibrary(p => p.filter(s => s.id !== id))
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/coach/supplements').then(r => r.json()),
      fetch(`/api/coach/clients/${clientId}/supplements`).then(r => r.json()),
    ]).then(([lib, asgn]) => {
      setLibrary(Array.isArray(lib) ? lib : [])
      setAssigned(Array.isArray(asgn) ? asgn : [])
    }).finally(() => setLoading(false))
  }, [clientId])

  async function assign(sup: LibSupplement) {
    const res = await fetch(`/api/coach/clients/${clientId}/supplements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplement_id: sup.id,
        name: sup.name,
        dosage: sup.default_dosage,
        benefits: sup.benefits,
        brand_url: sup.brand_url,
        considerations: sup.considerations,
      }),
    })
    const d = await res.json()
    if (res.ok) setAssigned(p => [...p, d])
  }

  async function addCustom() {
    if (!newName.trim()) return
    setSaving(true)
    const libRes = await fetch('/api/coach/supplements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), default_dosage: newDosage, benefits: newBenefits, brand_url: newBrandUrl, considerations: newConsiderations }),
    })
    const libData = await libRes.json()
    if (libRes.ok) setLibrary(p => [...p, libData])
    setNewName(''); setNewDosage(''); setNewBenefits(''); setNewBrandUrl(''); setNewConsiderations('')
    setAddingCustom(false)
    setSaving(false)
  }

  function patchField(id: string, field: string, value: string) {
    setAssigned(p => p.map(s => s.id === id ? { ...s, [field]: value } : s))
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id])
    saveTimers.current[id] = setTimeout(() => {
      fetch(`/api/coach/clients/${clientId}/supplements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    }, 800)
  }

  async function remove(id: string) {
    setAssigned(p => p.filter(s => s.id !== id))
    await fetch(`/api/coach/clients/${clientId}/supplements/${id}`, { method: 'DELETE' })
  }

  const assignedIds = new Set(assigned.map(a => a.supplement_id).filter(Boolean))

  if (loading) return <div className="py-10 text-center text-sm text-gray-400">Loading…</div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Library */}
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Supplement Library</h3>
            <button onClick={() => setAddingCustom(v => !v)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              {addingCustom ? 'Cancel' : '+ Add Custom'}
            </button>
          </div>

          {addingCustom && (
            <div className="space-y-2 bg-blue-50 rounded-xl p-3">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Supplement name *"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={newDosage} onChange={e => setNewDosage(e.target.value)} placeholder="Default dosage"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea value={newBenefits} onChange={e => setNewBenefits(e.target.value)} placeholder="Benefits / description" rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <input value={newBrandUrl} onChange={e => setNewBrandUrl(e.target.value)} placeholder="Brand URL (optional)"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
                <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Considerations — coach only, not shown to client
                </p>
                <textarea value={newConsiderations} onChange={e => setNewConsiderations(e.target.value)}
                  placeholder="Contraindications, cautions, interactions…" rows={2}
                  className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
              <button onClick={addCustom} disabled={saving || !newName.trim()}
                className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save to Library'}
              </button>
            </div>
          )}

          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {library.map(sup => {
              const isAssigned = assignedIds.has(sup.id)
              const isEditing = editingLibId === sup.id

              if (isEditing) {
                return (
                  <div key={sup.id} className="py-3 space-y-2">
                    <input value={libEdits.name ?? ''} onChange={e => setLibEdits(p => ({ ...p, name: e.target.value }))}
                      placeholder="Name *"
                      className="w-full text-sm font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={libEdits.default_dosage ?? ''} onChange={e => setLibEdits(p => ({ ...p, default_dosage: e.target.value }))}
                      placeholder="Default dosage"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <textarea value={libEdits.benefits ?? ''} onChange={e => setLibEdits(p => ({ ...p, benefits: e.target.value }))}
                      placeholder="Benefits / description" rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={libEdits.brand_url ?? ''} onChange={e => setLibEdits(p => ({ ...p, brand_url: e.target.value }))}
                      placeholder="Brand URL"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1">
                      <p className="text-[10px] font-semibold text-amber-700">Considerations — coach only</p>
                      <textarea value={libEdits.considerations ?? ''} onChange={e => setLibEdits(p => ({ ...p, considerations: e.target.value }))}
                        placeholder="Contraindications, cautions…" rows={2}
                        className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveLibEdit(sup.id)}
                        className="flex-1 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity">
                        Save
                      </button>
                      <button onClick={() => setEditingLibId(null)}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => { setEditingLibId(null); deleteLib(sup.id) }}
                        className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={sup.id} className="py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{sup.name}</p>
                    {sup.default_dosage && <p className="text-xs text-gray-400 mt-0.5">{sup.default_dosage}</p>}
                    {sup.benefits && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{sup.benefits}</p>}
                    {sup.considerations && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 line-clamp-2">
                        ⚠ {sup.considerations}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => startEditLib(sup)}
                      className="text-xs text-gray-400 hover:text-gray-700 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                      Edit
                    </button>
                    <button
                      onClick={() => !isAssigned && assign(sup)}
                      disabled={isAssigned}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                        isAssigned ? 'bg-green-50 text-green-600 cursor-default' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {isAssigned ? 'Assigned ✓' : '+ Assign'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Assigned */}
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Assigned to Client</h3>
          {assigned.length === 0 ? (
            <p className="text-sm text-gray-400">No supplements assigned yet. Select from the library.</p>
          ) : (
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {assigned.map(s => {
                const isOpen = expandedIds.has(s.id)
                return (
                  <div key={s.id} className="border border-gray-100 rounded-xl overflow-hidden">
                    {/* Header row — always visible */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        onClick={() => toggleExpanded(s.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                      >
                        <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button onClick={() => toggleExpanded(s.id)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.name || 'Unnamed supplement'}</p>
                        {!isOpen && s.dosage && (
                          <p className="text-xs text-gray-400 truncate">{s.dosage}</p>
                        )}
                      </button>
                      <button onClick={() => remove(s.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="Remove">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Expandable fields */}
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-50">
                        <div className="pt-2">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Name</label>
                          <input
                            value={s.name}
                            onChange={e => patchField(s.id, 'name', e.target.value)}
                            className="w-full text-sm font-semibold text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Dosage</label>
                          <input
                            value={s.dosage ?? ''}
                            onChange={e => patchField(s.id, 'dosage', e.target.value)}
                            placeholder="e.g. 2000 IU daily with food"
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Benefits</label>
                          <textarea
                            value={s.benefits ?? ''}
                            onChange={e => patchField(s.id, 'benefits', e.target.value)}
                            placeholder="Why this supplement…"
                            rows={2}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Brand / Link</label>
                          <input
                            value={s.brand_url ?? ''}
                            onChange={e => patchField(s.id, 'brand_url', e.target.value)}
                            placeholder="https://…"
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Notes for client</label>
                          <textarea
                            value={s.notes ?? ''}
                            onChange={e => patchField(s.id, 'notes', e.target.value)}
                            placeholder="Any extra instructions…"
                            rows={2}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1">
                          <p className="text-[10px] font-semibold text-amber-700 flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Considerations — not visible to client
                          </p>
                          <textarea
                            value={s.considerations ?? ''}
                            onChange={e => patchField(s.id, 'considerations', e.target.value)}
                            placeholder="Contraindications, cautions, interactions…"
                            rows={2}
                            className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Protocol Tab ──────────────────────────────────────────────────────────────

type ProtocolSection = { id: string; title: string; content: string }

const PROTOCOL_PRESETS = ['Sleep', 'Stress Management', 'Lifestyle', 'Nutrition Timing', 'Recovery', 'Mindset', 'Movement']

function ProtocolTab({ clientId }: { clientId: string }) {
  const [sections, setSections] = useState<ProtocolSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showPresets, setShowPresets] = useState(false)

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/protocol`)
      .then(r => r.json())
      .then(d => setSections(Array.isArray(d.sections) ? d.sections : []))
      .finally(() => setLoading(false))
  }, [clientId])

  function scheduleSave(updated: ProtocolSection[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/coach/clients/${clientId}/protocol`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: updated }),
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 1000)
  }

  function addSection(title: string) {
    const updated = [...sections, { id: crypto.randomUUID(), title, content: '' }]
    setSections(updated)
    scheduleSave(updated)
    setShowPresets(false)
  }

  function updateSection(id: string, field: 'title' | 'content', value: string) {
    const updated = sections.map(s => s.id === id ? { ...s, [field]: value } : s)
    setSections(updated)
    scheduleSave(updated)
  }

  function deleteSection(id: string) {
    const updated = sections.filter(s => s.id !== id)
    setSections(updated)
    scheduleSave(updated)
  }

  if (loading) return <div className="py-10 text-center text-sm text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Client Protocol</h3>
          <p className="text-xs text-gray-400 mt-0.5">Lifestyle, sleep, stress management and other protocols — visible to the client.</p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <span className="text-xs text-gray-400">Saving…</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-500">Saved ✓</span>}
          <div className="relative">
            <button
              onClick={() => setShowPresets(v => !v)}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              + Add Section
            </button>
            {showPresets && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[180px]">
                {PROTOCOL_PRESETS.map(p => (
                  <button key={p} onClick={() => addSection(p)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    {p}
                  </button>
                ))}
                <button onClick={() => addSection('Custom')}
                  className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors">
                  Custom…
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500 font-medium">No protocol sections yet</p>
          <p className="text-xs text-gray-400 mt-1">Add sections like Sleep, Stress Management, Lifestyle…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={s.title}
                  onChange={e => updateSection(s.id, 'title', e.target.value)}
                  className="flex-1 text-sm font-semibold text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none py-0.5 bg-transparent"
                  placeholder="Section title"
                />
                <button onClick={() => deleteSection(s.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="Delete section">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <textarea
                value={s.content}
                onChange={e => updateSection(s.id, 'content', e.target.value)}
                placeholder="Add notes, guidelines, or instructions for this section…"
                rows={3}
                className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-300"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type CycleLogEntry = {
  log_date: string
  period: boolean
  flow: string | null
  clots: string | null
  blood_color: string | null
  spotting: boolean
  cervical_mucus: string | null
  cervix_position: string | null
  bbt: string | null
  symptoms: string[]
  mittelschmerz: boolean
  pain_side: string | null
  mood: string | null
  energy: string | null
  sleep: string | null
  libido: string | null
  digestion: string | null
  notes: string | null
}

function CycleTab({ clientId }: { clientId: string }) {
  const today = new Date()
  const [allLogs, setAllLogs] = useState<CycleLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/cycle-logs?limit=365`)
      .then((r) => r.json())
      .then((d) => setAllLogs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>
  if (allLogs.length === 0) return <Empty label="No cycle data logged yet." />

  const logMap: Record<string, CycleLogEntry> = {}
  for (const l of allLogs) logMap[l.log_date] = l

  const MONTH_NAMES_C = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_LABELS_C = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function shiftDate(ds: string, days: number) {
    const [y, m, d] = ds.split('-').map(Number)
    const dt = new Date(y, m - 1, d + days)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  function diffDays(a: string, b: string) {
    const [ay, am, ad] = a.split('-').map(Number)
    const [by, bm, bd] = b.split('-').map(Number)
    return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000)
  }

  // Period starts for prediction
  const sortedDates = Object.keys(logMap).sort()
  const periodStarts: string[] = []
  for (const d of sortedDates) {
    if (logMap[d]?.period && !logMap[shiftDate(d, -1)]?.period) periodStarts.push(d)
  }
  type CyclePrediction = { avgCycleLength: number; nextPeriodStart: string; nextPeriodEnd: string; ovulationDay: string; fertileStart: string; fertileEnd: string; daysUntilPeriod: number }
  let prediction: CyclePrediction | null = null
  if (periodStarts.length >= 2) {
    const lengths: number[] = []
    for (let i = 1; i < periodStarts.length; i++) {
      const len = diffDays(periodStarts[i - 1], periodStarts[i])
      if (len >= 18 && len <= 45) lengths.push(len)
    }
    if (lengths.length > 0) {
      const recent = lengths.slice(-3)
      const avgCycleLength = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
      const periodLengths = periodStarts.map(start => {
        let len = 0, cur = start
        while (logMap[cur]?.period) { len++; cur = shiftDate(cur, 1) }
        return len || 5
      })
      const avgPeriodLen = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
      const lastStart = periodStarts[periodStarts.length - 1]
      const nextPeriodStart = shiftDate(lastStart, avgCycleLength)
      const nextPeriodEnd = shiftDate(nextPeriodStart, Math.max(avgPeriodLen - 1, 4))
      const ovulationDay = shiftDate(nextPeriodStart, -14)
      const fertileStart = shiftDate(ovulationDay, -5)
      const fertileEnd = shiftDate(ovulationDay, 1)
      prediction = { avgCycleLength, nextPeriodStart, nextPeriodEnd, ovulationDay, fertileStart, fertileEnd, daysUntilPeriod: diffDays(todayStr, nextPeriodStart) }
    }
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const allPeriodDates = new Set(Object.entries(logMap).filter(([, l]) => l.period).map(([d]) => d))
  const ovulationHints = new Set<string>()
  for (const ds of allPeriodDates) {
    const [dy, dm, dd] = ds.split('-').map(Number)
    const prev = new Date(dy, dm - 1, dd - 1)
    const prevStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
    if (!allPeriodDates.has(prevStr)) {
      const ov = new Date(dy, dm - 1, dd + 14)
      ovulationHints.add(`${ov.getFullYear()}-${String(ov.getMonth() + 1).padStart(2, '0')}-${String(ov.getDate()).padStart(2, '0')}`)
    }
  }

  const FLOW_LABEL_C: Record<string, string> = { spotting: 'Spotting', light: 'Light', medium: 'Medium', heavy: 'Heavy' }
  const MOOD_EMOJI_C: Record<string, string> = { happy: '😊', calm: '😌', anxious: '😰', irritable: '😤', low: '😔', weepy: '😢' }
  const SYMPTOM_LABEL_C: Record<string, string> = {
    cramps_mild: 'Mild cramps', cramps_moderate: 'Moderate cramps', cramps_severe: 'Severe cramps',
    headache: 'Headache', migraine: 'Migraine', acne: 'Acne', acne_hormonal: 'Hormonal acne',
    breast_tenderness: 'Breast tenderness', fatigue: 'Fatigue', fatigue_severe: 'Severe fatigue',
    bloating: 'Bloating', back_pain: 'Back pain', nausea: 'Nausea', diarrhea_period: 'Period diarrhea',
    hair_shedding: 'Hair shedding', night_sweats: 'Night sweats', insomnia: 'Insomnia',
    pms_anxiety: 'PMS anxiety', pms_rage: 'PMS rage', pms_weeping: 'PMS weeping',
    spotting_mid: 'Mid-cycle spotting', spotting_pre_period: 'Pre-period spotting',
  }

  const hoveredLog = hoveredDate ? logMap[hoveredDate] : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button type="button"
          onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <p className="text-base font-bold text-gray-900">{MONTH_NAMES_C[month]} {year}</p>
        <button type="button"
          onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Prediction strip */}
      {prediction && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-rose-50 rounded-xl py-2 px-1">
            <p className="text-xs font-bold text-rose-600">
              {prediction.daysUntilPeriod > 0 ? `In ${prediction.daysUntilPeriod}d` : prediction.daysUntilPeriod === 0 ? 'Today' : 'Overdue'}
            </p>
            <p className="text-xs text-rose-400 mt-0.5">Next period est.</p>
          </div>
          <div className="bg-teal-50 rounded-xl py-2 px-1">
            <p className="text-xs font-bold text-teal-600">In {Math.max(0, diffDays(todayStr, prediction.ovulationDay))}d</p>
            <p className="text-xs text-teal-400 mt-0.5">Ovulation est.</p>
          </div>
          <div className="bg-gray-50 rounded-xl py-2 px-1">
            <p className="text-xs font-bold text-gray-600">{prediction.avgCycleLength}d</p>
            <p className="text-xs text-gray-400 mt-0.5">Avg cycle</p>
          </div>
        </div>
      )}

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS_C.map((d) => <p key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</p>)}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const log = logMap[dateStr]
          const isPeriod = log?.period
          const isSpotting = log?.spotting && !log?.period
          const isMittelschmerz = log?.mittelschmerz
          const hasSymptoms = (log?.symptoms?.length ?? 0) > 0
          const hasMood = !!log?.mood
          const hasFertility = !!log?.cervical_mucus || !!log?.bbt || !!log?.cervix_position
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr
          const isOvHint = ovulationHints.has(dateStr)

          const isPredPeriod = !isPeriod && isFuture && prediction && dateStr >= prediction.nextPeriodStart && dateStr <= prediction.nextPeriodEnd
          const isPredOvulation = isFuture && prediction && dateStr === prediction.ovulationDay
          const isInFertile = !isPeriod && isFuture && prediction && dateStr >= prediction.fertileStart && dateStr <= prediction.fertileEnd && !isPredOvulation

          const hasData = log && (isPeriod || isSpotting || hasMood || hasSymptoms || hasFertility || log.energy || log.notes)

          const bgClass = isPeriod ? 'bg-rose-100 hover:bg-rose-200'
            : isSpotting ? 'bg-rose-50 hover:bg-rose-100'
            : isPredPeriod ? 'bg-rose-50 hover:bg-rose-100'
            : isPredOvulation ? 'bg-teal-100 hover:bg-teal-200'
            : isInFertile ? 'bg-teal-50 hover:bg-teal-100'
            : 'hover:bg-gray-50'

          return (
            <button key={day} type="button"
              onMouseEnter={(e) => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current)
                if (hasData) {
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                  setTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 })
                  setHoveredDate(dateStr)
                }
              }}
              onMouseLeave={() => { hoverTimer.current = setTimeout(() => setHoveredDate(null), 100) }}
              className={[
                'relative flex flex-col items-center justify-start pt-1 pb-1.5 rounded-xl transition-all mx-0.5 min-h-[44px]',
                bgClass,
                hoveredDate === dateStr ? 'ring-2 ring-blue-400 ring-offset-1' : '',
              ].join(' ')}
            >
              <span className={[
                'text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full',
                isToday ? 'bg-gray-900 text-white'
                  : isPredOvulation ? 'text-teal-700'
                  : isPeriod ? 'text-rose-700'
                  : isPredPeriod ? 'text-rose-400'
                  : 'text-gray-700',
              ].join(' ')}>{day}</span>
              <div className="flex items-center gap-0.5 mt-0.5 h-2 flex-wrap justify-center">
                {isPeriod && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                {isSpotting && <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />}
                {isPredPeriod && <span className="w-1.5 h-1.5 rounded-full border border-rose-300" />}
                {isPredOvulation && <span className="w-2 h-2 rounded-full bg-teal-400 border-2 border-teal-600" />}
                {isInFertile && <span className="w-1.5 h-1.5 rounded-full bg-teal-300" />}
                {(isOvHint || isMittelschmerz) && !isPeriod && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                {hasSymptoms && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                {hasMood && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                {hasFertility && <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-4 pt-3 border-t border-gray-50">
        {[
          { color: 'bg-rose-400', label: 'Period' },
          { color: 'bg-rose-50 border border-rose-300', label: 'Predicted period' },
          { color: 'bg-teal-100 border border-teal-400', label: 'Est. ovulation' },
          { color: 'bg-teal-50 border border-teal-200', label: 'Fertile window' },
          { color: 'bg-orange-400', label: 'Symptoms' },
          { color: 'bg-purple-400', label: 'Mood' },
          { color: 'bg-teal-600', label: 'Fertility data' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
        {!prediction && <p className="w-full text-xs text-gray-300 mt-1">Log 2+ complete cycles to see predictions</p>}
      </div>

      {/* Hover tooltip */}
      {hoveredDate && hoveredLog && tooltipPos && (
        <div
          className="fixed z-50 bg-white rounded-2xl border border-gray-200 shadow-xl p-3 w-64 pointer-events-none"
          style={{
            left: Math.min(tooltipPos.x - 128, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 272),
            top: tooltipPos.y,
          }}
        >
          <p className="text-xs font-semibold text-gray-500 mb-2">
            {new Date(hoveredDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <div className="space-y-1.5">
            {hoveredLog.period && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">Period{hoveredLog.flow ? ` · ${FLOW_LABEL_C[hoveredLog.flow] ?? hoveredLog.flow}` : ''}</span>
              </div>
            )}
            {hoveredLog.spotting && !hoveredLog.period && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-300 flex-shrink-0" />
                <span className="text-sm text-gray-700">Spotting</span>
              </div>
            )}
            {hoveredLog.mood && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">{MOOD_EMOJI_C[hoveredLog.mood]} {hoveredLog.mood.charAt(0).toUpperCase() + hoveredLog.mood.slice(1)}</span>
              </div>
            )}
            {hoveredLog.energy && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">Energy: {hoveredLog.energy.charAt(0).toUpperCase() + hoveredLog.energy.slice(1)}</span>
              </div>
            )}
            {hoveredLog.sleep && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">Sleep: {hoveredLog.sleep.charAt(0).toUpperCase() + hoveredLog.sleep.slice(1)}</span>
              </div>
            )}
            {hoveredLog.bbt && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" />
                <span className="text-sm text-gray-700">BBT: {hoveredLog.bbt}°</span>
              </div>
            )}
            {hoveredLog.cervical_mucus && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" />
                <span className="text-sm text-gray-700 capitalize">CM: {hoveredLog.cervical_mucus.replace('_', ' ')}</span>
              </div>
            )}
            {(hoveredLog.symptoms ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {(hoveredLog.symptoms ?? []).map((s) => (
                  <span key={s} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                    {SYMPTOM_LABEL_C[s] ?? s}
                  </span>
                ))}
              </div>
            )}
            {hoveredLog.notes && (
              <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-1.5 mt-0.5">{hoveredLog.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'checkins' | 'nutrition' | 'training' | 'program' | 'calendar' | 'mealplan' | 'habits' | 'notes' | 'files' | 'flows' | 'preview' | 'resources' | 'cheatsheet' | 'supplements' | 'protocol' | 'cycle' | 'plan'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'preview', label: 'App Preview' },
  { id: 'flows', label: 'Autoflows' },
  { id: 'resources', label: 'Resources' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'program', label: 'Programs' },
  { id: 'mealplan', label: 'Meal Plan' },
  { id: 'nutrition', label: 'Food Logs' },
  { id: 'cheatsheet', label: 'Serve Guide' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'plan', label: 'Weekly Changes' },
  { id: 'supplements', label: 'Supplements' },
  { id: 'protocol', label: 'Protocol' },
  { id: 'habits', label: 'Habits' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'notes', label: 'Notes' },
  { id: 'files', label: 'Files' },
]

export default function ClientTabs({ clientId, initialTab }: { clientId: string; initialTab?: string }) {
  const validTabs: TabId[] = ['overview', 'checkins', 'nutrition', 'training', 'program', 'calendar', 'mealplan', 'habits', 'notes', 'files', 'flows', 'preview', 'resources', 'cheatsheet', 'supplements', 'protocol', 'cycle', 'plan']
  const [tab, setTab] = useState<TabId>(validTabs.includes(initialTab as TabId) ? initialTab as TabId : 'overview')
  const [autoflowRefreshKey, setAutoflowRefreshKey] = useState(0)
  const [data, setData] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDailyTargets, setShowDailyTargets] = useState(true)
  const [savingTargets, setSavingTargets] = useState(false)
  const [foodLogAccess, setFoodLogAccess] = useState<'full' | 'no_scan' | 'note_only' | 'off'>('full')
  const [savingFoodLog, setSavingFoodLog] = useState(false)
  const [showMealBuilder, setShowMealBuilder] = useState(true)
  const [savingMealBuilder, setSavingMealBuilder] = useState(false)
  const [showSavedMeals, setShowSavedMeals] = useState(true)
  const [savingSavedMeals, setSavingSavedMeals] = useState(false)
  const [targetsSource, setTargetsSource] = useState<'tdee' | 'meal_plan'>('tdee')
  const [targetsMealPlanId, setTargetsMealPlanId] = useState<string | null>(null)
  const [savingTargetsSource, setSavingTargetsSource] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/coach/clients/${clientId}`).then((r) => r.json()),
      fetch(`/api/coach/clients/${clientId}/settings`).then((r) => r.json()),
    ]).then(([clientData, settings]) => {
      if (clientData.error) setError(clientData.error); else setData(clientData)
      setShowDailyTargets(settings.show_daily_targets ?? true)
      setFoodLogAccess(settings.food_log_access ?? 'full')
      setShowMealBuilder(settings.show_meal_builder ?? true)
      setShowSavedMeals(settings.show_saved_meals ?? true)
      setTargetsSource(settings.targets_source ?? 'tdee')
      setTargetsMealPlanId(settings.targets_meal_plan_id ?? null)
    }).finally(() => setLoading(false))
  }, [clientId])

  async function handleToggleTargets() {
    const next = !showDailyTargets
    setShowDailyTargets(next)
    setSavingTargets(true)
    try {
      const res = await fetch(`/api/coach/clients/${clientId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_daily_targets: next }),
      })
      if (!res.ok) setShowDailyTargets(!next)
    } catch {
      setShowDailyTargets(!next)
    } finally {
      setSavingTargets(false)
    }
  }

  async function handleFoodLogAccess(next: typeof foodLogAccess) {
    const prev = foodLogAccess
    setFoodLogAccess(next)
    setSavingFoodLog(true)
    try {
      const res = await fetch(`/api/coach/clients/${clientId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_log_access: next }),
      })
      if (!res.ok) setFoodLogAccess(prev)
    } catch {
      setFoodLogAccess(prev)
    } finally {
      setSavingFoodLog(false)
    }
  }

  async function handleToggleMealBuilder() {
    const next = !showMealBuilder
    setShowMealBuilder(next)
    setSavingMealBuilder(true)
    try {
      const res = await fetch(`/api/coach/clients/${clientId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_meal_builder: next }),
      })
      if (!res.ok) setShowMealBuilder(!next)
    } catch {
      setShowMealBuilder(!next)
    } finally {
      setSavingMealBuilder(false)
    }
  }

  async function handleToggleSavedMeals() {
    const next = !showSavedMeals
    setShowSavedMeals(next)
    setSavingSavedMeals(true)
    try {
      const res = await fetch(`/api/coach/clients/${clientId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_saved_meals: next }),
      })
      if (!res.ok) setShowSavedMeals(!next)
    } catch {
      setShowSavedMeals(!next)
    } finally {
      setSavingSavedMeals(false)
    }
  }

  async function handleTargetsSource(source: 'tdee' | 'meal_plan', planId: string | null) {
    setTargetsSource(source)
    setTargetsMealPlanId(planId)
    setSavingTargetsSource(true)
    try {
      await fetch(`/api/coach/clients/${clientId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets_source: source, targets_meal_plan_id: planId }),
      })
    } finally {
      setSavingTargetsSource(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>
  if (error) return <p className="text-sm text-red-500 py-10 text-center">{error}</p>

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && data && (
        <OverviewTab
          data={data}
          clientId={clientId}
        />
      )}

      {/* App Preview */}
      {tab === 'preview' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-6 text-center">Loading…</p>}>
          <AppPreviewTab
            clientId={clientId}
            showDailyTargets={showDailyTargets}
            onToggleTargets={handleToggleTargets}
            savingTargets={savingTargets}
            foodLogAccess={foodLogAccess}
            onFoodLogAccess={handleFoodLogAccess}
            savingFoodLog={savingFoodLog}
            showMealBuilder={showMealBuilder}
            onToggleMealBuilder={handleToggleMealBuilder}
            savingMealBuilder={savingMealBuilder}
            showSavedMeals={showSavedMeals}
            onToggleSavedMeals={handleToggleSavedMeals}
            savingSavedMeals={savingSavedMeals}
            targetsSource={targetsSource}
            targetsMealPlanId={targetsMealPlanId}
            onTargetsSource={handleTargetsSource}
            savingTargetsSource={savingTargetsSource}
          />
        </Suspense>
      )}

      {/* Autoflows */}
      {tab === 'flows' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-6 text-center">Loading…</p>}>
          <div className="bg-white rounded-2xl border border-gray-200">
            <FlowsTab clientId={clientId} />
          </div>
        </Suspense>
      )}

      {/* Calendar */}
      {tab === 'calendar' && <CalendarTab clientId={clientId} />}

      {/* Training Program */}
      {tab === 'program' && <ProgramTab clientId={clientId} />}

      {/* Resources */}
      {tab === 'resources' && <ClientResourcesTab clientId={clientId} />}

      {/* Meal Plan */}
      {tab === 'mealplan' && <MealPlanTab clientId={clientId} />}

      {/* Food Logs */}
      {tab === 'nutrition' && <FoodLogsTab clientId={clientId} />}

      {/* Habits */}
      {tab === 'habits' && <HabitsTab clientId={clientId} />}

      {/* Notes */}
      {tab === 'notes' && <NotesTab clientId={clientId} />}

      {/* Serve Guide / Cheat Sheet */}
      {tab === 'cheatsheet' && <ClientServeGuide clientId={clientId} />}

      {/* Supplements */}
      {tab === 'supplements' && <SupplementsTab clientId={clientId} />}

      {/* Plan Builder */}
      {tab === 'plan' && (
        <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">Loading…</div>}>
          <PlanBuilderTab clientId={clientId} />
        </Suspense>
      )}

      {/* Protocol */}
      {tab === 'protocol' && <ProtocolTab clientId={clientId} />}

      {/* Files */}
      {tab === 'files' && <FilesTab clientId={clientId} />}

      {/* Cycle */}
      {tab === 'cycle' && <CycleTab clientId={clientId} />}

      {/* Check-ins */}
      {tab === 'checkins' && (
        <div className="space-y-4">
          <AssignAutoflowButton clientId={clientId} onAssigned={() => setAutoflowRefreshKey(k => k + 1)} />
          <AutoflowCheckinsLinked clientId={clientId} onViewFlows={() => setTab('flows')} refreshKey={autoflowRefreshKey} />
          <CheckinSchedulesPanel clientId={clientId} />
          {data && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Submitted Check-ins</p>
              {data.checkIns.length === 0 && (data.formCheckIns ?? []).length === 0 && (data.autoflowCheckIns ?? []).length === 0 && <Empty label="No check-ins submitted yet." />}

              {/* Merge all check-in types and sort newest first */}
              {[
                ...(data.autoflowCheckIns ?? []).map((ac) => ({ kind: 'autoflow' as const, date: ac.submitted_at, item: ac })),
                ...(data.formCheckIns ?? []).map((fc) => ({ kind: 'form' as const, date: fc.submitted_at, item: fc })),
                ...data.checkIns.map((c) => ({ kind: 'direct' as const, date: c.created_at, item: c })),
              ]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((entry) => {
                  if (entry.kind === 'autoflow') return (
                    <ExpandableAutoflowCheckIn
                      key={entry.item.id}
                      item={entry.item}
                      clientId={clientId}
                      onDelete={(id) => setData((d) => d ? { ...d, autoflowCheckIns: d.autoflowCheckIns.filter((x) => x.id !== id) } : d)}
                    />
                  )
                  if (entry.kind === 'form') return (
                    <ExpandableFormCheckIn
                      key={entry.item.id}
                      item={entry.item}
                      clientId={clientId}
                      onDelete={(id) => setData((d) => d ? { ...d, formCheckIns: d.formCheckIns.filter((x) => x.id !== id) } : d)}
                    />
                  )
                  // Direct daily check-in
                  const c = entry.item
                  return (
                    <div key={c.id} className="bg-white rounded-2xl border p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-400">{fmt(c.created_at)}</p>
                        <div className="flex items-center gap-2">
                          {c.reviewed_by_coach ? (
                            <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Reviewed
                            </span>
                          ) : (
                            <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending review</span>
                          )}
                          <button
                            onClick={async () => {
                              if (!confirm('Delete this check-in?')) return
                              const res = await fetch(`/api/check-ins/${c.id}`, { method: 'DELETE' })
                              if (res.ok) setData((d) => d ? { ...d, checkIns: d.checkIns.filter((x) => x.id !== c.id) } : d)
                            }}
                            className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        <Stat label="Sleep" value={c.sleep_hours != null ? `${c.sleep_hours}h` : '—'} />
                        <Stat label="Quality" value={SLEEP_LABELS[c.sleep_quality ?? ''] ?? c.sleep_quality ?? '—'} />
                        <Stat label="Energy" value={ENERGY_LABELS[c.energy_level ?? ''] ?? c.energy_level ?? '—'} />
                        <Stat label="RHR" value={c.rhr != null ? `${c.rhr} bpm` : '—'} />
                        <Stat label="HRV" value={c.hrv != null ? `${c.hrv} ms` : '—'} />
                      </div>
                      {c.notes && <p className="text-xs text-gray-500 italic border-t border-gray-50 pt-2">"{c.notes}"</p>}
                      <Suspense fallback={null}>
                        <CheckInFeedback
                          checkInId={c.id}
                          initialFeedback={c.coach_feedback}
                          initialReviewed={c.reviewed_by_coach}
                        />
                      </Suspense>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Training */}
      {tab === 'training' && data && (
        <div className="space-y-3">
          {data.workouts.length === 0 && <Empty label="No workouts recorded." />}
          {data.workouts.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                <span className="text-xs text-gray-400">{duration(w.started_at, w.ended_at)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{fmt(w.started_at)}</p>
              {w.exercises.length > 0 && (
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  {w.exercises.map((ex, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800">{ex.name}</p>
                        <span className="text-xs text-gray-400 capitalize">{ex.category}</span>
                        {ex.video_url && (
                          <a
                            href={ex.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 ml-auto flex-shrink-0"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            View form video
                          </a>
                        )}
                      </div>
                      {ex.notes && (
                        <p className="text-xs text-gray-500 italic">"{ex.notes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
