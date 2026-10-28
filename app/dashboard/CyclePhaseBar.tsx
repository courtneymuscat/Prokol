'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type PhaseName, type Phase, PHASES, addDays, todayString, calcPhase, calcAvgCycle } from '@/lib/cyclePhase'

// ── Nutrition config ───────────────────────────────────────────────────────
type NutritionGuide = {
  appetite: string
  focus: string[]
  nutrients: { label: string; note: string }[]
  foods: string[]
  tip: string
  accentBg: string
  accentText: string
  tagBg: string
}

const NUTRITION: Record<PhaseName, NutritionGuide> = {
  Menstrual: {
    appetite: 'Appetite often lower — honour it',
    focus: ['Iron replenishment', 'Anti-inflammatory foods', 'Hydration'],
    nutrients: [
      { label: 'Iron', note: 'Lost through bleeding — prioritise daily' },
      { label: 'Vitamin C', note: 'Enhances iron absorption — pair with iron sources' },
      { label: 'Magnesium', note: 'Reduces cramps and supports sleep' },
      { label: 'Omega-3', note: 'Lowers prostaglandins and reduces cramping' },
    ],
    foods: ['Red meat or lentils', 'Leafy greens', 'Salmon', 'Dark chocolate', 'Warm soups'],
    tip: 'Eat warm, cooked foods. Avoid excess caffeine and alcohol — both worsen cramps and iron absorption.',
    accentBg: 'bg-rose-50', accentText: 'text-rose-700', tagBg: 'bg-rose-100',
  },
  Follicular: {
    appetite: 'Appetite moderate — great insulin sensitivity',
    focus: ['Balanced macros', 'Lean protein for muscle', 'Light carbs'],
    nutrients: [
      { label: 'Protein', note: 'Supports muscle repair and rising oestrogen metabolism' },
      { label: 'B vitamins', note: 'Fuel energy production as oestrogen climbs' },
      { label: 'Zinc', note: 'Supports follicle development' },
      { label: 'Probiotics', note: 'Gut health influences oestrogen clearance' },
    ],
    foods: ['Eggs', 'Fermented foods', 'Spring vegetables', 'Quinoa', 'Berries'],
    tip: 'Best phase for intermittent fasting if that suits you — insulin sensitivity is at its highest.',
    accentBg: 'bg-amber-50', accentText: 'text-amber-700', tagBg: 'bg-amber-100',
  },
  Ovulation: {
    appetite: 'Appetite steady — peak performance window',
    focus: ['Higher carbohydrates', 'Antioxidant-rich foods', 'Anti-inflammatory support'],
    nutrients: [
      { label: 'Complex carbs', note: 'Fuel high-intensity output — your body can handle them well' },
      { label: 'Antioxidants', note: 'Protect the follicle and support egg quality' },
      { label: 'Fibre', note: 'Supports oestrogen clearance via the gut' },
      { label: 'Zinc', note: 'Supports the LH surge and ovulation' },
    ],
    foods: ['Colourful vegetables', 'Whole grains', 'Berries', 'Flaxseeds', 'Nuts'],
    tip: 'Your highest energy window — match your nutrition to your output. Great time for carb-focused meals around training.',
    accentBg: 'bg-teal-50', accentText: 'text-teal-700', tagBg: 'bg-teal-100',
  },
  Luteal: {
    appetite: 'Appetite increases — cravings are hormonal',
    focus: ['Slightly higher calories', 'Complex carbs + healthy fats', 'Blood sugar stability'],
    nutrients: [
      { label: 'Magnesium', note: 'Reduces PMS, cravings and supports sleep — chocolate cravings signal deficiency' },
      { label: 'Calcium', note: 'Reduces PMS mood symptoms and bloating' },
      { label: 'Vitamin B6', note: 'Supports progesterone production and mood' },
      { label: 'Healthy fats', note: 'Support progesterone and reduce inflammation' },
    ],
    foods: ['Sweet potato', 'Avocado', 'Dark chocolate', 'Oats', 'Legumes', 'Salmon'],
    tip: 'Add ~100–200 kcal extra if hunger is elevated — this is physiological, not a lack of willpower. Prioritise stable blood sugar to manage mood and cravings.',
    accentBg: 'bg-teal-50', accentText: 'text-teal-700', tagBg: 'bg-teal-100',
  },
}

// ── Training config ────────────────────────────────────────────────────────
type TrainingGuide = {
  intensity: string
  types: string[]
  best: string[]
  reduce: string[]
  why: string
  tip: string
}

