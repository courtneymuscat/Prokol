'use client'

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { noteBodyToHtml } from '@/lib/noteUtils'
const CheckInFeedback = lazy(() => import('./CheckInFeedback'))
const FlowsTab = lazy(() => import('./FlowsTab'))
const AppPreviewTab = lazy(() => import('./AppPreviewTab'))
const PlanBuilderTab = lazy(() => import('./PlanBuilderTab'))
const FilesTab = lazy(() => import('./FilesTab'))
const NotesTab = lazy(() => import('./NotesTab'))
const MealPlanTab = lazy(() => import('./MealPlanTab'))
const HabitsTab = lazy(() => import('./HabitsTab'))
const ClientServeGuide = lazy(() => import('./ClientServeGuide'))
const CalendarTab = lazy(() => import('./CalendarTab'))
const ProgramTab = lazy(() => import('./ProgramTab'))
const FoodLogsTab = lazy(() => import('./FoodLogsTab'))
const ClientResourcesTab = lazy(() => import('./ClientResourcesTab'))
const SupplementsTab = lazy(() => import('./SupplementsTab'))
const ProtocolTab = lazy(() => import('./ProtocolTab'))
const CycleTab = lazy(() => import('./CycleTab'))

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

type CustomMetric = {
  id: string
  name: string
  unit: string
  sort_order: number
}

type CustomMetricLog = {
  id: string
  metric_id: string
  value: number
  logged_at: string
}

