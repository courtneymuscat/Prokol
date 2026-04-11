'use client'

import { useState, useEffect } from 'react'

type PreviewData = {
  profile: {
    full_name: string | null
    target_calories: number | null
    target_protein: number | null
    target_carbs: number | null
    target_fat: number | null
  } | null
  goals: { main_goal: string | null; mini_goals: string[]; key_notes: string[] }
  meal_plans: { id: string; name: string }[]
  habits: { id: string; name: string; icon: string; target: number; unit: string }[]
  checkin_schedules: { id: string; title: string; repeat_type: string; day_of_week: number }[]
  due_autoflow_steps: { flow_id: string; flow_name: string; step_number: number; title: string }[]
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function repeatLabel(type: string): string {
  if (type === 'weekly') return 'Weekly'
  if (type === 'biweekly') return 'Every 2 weeks'
  if (type === 'monthly') return 'Monthly'
  if (type === 'once') return 'One-time'
  return 'Scheduled'
}

// ── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50',
        checked ? 'bg-blue-600' : 'bg-gray-200',
      ].join(' ')}
    >
      <span className={[
        'inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
        checked ? 'translate-x-5' : 'translate-x-0',
      ].join(' ')} />
    </button>
  )
}

// ── Phone frame ──────────────────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-sm">
      {/* Bezel */}
      <div className="bg-gray-900 rounded-[2.5rem] p-2 shadow-2xl">
        {/* Screen */}
        <div className="bg-gray-50 rounded-[2rem] overflow-hidden" style={{ height: '75vh', minHeight: 560 }}>
          {/* Status bar */}
          <div className="bg-white px-6 pt-3 pb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-900">9:41</span>
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 text-gray-900" fill="currentColor" viewBox="0 0 24 24"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round"/></svg>
              <svg className="w-3.5 h-3.5 text-gray-900" fill="currentColor" viewBox="0 0 24 24"><path d="M23 6 L17 6 L17 18 L23 18 Z M15 3 L9 3 L9 18 L15 18 Z M7 9 L1 9 L1 18 L7 18 Z" /></svg>
            </div>
          </div>
          {/* Scrollable content */}
          <div className="overflow-y-auto h-full pb-16">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 mb-5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      {children}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

const FOOD_LOG_OPTIONS: { value: 'full' | 'no_scan' | 'note_only' | 'off'; label: string; desc: string }[] = [
  { value: 'full',      label: 'Full access',  desc: 'Food log, AI scanning, and meal notes' },
  { value: 'no_scan',   label: 'No AI scan',   desc: 'Food log and meal notes, no camera scanning' },
  { value: 'note_only', label: 'Notes only',   desc: 'Meal photo & note section only' },
  { value: 'off',       label: 'Off',          desc: 'Food log hidden entirely' },
]