const TRAINING: Record<PhaseName, TrainingGuide> = {
  Menstrual: {
    intensity: 'Low — listen to your body',
    types: ['Restorative yoga', 'Walking', 'Gentle stretching', 'Swimming'],
    best: ['Short walks', 'Yoga & mobility', 'Breathwork', 'Light stretching'],
    reduce: ['Heavy lifting', 'HIIT', 'High-volume training'],
    why: 'Energy and iron are lower from bleeding. The body is in a repair state — pushing hard extends recovery time and can worsen cramps and fatigue.',
    tip: 'Movement is still beneficial — gentle exercise reduces prostaglandins and eases cramps. Follow your energy, not a programme.',
  },
  Follicular: {
    intensity: 'Moderate to high — build progressively',
    types: ['Strength training', 'HIIT', 'Running', 'Cycling'],
    best: ['Heavy compound lifts', 'Sprint intervals', 'New skills & PRs', 'High-volume training'],
    reduce: ['Excessive rest days', 'Only low-intensity work'],
    why: 'Rising oestrogen improves muscle repair, coordination and pain tolerance. Your body responds best to training stimulus right now — adaptations are faster in this phase.',
    tip: 'This is your best window to increase load or try something new. Your strength, endurance and motivation are all peaking.',
  },
  Ovulation: {
    intensity: 'Peak — max effort sessions',
    types: ['Max lifts', 'HIIT', 'Competitive sport', 'High-intensity cardio'],
    best: ['Personal bests', 'Competitions', 'Explosive power work', 'High-intensity intervals'],
    reduce: ['Passive rest (if energy allows)'],
    why: 'Peak oestrogen and a surge in testosterone create your highest strength, power and coordination window of the month. This is your athletic peak.',
    tip: 'Warm up thoroughly — oestrogen increases ligament laxity slightly, raising injury risk (especially ACL). Great time for PRs, poor time to skip the warm-up.',
  },
  Luteal: {
    intensity: 'Moderate — reduce volume progressively',
    types: ['Moderate weights', 'Pilates', 'Hiking', 'Cycling', 'Yoga'],
    best: ['Moderate-intensity steady state', 'Pilates & barre', 'Technique work', 'Hiking'],
    reduce: ['Max effort lifts', 'High-volume HIIT', 'Intense cardio in final days'],
    why: 'Progesterone raises resting body temperature and increases perceived effort — the same workout feels harder. Carbohydrate availability also drops, reducing endurance capacity.',
    tip: 'Your heart rate runs ~2–5 bpm higher at the same effort in the luteal phase. Train by feel, not pace or load. In the final 3–4 days, prioritise recovery.',
  },
}

const PHASE_ORDER: PhaseName[] = ['Menstrual', 'Follicular', 'Ovulation', 'Luteal']