type ClientData = {
  checkIns: CheckIn[]
  formCheckIns: FormCheckIn[]
  autoflowCheckIns: AutoflowCheckIn[]
  workouts: Workout[]
  weightLogs: WeightLog[]
  foodLogs: FoodLog[]
  mealNotes: MealNote[]
  customMetrics?: CustomMetric[]
  customMetricLogs?: CustomMetricLog[]
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

// ── Custom metrics (coach read-only view) ────────────────────────────────────

const MT_CHART_W = 600
const MT_CHART_H = 160
const MT_PAD = { top: 12, right: 12, bottom: 28, left: 40 }
const MT_INNER_W = MT_CHART_W - MT_PAD.left - MT_PAD.right
const MT_INNER_H = MT_CHART_H - MT_PAD.top - MT_PAD.bottom

function MetricMiniChart({ logs }: { logs: CustomMetricLog[] }) {
  const ordered = [...logs].slice().reverse()
  if (ordered.length < 2) return null
  const values = ordered.map(l => l.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const spread = maxVal - minVal || Math.max(1, Math.abs(maxVal) * 0.1)
  const yMin = minVal - spread * 0.15
  const yMax = maxVal + spread * 0.15

  const toX = (i: number) => MT_PAD.left + (i / (ordered.length - 1)) * MT_INNER_W
  const toY = (v: number) => MT_PAD.top + MT_INNER_H - ((v - yMin) / (yMax - yMin)) * MT_INNER_H

  const pathD = ordered
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ')
  const areaD = pathD +
    ` L ${toX(ordered.length - 1).toFixed(1)} ${(MT_PAD.top + MT_INNER_H).toFixed(1)}` +
    ` L ${MT_PAD.left.toFixed(1)} ${(MT_PAD.top + MT_INNER_H).toFixed(1)} Z`

  const yTicks = [0, 0.5, 1].map((t) => yMin + t * (yMax - yMin))
  const labelCount = Math.min(4, ordered.length)
  const labelStep = Math.floor((ordered.length - 1) / Math.max(1, labelCount - 1)) || 1
  const labelIndices = Array.from({ length: labelCount }, (_, k) =>
    Math.min(k * labelStep, ordered.length - 1)
  )

  return (
    <div className="overflow-x-auto -mx-1">
      <svg viewBox={`0 0 ${MT_CHART_W} ${MT_CHART_H}`} className="w-full" style={{ height: MT_CHART_H }}>
        <defs>
          <linearGradient id="metric-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1D9E75" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={MT_PAD.left} x2={MT_PAD.left + MT_INNER_W} y1={toY(v)} y2={toY(v)} stroke="#f3f4f6" strokeWidth={1} />
            <text x={MT_PAD.left - 6} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#9ca3af">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <path d={areaD} fill="url(#metric-grad)" />
        <path d={pathD} fill="none" stroke="#1D9E75" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {ordered.length <= 20 && ordered.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.value)} r={3} fill="white" stroke="#1D9E75" strokeWidth={2} />
        ))}
        {labelIndices.map((idx) => (
          <text key={idx} x={toX(idx)} y={MT_PAD.top + MT_INNER_H + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">
            {new Date(ordered[idx].logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
    </div>
  )
}

function CoachMetricCard({ metric, logs }: { metric: CustomMetric; logs: CustomMetricLog[] }) {
  const [expanded, setExpanded] = useState(false)
  const latest = logs[0] ?? null
  const previous = logs[1] ?? null
  const delta = latest && previous ? latest.value - previous.value : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-gray-50 transition-colors rounded-2xl"
      >
        <div>
          <h3 className="text-base font-semibold text-gray-900">{metric.name}</h3>
          {latest ? (
            <p className="text-xs text-gray-400 mt-0.5">
              Latest: <span className="text-gray-700 font-medium">{latest.value} {metric.unit}</span>
              <span className="text-gray-300"> · {new Date(latest.logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              {delta !== null && (
                <span className={`ml-2 font-semibold ${delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">No entries yet · unit: {metric.unit}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {logs.length >= 2 ? (
            <MetricMiniChart logs={logs} />
          ) : (
            <p className="text-xs text-gray-400">Not enough entries yet to chart.</p>
          )}
          {logs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">History</p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{new Date(l.logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span className="font-semibold text-gray-700">{l.value} {metric.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricsTab({ metrics, logs }: { metrics: CustomMetric[]; logs: CustomMetricLog[] }) {
  const logsByMetric = useMemo(() => {
    const map: Record<string, CustomMetricLog[]> = {}
    for (const m of metrics) map[m.id] = []
    for (const l of logs) {
      if (map[l.metric_id]) map[l.metric_id].push(l)
    }
    return map
  }, [metrics, logs])

  if (metrics.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
        <p className="text-sm font-semibold text-gray-700">No custom metrics tracked</p>
        <p className="text-xs text-gray-400 mt-1">
          Your client can add their own metrics — body fat, measurements, RHR, etc. — from their Metrics page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {metrics.map((m) => (
        <CoachMetricCard key={m.id} metric={m} logs={logsByMetric[m.id] ?? []} />
      ))}
    </div>
  )
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
            <Image src={photo.url} alt={photoCatLabel(photo.category)} fill sizes="(max-width: 768px) 50vw, 240px" className="object-cover" />
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
                  <Image src={photo.url} alt={photoCatLabel(photo.category)} fill sizes="(max-width: 640px) 33vw, 160px" className="object-cover" />
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
                          <Image src={p.url} alt={photoCatLabel(p.category)} fill sizes="(max-width: 640px) 33vw, 200px" className="object-cover" />
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
            <Image
              src={lightbox.url}
              alt={photoCatLabel(lightbox.category)}
              width={1284}
              height={2778}
              sizes="(max-width: 640px) 100vw, 384px"
              className="w-full max-h-[75vh] h-auto object-contain rounded-2xl"
            />
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

// NotesTab + RichToolbar extracted to ./NotesTab.tsx (lazy-loaded)
// FilesTab extracted to ./FilesTab.tsx (lazy-loaded)
// ProgramTab (+ Program sub-components + helpers + types) extracted
// to ./ProgramTab.tsx (lazy-loaded)
// CalendarTab (+ Coach workout viewer modals + calendar helpers) extracted
// to ./CalendarTab.tsx (lazy-loaded)
// FoodLogsTab extracted to ./FoodLogsTab.tsx (lazy-loaded)
// ClientResourcesTab extracted to ./ClientResourcesTab.tsx (lazy-loaded)
// SupplementsTab extracted to ./SupplementsTab.tsx (lazy-loaded)

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

// ProtocolTab extracted to ./ProtocolTab.tsx (lazy-loaded)
// CycleTab extracted to ./CycleTab.tsx (lazy-loaded)

type TabId = 'overview' | 'checkins' | 'nutrition' | 'training' | 'program' | 'calendar' | 'mealplan' | 'habits' | 'notes' | 'files' | 'flows' | 'preview' | 'resources' | 'cheatsheet' | 'supplements' | 'protocol' | 'cycle' | 'plan' | 'metrics'

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
  { id: 'metrics', label: 'Metrics' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'notes', label: 'Notes' },
  { id: 'files', label: 'Files' },
]

// Tiers that include the training (programs) toolset
const TRAINING_TIERS = new Set(['coach_solo', 'coach_pt_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'])
// Tiers that include the nutrition (meal plans / serve guide) toolset
const NUTRITION_TIERS = new Set(['coach_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'])

export default function ClientTabs({ clientId, initialTab, coachTier = 'coach_pro' }: { clientId: string; initialTab?: string; coachTier?: string }) {
  const hasTraining = TRAINING_TIERS.has(coachTier)
  const hasNutrition = NUTRITION_TIERS.has(coachTier)
  const visibleTabs = TABS.filter((t) => {
    if (t.id === 'program') return hasTraining
    if (t.id === 'mealplan' || t.id === 'cheatsheet') return hasNutrition
    return true
  })
  const validTabs: TabId[] = ['overview', 'checkins', 'nutrition', 'training', 'program', 'calendar', 'mealplan', 'habits', 'notes', 'files', 'flows', 'preview', 'resources', 'cheatsheet', 'supplements', 'protocol', 'cycle', 'plan', 'metrics']
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
        {visibleTabs.map((t) => (
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
      {tab === 'calendar' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading calendar…</p>}>
          <CalendarTab clientId={clientId} />
        </Suspense>
      )}

      {/* Training Program */}
      {tab === 'program' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading programs…</p>}>
          <ProgramTab clientId={clientId} />
        </Suspense>
      )}

      {/* Resources */}
      {tab === 'resources' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading resources…</p>}>
          <ClientResourcesTab clientId={clientId} />
        </Suspense>
      )}

      {/* Meal Plan */}
      {tab === 'mealplan' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading meal plans…</p>}>
          <MealPlanTab clientId={clientId} />
        </Suspense>
      )}

      {/* Food Logs */}
      {tab === 'nutrition' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading food logs…</p>}>
          <FoodLogsTab clientId={clientId} />
        </Suspense>
      )}

      {/* Habits */}
      {tab === 'habits' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading habits…</p>}>
          <HabitsTab clientId={clientId} />
        </Suspense>
      )}

      {/* Custom metrics */}
      {tab === 'metrics' && data && (
        <MetricsTab metrics={data.customMetrics ?? []} logs={data.customMetricLogs ?? []} />
      )}

      {/* Notes */}
      {tab === 'notes' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading notes…</p>}>
          <NotesTab clientId={clientId} />
        </Suspense>
      )}

      {/* Serve Guide / Cheat Sheet */}
      {tab === 'cheatsheet' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading serve guide…</p>}>
          <ClientServeGuide clientId={clientId} />
        </Suspense>
      )}

      {/* Supplements */}
      {tab === 'supplements' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading supplements…</p>}>
          <SupplementsTab clientId={clientId} />
        </Suspense>
      )}

      {/* Plan Builder */}
      {tab === 'plan' && (
        <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">Loading…</div>}>
          <PlanBuilderTab clientId={clientId} />
        </Suspense>
      )}

      {/* Protocol */}
      {tab === 'protocol' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading protocol…</p>}>
          <ProtocolTab clientId={clientId} />
        </Suspense>
      )}

      {/* Files */}
      {tab === 'files' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading files…</p>}>
          <FilesTab clientId={clientId} />
        </Suspense>
      )}

      {/* Cycle */}
      {tab === 'cycle' && (
        <Suspense fallback={<p className="text-sm text-gray-400 py-10 text-center">Loading cycle…</p>}>
          <CycleTab clientId={clientId} />
        </Suspense>
      )}

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
