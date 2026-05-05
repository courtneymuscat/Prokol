'use client'

import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

type MacroResult = { targetCals: number; proteinG: number; carbG: number; fatG: number }

export default function TDEESection({
  clientId,
  onApplyToWeek,
  onApplyToServes,
  onOverrideMealPlan,
}: {
  clientId: string
  onApplyToWeek?: (macros: MacroResult) => void
  onApplyToServes?: (macros: MacroResult) => void
  onOverrideMealPlan?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [savingTdee, setSavingTdee] = useState(false)
  const [savingTargets, setSavingTargets] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [hasActiveMealPlan, setHasActiveMealPlan] = useState(false)

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

  const statsComplete = age && sex && heightCm && weightKg && goal
  const tdeeResult = statsComplete
    ? calcTDEE(parseFloat(age), sex as TDEESex, parseFloat(heightCm), parseFloat(weightKg), activities, parseFloat(stepsPerDay) || 0)
    : null
  const macros = tdeeResult && goal
    ? calcMacros(tdeeResult.tdee, parseFloat(weightKg), goal, adjustmentPct)
    : null

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
    await fetch(`/api/coach/clients/${clientId}/tdee`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(true)),
    })
    setSavedTdee(tdeeResult.tdee)
    setSavedCals(effectiveMacros.targetCals)
    setSavedProtein(effectiveMacros.proteinG)
    setSavedCarbs(effectiveMacros.carbG)
    setSavedFat(effectiveMacros.fatG)
    setSavingTdee(false)
    setSavedMsg('TDEE & targets saved')
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
    setHasActiveMealPlan(false)
    onOverrideMealPlan?.()
    setSavingTargets(false)
    setSavedMsg('Targets saved')
    setTimeout(() => { setSavedMsg(null); setExpanded(false) }, 1500)
  }

  if (loading) return <div className="bg-white rounded-2xl border p-5"><p className="text-sm text-gray-400">Loading…</p></div>

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">TDEE & Targets</h3>
        <button onClick={() => setExpanded(e => !e)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          {expanded ? 'Collapse' : savedTdee ? 'Recalculate' : 'Calculate'}
        </button>
      </div>

      {/* Always show saved values — visible both collapsed and while recalculating */}
      {savedTdee ? (
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
      ) : !expanded ? (
        <p className="text-sm text-gray-400">No TDEE calculated yet. Click Calculate to get started.</p>
      ) : null}

      {expanded && (
        <div className="space-y-5">
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

          {savedMsg && <p className="text-xs text-center font-semibold text-green-600">{savedMsg}</p>}

          {hasActiveMealPlan && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700">Client has an active meal plan. Daily targets are driven by the meal plan and will override any targets saved here.</p>
            </div>
          )}

          {onApplyToWeek ? (
            /* Plan mode — push calculated values to a phase/week */
            <button
              disabled={!effectiveMacros}
              onClick={() => effectiveMacros && onApplyToWeek(effectiveMacros)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1D9E75] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Set to phase / week →
            </button>
          ) : onApplyToServes ? (
            /* Serve guide mode — convert macros to serves */
            <button
              disabled={!effectiveMacros}
              onClick={() => effectiveMacros && onApplyToServes(effectiveMacros)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1D9E75] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Apply to serve targets →
            </button>
          ) : (
            /* Overview mode — save to DB / push to client dashboard */
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <button onClick={handleSaveTdee} disabled={savingTdee || !tdeeResult || !effectiveMacros}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  {savingTdee ? 'Saving…' : 'Save TDEE & targets'}
                </button>
                <button onClick={handleSaveTargets} disabled={savingTargets || !tdeeResult || !effectiveMacros}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors">
                  {savingTargets ? 'Saving…' : hasActiveMealPlan ? 'Override daily targets' : 'Set as daily targets'}
                </button>
              </div>
              <div className="flex gap-2 text-[10px] text-gray-400 px-0.5">
                <span className="flex-1 text-center">Saves TDEE + macro targets</span>
                <span className="flex-1 text-center">Also pushes to client dashboard</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