// ── Component ──────────────────────────────────────────────────────────────
// initialPhase/initialAvgCycle, when provided by the server component that
// already queried cycle_logs for CycleTracker's 180-day history, skip this
// component's own fetch + calc entirely — previously it ran a third,
// overlapping cycle_logs query with its own separate auth round-trip.
export default function CyclePhaseBar({ initialPhase, initialAvgCycle }: { initialPhase?: Phase | null; initialAvgCycle?: number } = {}) {
  const hasInitial = initialPhase !== undefined
  const [phase, setPhase] = useState<Phase | null>(initialPhase ?? null)
  const [avgCycle, setAvgCycle] = useState(initialAvgCycle ?? 28)

  useEffect(() => {
    if (hasInitial) return
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const today = todayString()
      const from = addDays(today, -180)

      const { data } = await supabase
        .from('cycle_logs')
        .select('log_date, period')
        .eq('user_id', session.user.id)
        .gte('log_date', from)
        .order('log_date', { ascending: true })

      const logs: Record<string, boolean> = {}
      for (const row of data ?? []) logs[row.log_date] = row.period

      const avg = calcAvgCycle(logs, today)
      setAvgCycle(avg)
      setPhase(calcPhase(logs, today, avg))
    }
    load()
  }, [])

  if (!phase) return null

  const nutrition = NUTRITION[phase.name]
  const training = TRAINING[phase.name]

  // Approximate phase day ranges for the progress segments
  const phaseRanges: Record<PhaseName, [number, number]> = {
    Menstrual:  [1, 5],
    Follicular: [6, 13],
    Ovulation:  [14, 16],
    Luteal:     [17, avgCycle],
  }
  const config = PHASES[phase.name]
  const [, end] = phaseRanges[phase.name]
  const daysLeft = Math.max(0, end - phase.day + 1)

  return (
    <>
    <div className={`rounded-2xl bg-gradient-to-br ${config.gradient} p-5 shadow-lg`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest ${config.muted}`}>
            Current Phase · Day {phase.day}
          </p>
          <h2 className={`text-2xl font-bold mt-0.5 ${config.text}`}>
            {phase.name} Phase
          </h2>
          <p className={`text-sm font-semibold mt-0.5 ${config.muted}`}>
            {config.tagline}
          </p>
        </div>
        {daysLeft > 0 && (
          <div className={`flex-shrink-0 text-center px-3 py-2 rounded-xl bg-white/20`}>
            <p className={`text-lg font-bold ${config.text}`}>{daysLeft}</p>
            <p className={`text-xs ${config.muted}`}>days left</p>
          </div>
        )}
      </div>

      {/* Description */}
      <p className={`text-sm mt-3 leading-relaxed ${config.muted}`}>
        {config.description}
      </p>

      {/* Phase progress segments */}
      <div className="mt-4 flex gap-1.5">
        {PHASE_ORDER.map((p) => {
          const isActive = p === phase.name
          const isPast = PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(phase.name)
          return (
            <div key={p} className="flex-1 flex flex-col gap-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  isActive ? 'bg-white' : isPast ? 'bg-white/40' : 'bg-white/20'
                }`}
              />
              <p className={`text-xs text-center hidden sm:block ${
                isActive ? `font-bold ${config.text}` : config.muted
              }`} style={{ fontSize: '10px' }}>
                {p}
              </p>
            </div>
          )
        })}
      </div>
    </div>

    {/* Nutrition card */}
    <div className={`rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className={`px-4 py-3 ${nutrition.accentBg} flex items-center justify-between`}>
        <div>
          <p className={`text-xs font-bold uppercase tracking-widest ${nutrition.accentText}`}>
            Nutrition · {phase.name} Phase
          </p>
          <p className={`text-sm font-semibold mt-0.5 text-gray-700`}>{nutrition.appetite}</p>
        </div>
        <span className="text-xl">🥗</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Focus areas */}
        <div className="flex flex-wrap gap-2">
          {nutrition.focus.map((f) => (
            <span key={f} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${nutrition.tagBg} ${nutrition.accentText}`}>
              {f}
            </span>
          ))}
        </div>

        {/* Key nutrients */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Key Nutrients</p>
          <div className="space-y-2">
            {nutrition.nutrients.map(({ label, note }) => (
              <div key={label} className="flex items-start gap-2">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${nutrition.tagBg.replace('bg-', 'bg-').replace('-100', '-400')}`} />
                <div>
                  <span className="text-sm font-semibold text-gray-800">{label} </span>
                  <span className="text-xs text-gray-400">{note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Foods */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Eat More Of</p>
          <div className="flex flex-wrap gap-1.5">
            {nutrition.foods.map((food) => (
              <span key={food} className="text-xs px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 text-gray-600 font-medium">
                {food}
              </span>
            ))}
          </div>
        </div>

        {/* Tip */}
        <div className={`rounded-xl px-3 py-2.5 ${nutrition.accentBg}`}>
          <p className={`text-xs leading-relaxed ${nutrition.accentText}`}>
            <span className="font-bold">Tip: </span>{nutrition.tip}
          </p>
        </div>
      </div>
    </div>

    {/* Training card */}
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className={`px-4 py-3 ${nutrition.accentBg} flex items-center justify-between`}>
        <div>
          <p className={`text-xs font-bold uppercase tracking-widest ${nutrition.accentText}`}>
            Training · {phase.name} Phase
          </p>
          <p className="text-sm font-semibold mt-0.5 text-gray-700">{training.intensity}</p>
        </div>
        <span className="text-xl">🏋️</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Training types */}
        <div className="flex flex-wrap gap-1.5">
          {training.types.map((t) => (
            <span key={t} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${nutrition.tagBg} ${nutrition.accentText}`}>
              {t}
            </span>
          ))}
        </div>

        {/* Best for / Reduce */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Focus On</p>
            <ul className="space-y-1.5">
              {training.best.map((b) => (
                <li key={b} className="flex items-start gap-1.5">
                  <span className="text-green-400 mt-0.5 flex-shrink-0 text-xs">✓</span>
                  <span className="text-xs text-gray-600">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Reduce</p>
            <ul className="space-y-1.5">
              {training.reduce.map((r) => (
                <li key={r} className="flex items-start gap-1.5">
                  <span className="text-rose-400 mt-0.5 flex-shrink-0 text-xs">↓</span>
                  <span className="text-xs text-gray-600">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Why */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Why</p>
          <p className="text-xs text-gray-500 leading-relaxed">{training.why}</p>
        </div>

        {/* Tip */}
        <div className={`rounded-xl px-3 py-2.5 ${nutrition.accentBg}`}>
          <p className={`text-xs leading-relaxed ${nutrition.accentText}`}>
            <span className="font-bold">Tip: </span>{training.tip}
          </p>
        </div>
      </div>
    </div>
  </>
  )
}