export default function AppPreviewTab({
  clientId,
  showDailyTargets,
  onToggleTargets,
  savingTargets,
  foodLogAccess,
  onFoodLogAccess,
  savingFoodLog,
}: {
  clientId: string
  showDailyTargets: boolean
  onToggleTargets: () => void
  savingTargets: boolean
  foodLogAccess: 'full' | 'no_scan' | 'note_only' | 'off'
  onFoodLogAccess: (v: 'full' | 'no_scan' | 'note_only' | 'off') => void
  savingFoodLog: boolean
}) {
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/coach/clients/${clientId}/preview`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load preview'))
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-gray-400">Loading preview…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-red-500">{error ?? 'No data'}</p>
      </div>
    )
  }

  const { profile, goals, meal_plans, habits, checkin_schedules, due_autoflow_steps } = data
  const name = profile?.full_name
  const hasTargets = !!(profile?.target_calories)
  const hasGoals = !!(goals.main_goal || goals.mini_goals.length || goals.key_notes.length)
  const hasCheckins = checkin_schedules.length > 0 || due_autoflow_steps.length > 0

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* Left: settings panel */}
      <div className="w-full lg:w-72 space-y-4 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">Client App Settings</h3>

        {/* Daily targets toggle */}
        <div className="bg-white rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Show daily targets</p>
              <p className="text-xs text-gray-400 mt-0.5">Calorie &amp; macro targets on home screen</p>
            </div>
            <Toggle
              checked={showDailyTargets}
              onChange={onToggleTargets}
              disabled={savingTargets}
            />
          </div>
          {!hasTargets && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
              No targets set for this client yet — targets will show once calculated.
            </p>
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
              <button
                key={opt.value}
                type="button"
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

        {/* Summary of what's visible */}
        <div className="bg-white rounded-2xl border p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Visible sections</p>
          {[
            { label: 'Goals & notes', on: hasGoals },
            { label: 'Check-ins due', on: hasCheckins },
            { label: 'Meal plan', on: meal_plans.length > 0 },
            { label: 'Daily habits', on: habits.length > 0 },
            { label: 'Daily targets', on: showDailyTargets && hasTargets },
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

      {/* Right: phone preview */}
      <div className="flex-1 min-w-0">
        <PhoneFrame>
          {/* App nav */}
          <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-10">
            <span className="text-[13px] font-bold text-gray-900">NutriCoach</span>
          </div>

          <div className="px-0 py-4 space-y-1">
            {/* Welcome */}
            <div className="px-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Welcome back{name ? `, ${name.split(' ')[0]}` : ''}!
              </h2>
              <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                Coached
              </span>
            </div>

            {/* Goals */}
            {hasGoals && (
              <Section label="My goals">
                <div className="rounded-2xl overflow-hidden space-y-2">
                  {goals.key_notes.length > 0 && (
                    <div className="rounded-xl border border-red-100 px-3 py-2.5 space-y-1.5" style={{ backgroundColor: 'rgba(254,226,226,0.45)' }}>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Important notes</p>
                      {goals.key_notes.map((n, i) => (
                        <p key={i} className="text-xs text-gray-800">• {n}</p>
                      ))}
                    </div>
                  )}
                  {goals.main_goal && (
                    <div className="rounded-xl border border-green-100 px-3 py-2.5" style={{ backgroundColor: 'rgba(220,252,231,0.45)' }}>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Main goal</p>
                      <p className="text-xs text-gray-800">{goals.main_goal}</p>
                    </div>
                  )}
                  {goals.mini_goals.length > 0 && (
                    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">This week</p>
                      <div className="space-y-1">
                        {goals.mini_goals.map((g, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                            <p className="text-xs text-gray-700">{g}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Check-ins due */}
            {hasCheckins && (
              <Section label="Check-ins">
                <div className="space-y-2">
                  {due_autoflow_steps.map((step) => (
                    <div
                      key={`${step.flow_id}-${step.step_number}`}
                      className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5"
                    >
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{step.title || `Step ${step.step_number}`}</p>
                        <p className="text-[10px] text-amber-700 mt-0.5">{step.flow_name} · Due today</p>
                      </div>
                      <span className="text-[10px] font-semibold bg-amber-500 text-white px-2 py-1 rounded-lg flex-shrink-0">Fill in →</span>
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
                  {habits.map((h) => (
                    <div key={h.id} className="flex items-center gap-2.5 px-3 py-2.5">
                      <span className="text-lg leading-none">{h.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{h.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {h.unit === 'steps' ? `${h.target.toLocaleString()} steps`
                            : h.unit === 'glasses' ? `${h.target} glasses`
                            : h.unit === 'hours' ? `${h.target} hrs`
                            : h.unit === 'times' && h.target === 1 ? 'Once daily'
                            : `${h.target} ${h.unit}`}
                        </p>
                      </div>
                      <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex-shrink-0" />
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
                    <div>
                      <p className="text-base font-bold text-gray-900">{profile!.target_calories}</p>
                      <p className="text-[10px] text-gray-400">kcal</p>
                    </div>
                    <div>
                      <p className="text-base font-bold text-purple-400">{profile!.target_protein}g</p>
                      <p className="text-[10px] text-gray-400">protein</p>
                    </div>
                    <div>
                      <p className="text-base font-bold text-green-400">{profile!.target_carbs}g</p>
                      <p className="text-[10px] text-gray-400">carbs</p>
                    </div>
                    <div>
                      <p className="text-base font-bold text-blue-400">{profile!.target_fat}g</p>
                      <p className="text-[10px] text-gray-400">fat</p>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* Food log placeholder */}
            <Section label="Today's food log">
              <div className="bg-white rounded-2xl border border-gray-100 px-3 py-4 text-center">
                <p className="text-xs text-gray-400">Food log is filled in by the client</p>
              </div>
            </Section>
          </div>
        </PhoneFrame>
      </div>
    </div>
  )
}
