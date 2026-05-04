'use client'

import { useState, useEffect } from 'react'

type PreviewData = {
  branding: { brand_colour: string | null; logo_url: string | null; brand_name: string | null }
  profile: {
    full_name: string | null
    sex: string | null
    target_calories: number | null
    target_protein: number | null
    target_carbs: number | null
    target_fat: number | null
  } | null
  goals: { main_goal: string | null; mini_goals: string[]; key_notes: string[] }
  supplements: { id: string; name: string; dosage: string | null }[]
  protocol: { id: string; title: string; content: string }[]
  meal_plans: { id: string; name: string; target_calories: number | null; target_protein: number | null; target_carbs: number | null; target_fat: number | null }[]
  habits: { id: string; name: string; icon: string; target: number; unit: string }[]
  checkin_schedules: { id: string; title: string; repeat_type: string; day_of_week: number }[]
  due_autoflow_steps: { flow_id: string; flow_name: string; step_number: number; title: string }[]
  has_serve_targets: boolean
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function repeatLabel(type: string): string {
  if (type === 'weekly')   return 'Weekly'
  if (type === 'biweekly') return 'Every 2 weeks'
  if (type === 'monthly')  return 'Monthly'
  if (type === 'once')     return 'One-time'
  return 'Scheduled'
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange}
      className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50', checked ? 'bg-blue-600' : 'bg-gray-200'].join(' ')}>
      <span className={['inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200', checked ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
    </button>
  )
}

// ── Cycle reminder toggle (fetches own state) ─────────────────────────────────

function CycleReminderCard({ clientId }: { clientId: string }) {
  const [isFemale, setIsFemale] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/coach/clients/${clientId}/cycle-reminder`)
      .then(r => r.json())
      .then(d => { setIsFemale(d.sex === 'female'); setEnabled(d.cycle_reminders !== false) })
      .catch(() => {})
  }, [clientId])

  if (!isFemale) return null

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
    } catch { setEnabled(!next) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Cycle tracking reminders</p>
          <p className="text-xs text-gray-400 mt-0.5">Daily 8pm push to log symptoms if not already logged</p>
        </div>
        <Toggle checked={enabled} onChange={toggle} disabled={saving} />
      </div>
    </div>
  )
}

// ── Phone frame ───────────────────────────────────────────────────────────────

function PhoneFrame({ children, bottomNav }: { children: React.ReactNode; bottomNav: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="bg-gray-900 rounded-[2.5rem] p-2 shadow-2xl">
        <div className="bg-gray-50 rounded-[2rem] overflow-hidden flex flex-col" style={{ height: '75vh', minHeight: 580 }}>
          {/* Status bar */}
          <div className="bg-white px-6 pt-3 pb-1 flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] font-semibold text-gray-900">9:41</span>
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
                <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
              </svg>
              <svg className="w-3.5 h-3.5 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <rect x="1" y="10" width="4" height="8" rx="1"/><rect x="7" y="7" width="4" height="11" rx="1"/><rect x="13" y="4" width="4" height="14" rx="1"/><rect x="19" y="2" width="4" height="16" rx="1"/>
              </svg>
            </div>
          </div>
          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 pb-2">
            {children}
          </div>
          {/* Bottom nav — fixed inside phone */}
          <div className="flex-shrink-0 bg-white border-t border-gray-100">
            {bottomNav}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 mb-4">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      {children}
    </div>
  )
}

// ── Nav config ────────────────────────────────────────────────────────────────

type Screen = 'home' | 'more' | 'calendar' | 'messages' | 'cycle'

const ALL_NAV: { id: Screen; label: string; icon: string; femaleOnly?: boolean }[] = [
  { id: 'home',     label: 'Home',     icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { id: 'cycle',    label: 'Cycle',    icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v4l2.5 2.5', femaleOnly: true },
  { id: 'calendar', label: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'messages', label: 'Messages', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'more',     label: 'More',     icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
]

// Phase colours for weekly changes preview
const PHASE_COLOURS: Record<string, { color: string; bg: string; text: string }> = {
  deficit:      { color: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
  surplus:      { color: '#22c55e', bg: '#f0fdf4', text: '#15803d' },
  maintenance:  { color: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  diet_break:   { color: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
  reverse_diet: { color: '#8b5cf6', bg: '#f5f3ff', text: '#7c3aed' },
  recomp:       { color: '#1D9E75', bg: '#f0fdf9', text: '#065f46' },
  peak_week:    { color: '#f97316', bg: '#fff7ed', text: '#c2410c' },
  custom:       { color: '#6b7280', bg: '#f9fafb', text: '#374151' },
}

type PreviewResource = { id: string; title: string; type: string; url: string | null; folder_name: string | null }
type PreviewPhase = { id: string; name: string; type: string; duration_weeks: number; week_notes?: string[]; week_data?: { calorie_target: number | null; calorie_adjustment_pct: number | null }[] }
type PreviewPlan = { id: string; name: string; start_date: string | null; phases: PreviewPhase[] }

// ── Food log access options ───────────────────────────────────────────────────

const FOOD_LOG_OPTIONS: { value: 'full' | 'no_scan' | 'note_only' | 'off'; label: string; desc: string }[] = [
  { value: 'full',      label: 'Full access',  desc: 'Food log, AI scanning, and meal notes' },
  { value: 'no_scan',   label: 'No AI scan',   desc: 'Food log and meal notes, no camera scanning' },
  { value: 'note_only', label: 'Notes only',   desc: 'Meal photo & note section only' },
  { value: 'off',       label: 'Off',          desc: 'Food log hidden entirely' },
]

// ── Main Component ────────────────────────────────────────────────────────────

export default function AppPreviewTab({
  clientId,
  showDailyTargets, onToggleTargets, savingTargets,
  foodLogAccess, onFoodLogAccess, savingFoodLog,
  showMealBuilder, onToggleMealBuilder, savingMealBuilder,
  showSavedMeals, onToggleSavedMeals, savingSavedMeals,
  targetsSource, targetsMealPlanId, onTargetsSource, savingTargetsSource,
}: {
  clientId: string
  showDailyTargets: boolean;   onToggleTargets: () => void;       savingTargets: boolean
  foodLogAccess: 'full' | 'no_scan' | 'note_only' | 'off'
  onFoodLogAccess: (v: 'full' | 'no_scan' | 'note_only' | 'off') => void; savingFoodLog: boolean
  showMealBuilder: boolean;    onToggleMealBuilder: () => void;   savingMealBuilder: boolean
  showSavedMeals: boolean;     onToggleSavedMeals: () => void;    savingSavedMeals: boolean
  targetsSource: 'tdee' | 'meal_plan'
  targetsMealPlanId: string | null
  onTargetsSource: (source: 'tdee' | 'meal_plan', planId: string | null) => void
  savingTargetsSource: boolean
}) {
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Screen navigation
  const [screen, setScreen] = useState<Screen>('home')
  const [moreTab, setMoreTab] = useState<'resources' | 'progress' | 'settings' | 'weekly'>('settings')

  // More screen data (lazy-loaded on first visit)
  const [previewResources, setPreviewResources] = useState<PreviewResource[] | null>(null)
  const [previewPlan, setPreviewPlan] = useState<PreviewPlan | null | false>(null) // null=not loaded, false=no visible plan
  const [moreLoading, setMoreLoading] = useState(false)

  useEffect(() => {
    setLoading(true); setError(null)
    fetch(`/api/coach/clients/${clientId}/preview`)
      .then((r) => r.json())
      .then((json) => { if (json.error) throw new Error(json.error); setData(json) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load preview'))
      .finally(() => setLoading(false))
  }, [clientId])

  // Lazy-load More screen data when coach navigates there
  useEffect(() => {
    if (screen !== 'more' || previewResources !== null) return
    setMoreLoading(true)
    Promise.all([
      fetch(`/api/coach/clients/${clientId}/resources`).then(r => r.json()),
      fetch(`/api/coach/clients/${clientId}/plans`).then(r => r.json()),
    ]).then(async ([res, plans]) => {
      setPreviewResources(Array.isArray(res) ? res : [])
      const visibleSummary = Array.isArray(plans) ? plans.find((p: { is_visible_to_client: boolean }) => p.is_visible_to_client) : null
      if (visibleSummary?.id) {
        const full = await fetch(`/api/coach/clients/${clientId}/plans/${visibleSummary.id}`).then(r => r.json())
        setPreviewPlan(full?.id ? full : false)
      } else {
        setPreviewPlan(false)
      }
    }).catch(() => {
      setPreviewResources([])
      setPreviewPlan(false)
    }).finally(() => setMoreLoading(false))
  }, [screen, previewResources, clientId])

  if (loading) return <div className="flex items-center justify-center py-16"><p className="text-sm text-gray-400">Loading preview…</p></div>
  if (error || !data) return <div className="flex items-center justify-center py-16"><p className="text-sm text-red-500">{error ?? 'No data'}</p></div>

  const { branding, profile, goals, supplements, protocol, meal_plans, habits, checkin_schedules, due_autoflow_steps } = data
  const name = profile?.full_name

  // Compute which targets to show on the phone preview based on the coach's selected source
  const selectedPlan = targetsSource === 'meal_plan'
    ? (meal_plans.find(p => p.id === targetsMealPlanId) ?? meal_plans[0] ?? null)
    : null
  const previewTargets = selectedPlan
    ? { cal: selectedPlan.target_calories, pro: selectedPlan.target_protein, carb: selectedPlan.target_carbs, fat: selectedPlan.target_fat }
    : { cal: profile?.target_calories ?? null, pro: profile?.target_protein ?? null, carb: profile?.target_carbs ?? null, fat: profile?.target_fat ?? null }

  const hasTargets = !!(previewTargets.cal)
  // Clients see main_goal + mini_goals only — key_notes are coach-only
  const hasGoals = !!(goals.main_goal || goals.mini_goals.length)
  const hasCheckins = checkin_schedules.length > 0 || due_autoflow_steps.length > 0
  const brandColour = branding.brand_colour ?? '#1D9E75'
  const appName = branding.brand_name ?? 'Prokol'

  const isFemale = profile?.sex !== 'male'
  const navItems = ALL_NAV.filter(n => !n.femaleOnly || isFemale)

  const bottomNav = (
    <div className="flex items-center justify-around px-2 py-2">
      {navItems.map((item) => {
        const active = screen === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setScreen(item.id)}
            className="flex flex-col items-center gap-0.5 flex-1 py-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke={active ? brandColour : '#9CA3AF'} strokeWidth={active ? 2.5 : 1.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span className="text-[9px] font-medium" style={{ color: active ? brandColour : '#9CA3AF' }}>{item.label}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* ── Settings panel ─────────────────────────────────────────────────── */}
      <div className="w-full lg:w-72 space-y-4 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">Client App Settings</h3>

        {/* Daily targets */}
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Show daily targets</p>
              <p className="text-xs text-gray-400 mt-0.5">Calorie &amp; macro targets on home screen</p>
            </div>
            <Toggle checked={showDailyTargets} onChange={onToggleTargets} disabled={savingTargets} />
          </div>
          {showDailyTargets && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Targets source</p>
              {/* TDEE option */}
              <button
                onClick={() => onTargetsSource('tdee', null)}
                disabled={savingTargetsSource}
                className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                  targetsSource === 'tdee'
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-base">🧮</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${targetsSource === 'tdee' ? 'text-blue-700' : 'text-gray-700'}`}>TDEE Calculated</p>
                  <p className="text-[11px] text-gray-400">Uses targets from the TDEE calculator</p>
                </div>
                {targetsSource === 'tdee' && <span className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></span>}
              </button>
              {/* Meal plan option */}
              <button
                onClick={() => onTargetsSource('meal_plan', targetsMealPlanId ?? (meal_plans[0]?.id ?? null))}
                disabled={savingTargetsSource || meal_plans.length === 0}
                className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${
                  targetsSource === 'meal_plan'
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-base">🍽️</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${targetsSource === 'meal_plan' ? 'text-purple-700' : 'text-gray-700'}`}>From Meal Plan</p>
                  <p className="text-[11px] text-gray-400">{meal_plans.length === 0 ? 'No active meal plans' : 'Uses targets from an active meal plan'}</p>
                </div>
                {targetsSource === 'meal_plan' && <span className="w-4 h-4 rounded-full bg-purple-500 flex-shrink-0 flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></span>}
              </button>
              {/* Plan picker when meal_plan is selected */}
              {targetsSource === 'meal_plan' && meal_plans.length > 1 && (
                <select
                  value={targetsMealPlanId ?? ''}
                  onChange={e => onTargetsSource('meal_plan', e.target.value || null)}
                  disabled={savingTargetsSource}
                  className="w-full border border-purple-200 rounded-xl px-3 py-2 text-xs text-purple-900 bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
                >
                  {meal_plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {!hasTargets && targetsSource === 'tdee' && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  No TDEE targets set yet — calculate in the Overview tab.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Food log access */}
        <div className="bg-white rounded-2xl border p-4 space-y-2.5">
          <div>
            <p className="text-sm font-medium text-gray-900">Food log access</p>
            <p className="text-xs text-gray-400 mt-0.5">Control what the client can use</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FOOD_LOG_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => onFoodLogAccess(opt.value)} disabled={savingFoodLog}
                className={['text-left rounded-xl border p-3 transition-colors disabled:opacity-50', foodLogAccess === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'].join(' ')}>
                <p className={`text-xs font-semibold ${foodLogAccess === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>{opt.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Food log features */}
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Food log features</p>
          {[
            { label: 'Meal builder', sub: 'Build meals from individual foods', checked: showMealBuilder, onChange: onToggleMealBuilder, disabled: savingMealBuilder },
            { label: 'Saved meals',  sub: 'Access and log previously saved meals', checked: showSavedMeals,   onChange: onToggleSavedMeals,   disabled: savingSavedMeals },
          ].map(({ label, sub, checked, onChange, disabled }) => (
            <div key={label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
              <Toggle checked={checked} onChange={onChange} disabled={disabled} />
            </div>
          ))}
        </div>

        {/* Cycle tracking reminders */}
        <CycleReminderCard clientId={clientId} />

        {/* Visible sections summary */}
        <div className="bg-white rounded-2xl border p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Visible sections</p>
          {[
            { label: 'Goals',        on: hasGoals },
            { label: 'Protocol',     on: protocol.length > 0 },
            { label: 'Supplements',  on: supplements.length > 0 },
            { label: 'Daily targets',on: showDailyTargets && hasTargets },
            { label: 'Meal plan',    on: meal_plans.length > 0 },
            { label: 'Daily habits', on: habits.length > 0 },
            { label: 'Check-ins',    on: hasCheckins },
            { label: 'Food log',     on: foodLogAccess !== 'off' },
            { label: 'Meal builder', on: showMealBuilder },
            { label: 'Saved meals',  on: showSavedMeals },
          ].map(({ label, on }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${on ? 'bg-green-100' : 'bg-gray-100'}`}>
                {on
                  ? <svg className="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                  : <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                }
              </span>
              <span className={`text-xs ${on ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Phone preview ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 text-center mb-3">Click the nav tabs below to explore each section of the client app</p>
        <PhoneFrame bottomNav={bottomNav}>
          {/* App nav */}
          <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-10 flex items-center gap-2">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={appName} className="h-7 w-7 object-cover rounded-full border border-gray-100 flex-shrink-0" />
            ) : null}
            <span className="text-[13px] font-bold" style={{ color: brandColour }}>{appName}</span>
          </div>

          {/* ── HOME screen ─────────────────────────────────────── */}
          {screen === 'home' && <div className="py-4 space-y-0">
            {/* Welcome */}
            <div className="px-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Welcome back{name ? `, ${name.split(' ')[0]}` : ''}!
              </h2>
              <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: brandColour }}>
                Coached
              </span>
            </div>

            {/* Goals — matches GoalsPanel exactly: main_goal + mini_goals only */}
            {hasGoals && (
              <Section label="My Goals">
                <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3.5 space-y-3">
                  {goals.main_goal && (
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5">Main goal</p>
                      <p className="text-xs font-semibold text-gray-900">{goals.main_goal}</p>
                    </div>
                  )}
                  {goals.mini_goals.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 mb-1.5">This week</p>
                      <ul className="space-y-1.5">
                        {goals.mini_goals.map((g, i) => (
                          <li key={i} className="flex items-start gap-2 overflow-hidden">
                            <span className="mt-0.5 w-3.5 h-3.5 rounded-full border-2 border-blue-300 flex-shrink-0" />
                            <span className="text-xs text-gray-800 break-words overflow-hidden">{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Protocol — matches ProtocolPanel */}
            {protocol.length > 0 && (
              <Section label="Protocol">
                <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3.5 space-y-2.5">
                  {protocol.slice(0, 3).map((s) => (
                    <div key={s.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{s.title}</p>
                      <p className="text-xs text-gray-800 line-clamp-3 leading-relaxed">{s.content}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Supplements — matches SupplementsPanel */}
            {supplements.length > 0 && (
              <Section label="Supplements">
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50">
                  {supplements.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-start gap-2.5 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900">{s.name}</p>
                        {s.dosage && <p className="text-[10px] text-gray-500 mt-0.5">{s.dosage}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Daily targets */}
            {showDailyTargets && hasTargets && (
              <Section label="Daily targets">
                <div className="bg-white rounded-2xl border border-gray-200 px-3 py-3">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div><p className="text-sm font-bold text-gray-900">{previewTargets.cal}</p><p className="text-[10px] text-gray-400">kcal</p></div>
                    <div><p className="text-sm font-bold text-pink-500">{previewTargets.pro ?? '—'}g</p><p className="text-[10px] text-gray-400">protein</p></div>
                    <div><p className="text-sm font-bold text-purple-500">{previewTargets.carb ?? '—'}g</p><p className="text-[10px] text-gray-400">carbs</p></div>
                    <div><p className="text-sm font-bold text-blue-400">{previewTargets.fat ?? '—'}g</p><p className="text-[10px] text-gray-400">fat</p></div>
                  </div>
                  {selectedPlan && (
                    <p className="text-[9px] text-gray-400 text-center mt-1.5 truncate">from: {selectedPlan.name}</p>
                  )}
                </div>
              </Section>
            )}

            {/* Meal plan */}
            {meal_plans.length > 0 && (
              <Section label="My Meal Plan">
                <div className="bg-white rounded-2xl border border-gray-200 px-3 py-3 space-y-1.5">
                  {meal_plans.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-sm">🥗</span>
                      <p className="text-xs font-medium text-gray-800">{p.name}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Habits */}
            {habits.length > 0 && (
              <Section label="Daily Habits">
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50">
                  {habits.slice(0, 5).map((h) => (
                    <div key={h.id} className="flex items-center gap-2.5 px-3 py-2.5">
                      <span className="text-lg leading-none">{h.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{h.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {h.unit === 'times' && h.target === 1 ? 'Once daily' : `${h.target} ${h.unit}`}
                        </p>
                      </div>
                      <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Check-ins */}
            {hasCheckins && (
              <Section label="Check-ins">
                <div className="space-y-2">
                  {due_autoflow_steps.map((step) => (
                    <div key={`${step.flow_id}-${step.step_number}`}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-3 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{step.title || `Step ${step.step_number}`}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{step.flow_name} · Due today</p>
                      </div>
                      <span className="text-[10px] font-semibold text-white px-2 py-1 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: brandColour }}>Fill in →</span>
                    </div>
                  ))}
                  {checkin_schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-3 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{s.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {repeatLabel(s.repeat_type)}{s.repeat_type !== 'once' && ` · Every ${DAY_NAMES[s.day_of_week]}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Food log */}
            {foodLogAccess !== 'off' && (
              <Section label="Today's food log">
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((meal, i) => (
                    <div key={meal} className={`flex items-center justify-between px-3 py-2.5 ${i < 3 ? 'border-b border-gray-50' : ''}`}>
                      <p className="text-xs font-medium text-gray-700">{meal}</p>
                      <span className="text-[10px] font-semibold text-gray-300">+ Add</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Food Cheat Sheet — shown when serve targets are set */}
            {data.has_serve_targets && (
              <Section label="">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border border-emerald-200 bg-emerald-50">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <div>
                      <p className="text-xs font-semibold text-emerald-800">Food Cheat Sheet</p>
                      <p className="text-[10px] text-emerald-600">See what counts as 1 serve of each food</p>
                    </div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Section>
            )}
          </div>}

          {/* ── MORE screen — bottom sheet grid matching actual /more page ─── */}
          {screen === 'more' && (() => {
            // Build grid items
            const hasResources = (previewResources ?? []).length > 0
            const moreGridItems = [
              ...(hasResources ? [{ id: 'resources', label: 'Resources', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }] : []),
              ...(data.has_serve_targets ? [{ id: 'food_guide', label: 'Food Guide', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' }] : []),
              { id: 'progress', label: 'Progress Photos', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
              ...(previewPlan ? [{ id: 'weekly', label: 'Weekly Changes', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }] : []),
              { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
            ]
            return (
              <div className="relative h-full">
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gray-700/80" />
                {/* Sheet */}
                <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <h2 className="text-base font-bold text-gray-900">More</h2>
                    <button type="button" onClick={() => setScreen('home')}
                      className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* Grid — 3 columns, equal width, no horizontal overflow */}
                  {moreLoading
                    ? <p className="text-center text-[11px] text-gray-400 py-6">Loading…</p>
                    : (
                      <div className="grid grid-cols-3 border-t border-gray-100">
                        {moreGridItems.map((item, i) => {
                          const col = i % 3
                          const row = Math.floor(i / 3)
                          const totalRows = Math.ceil(moreGridItems.length / 3)
                          const borderRight = col < 2 ? 'border-r border-gray-100' : ''
                          const borderBottom = row < totalRows - 1 ? 'border-b border-gray-100' : ''
                          return (
                            <button key={item.id} type="button"
                              className={`flex flex-col items-center justify-center gap-2 py-5 px-2 ${borderRight} ${borderBottom}`}>
                              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d={item.icon} />
                              </svg>
                              <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">{item.label}</span>
                            </button>
                          )
                        })}
                        {/* Fill empty grid cells */}
                        {moreGridItems.length % 3 !== 0 && Array.from({ length: 3 - moreGridItems.length % 3 }).map((_, i) => (
                          <div key={`e${i}`} className="border-t border-gray-100 bg-gray-50" />
                        ))}
                      </div>
                    )
                  }
                  <div className="h-4" />
                </div>
              </div>
            )
          })()}

          {/* Weekly Changes full-screen when tapped from More grid (future: add moreTab === 'weekly' navigate) */}

          {/* ── CYCLE placeholder ───────────────────────────────── */}
          {screen === 'cycle' && (
            <div className="py-8 px-4 text-center space-y-2">
              <svg className="w-10 h-10 text-gray-200 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l2.5 2.5M8 3.5C9.2 2.9 10.6 2.5 12 2.5" />
              </svg>
              <p className="text-xs font-medium text-gray-500">Cycle Tracking</p>
              <p className="text-[10px] text-gray-400">Client logs cycle phases, symptoms, BBT, mood and energy here.</p>
            </div>
          )}

          {/* ── CALENDAR placeholder ─────────────────────────────── */}
          {screen === 'calendar' && (
            <div className="py-8 px-4 text-center space-y-2">
              <svg className="w-10 h-10 text-gray-200 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs font-medium text-gray-500">Calendar</p>
              <p className="text-[10px] text-gray-400">Client events, training sessions and social occasions appear here.</p>
            </div>
          )}

          {/* ── MESSAGES placeholder ─────────────────────────────── */}
          {screen === 'messages' && (
            <div className="py-8 px-4 text-center space-y-2">
              <svg className="w-10 h-10 text-gray-200 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xs font-medium text-gray-500">Messages</p>
              <p className="text-[10px] text-gray-400">Direct messages between you and your client appear here.</p>
            </div>
          )}
        </PhoneFrame>
      </div>
    </div>
  )
}
