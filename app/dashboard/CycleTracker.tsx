'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'

// ── Types ──────────────────────────────────────────────────────────────────
type Flow = 'spotting' | 'light' | 'medium' | 'heavy'
type Clots = 'none' | 'small' | 'large'
type BloodColor = 'bright_red' | 'dark_red' | 'brown' | 'pink'
type CervicalMucus = 'dry' | 'sticky' | 'creamy' | 'egg_white'
type CervixPosition = 'low' | 'average' | 'high'
type PainSide = 'left' | 'right' | 'both'
type Mood = 'happy' | 'calm' | 'anxious' | 'irritable' | 'low' | 'weepy'
type Energy = 'exhausted' | 'low' | 'medium' | 'high'
type Sleep = 'poor' | 'okay' | 'great'
type Libido = 'low' | 'medium' | 'high'
type Digestion = 'bloated' | 'normal' | 'constipated' | 'diarrhea'

type Symptom =
  | 'cramps_mild' | 'cramps_moderate' | 'cramps_severe'
  | 'headache' | 'migraine'
  | 'acne' | 'acne_hormonal'
  | 'breast_tenderness'
  | 'fatigue' | 'fatigue_severe'
  | 'bloating'
  | 'back_pain'
  | 'nausea'
  | 'diarrhea_period'
  | 'hair_shedding'
  | 'night_sweats'
  | 'insomnia'
  | 'pms_anxiety' | 'pms_rage' | 'pms_weeping'
  | 'spotting_mid' | 'spotting_pre_period'

type CycleLog = {
  log_date: string
  period: boolean
  flow: Flow | null
  clots: Clots | null
  blood_color: BloodColor | null
  spotting: boolean
  cervical_mucus: CervicalMucus | null
  cervix_position: CervixPosition | null
  bbt: string
  symptoms: Symptom[]
  mittelschmerz: boolean
  pain_side: PainSide | null
  mood: Mood | null
  energy: Energy | null
  sleep: Sleep | null
  libido: Libido | null
  digestion: Digestion | null
  notes: string
}

function emptyLog(date: string): CycleLog {
  return {
    log_date: date,
    period: false, flow: null, clots: null, blood_color: null, spotting: false,
    cervical_mucus: null, cervix_position: null, bbt: '',
    symptoms: [], mittelschmerz: false, pain_side: null,
    mood: null, energy: null, sleep: null, libido: null, digestion: null,
    notes: '',
  }
}

// ── Education content ──────────────────────────────────────────────────────
const SYMPTOM_EDUCATION: Partial<Record<Symptom, { headline: string; body: string; source?: string }>> = {
  cramps_severe: {
    headline: 'Severe cramps & high prostaglandins',
    body: 'Severe cramping is caused by high prostaglandins — inflammatory compounds that cause the uterus to contract hard. This is often linked to an inflammatory diet (high sugar, processed foods) or conditions like endometriosis. Magnesium glycinate, omega-3s, and a low-sugar diet can make a significant difference.',
    source: 'Lara Briden — Period Repair Manual',
  },
  diarrhea_period: {
    headline: 'Period diarrhea = high prostaglandins',
    body: 'Diarrhoea, nausea and vomiting at the start of your period are caused by the same prostaglandins that cause cramps. These flood into your bloodstream and affect your bowels. If this is happening, your prostaglandins are high — an anti-inflammatory diet and magnesium can help reduce them over time.',
    source: 'Lara Briden — Period Repair Manual',
  },
  breast_tenderness: {
    headline: 'Oestrogen-to-progesterone imbalance',
    body: 'Mild breast tenderness mid-cycle (ovulation) is normal. Severe tenderness in the week before your period is a red flag for oestrogen dominance or low progesterone. You only make progesterone if you ovulate — and progesterone is what keeps oestrogen in check. Confirming ovulation via BBT is key.',
    source: 'Lara Briden — Period Repair Manual',
  },
  acne_hormonal: {
    headline: 'Hormonal acne & androgens',
    body: 'Jaw, chin and neck acne is typically androgen-driven. In the luteal phase, falling progesterone can allow androgens to rise, triggering breakouts. This is a hallmark of PCOS. Dairy and high-glycaemic foods worsen androgen-driven acne. Zinc, spearmint tea and a low-sugar diet can help.',
    source: 'Lara Briden — Period Repair Manual',
  },
  pms_anxiety: {
    headline: 'PMS anxiety = low progesterone',
    body: 'Progesterone is your calming, anti-anxiety hormone — it metabolises into allopregnanolone which acts like GABA in the brain. When progesterone is low (or drops sharply pre-period), anxiety, overwhelm and irritability follow. This is the clearest sign you may not be making enough progesterone. Confirming ovulation is the first step.',
    source: 'Lara Briden — Period Repair Manual',
  },
  pms_rage: {
    headline: 'PMS rage & hormone fluctuation',
    body: 'Premenstrual rage or irritability that feels out of proportion to circumstances is a hormonal symptom — not a personality trait. It reflects low progesterone and/or oestrogen fluctuations in the late luteal phase. Tracking it helps identify the pattern and whether it\'s consistent each cycle.',
    source: 'Lara Briden — Period Repair Manual',
  },
  pms_weeping: {
    headline: 'Emotional sensitivity before your period',
    body: 'Tearfulness and low mood in the days before your period is caused by the withdrawal of progesterone and oestrogen. If it\'s severe, it may be PMDD (premenstrual dysphoric disorder) — a real condition linked to abnormal sensitivity to normal hormone changes, not just "being emotional".',
    source: 'Lara Briden — Period Repair Manual',
  },
  hair_shedding: {
    headline: 'Hair loss across the cycle',
    body: 'Excessive hair shedding can indicate: low iron (ferritin ideally >70 for hair growth — common with heavy periods), low thyroid, or high androgens/PCOS. Period-related iron deficiency is one of the most common and missed causes of hair loss in women. Ask your GP for a full iron panel, not just haemoglobin.',
    source: 'Lara Briden — Period Repair Manual',
  },
  fatigue_severe: {
    headline: 'Severe fatigue & hormonal causes',
    body: 'Fatigue at your period may indicate iron deficiency from heavy bleeding. Fatigue throughout the whole cycle, especially with feeling cold and heavy periods, points to low thyroid. Progesterone deficiency (from not ovulating) causes a flat energy profile with no midcycle peak. Each has a different solution.',
    source: 'Lara Briden — Period Repair Manual',
  },
  night_sweats: {
    headline: 'Night sweats & oestrogen shifts',
    body: 'Night sweats in the premenstrual phase can indicate a sudden drop in oestrogen. If happening frequently, it may signal early perimenopause, especially if you\'re over 35 and cycles are becoming shorter or irregular. Also seen in women with very short luteal phases.',
    source: 'Lara Briden — Period Repair Manual',
  },
  spotting_pre_period: {
    headline: 'Pre-period spotting = low progesterone',
    body: 'Brown or pink spotting 2–3+ days before your true period is a classic sign of low progesterone and a short luteal phase. Progesterone is what keeps the uterine lining in place until your period. If it drops too early, you spot. This also makes conception harder. Confirming ovulation via BBT is the first step.',
    source: 'Lara Briden — Period Repair Manual',
  },
  migraine: {
    headline: 'Menstrual migraine & oestrogen withdrawal',
    body: 'Migraines that occur just before or during your period are triggered by the rapid drop in oestrogen. These "menstrual migraines" are distinct from other migraines and are more difficult to treat. Magnesium supplementation started 10 days before your period can help prevent them.',
    source: 'Lara Briden — Period Repair Manual',
  },
  insomnia: {
    headline: 'Sleep & hormones',
    body: 'Progesterone has a sedating effect — it helps you sleep. Poor sleep in the luteal phase (week before your period) often reflects low progesterone. Waking at 3–4am specifically can also be linked to cortisol and blood sugar dysregulation, which worsens with hormone fluctuations.',
    source: 'Lara Briden — Period Repair Manual',
  },
}

const BLOOD_COLOR_EDUCATION: Record<BloodColor, { label: string; meaning: string }> = {
  bright_red: { label: 'Bright Red', meaning: 'Fresh blood — healthy, good flow' },
  dark_red: { label: 'Dark Red', meaning: 'Older blood — common at start or with slower flow' },
  brown: { label: 'Brown', meaning: 'Old blood — if at start/end of period may indicate low progesterone or slow uterine clearing' },
  pink: { label: 'Pink / Light', meaning: 'Diluted blood — can indicate low oestrogen; common in athletes or those with low body fat' },
}

const CLOT_EDUCATION: Record<Clots, { label: string; meaning: string }> = {
  none: { label: 'No clots', meaning: '' },
  small: { label: 'Small clots (<1cm)', meaning: 'Occasional small clots are normal, especially on heavier days' },
  large: { label: 'Large clots (>1cm)', meaning: 'Large clots may indicate oestrogen dominance — high oestrogen thickens the lining. Common with anovulatory cycles where no progesterone was made to balance oestrogen.' },
}

// ── Helpers ────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000)
}

type Prediction = {
  avgCycleLength: number
  nextPeriodStart: string
  nextPeriodEnd: string
  ovulationDay: string
  fertileStart: string
  fertileEnd: string
  basedOn: number
  daysUntilPeriod: number
}

type Phase = {
  name: 'Menstrual' | 'Follicular' | 'Ovulation' | 'Luteal'
  day: number
  description: string
  color: string
  bg: string
  dot: string
}

function getPhase(logs: Record<string, CycleLog>, todayStr: string, avgCycleLength = 28): Phase | null {
  // Find most recent period start on or before today
  const allDates = Object.keys(logs).filter(d => d <= todayStr && logs[d]?.period).sort()
  if (allDates.length === 0) return null

  let lastStart = allDates[allDates.length - 1]
  // Walk back to find the true start of this period block
  while (logs[addDays(lastStart, -1)]?.period) {
    lastStart = addDays(lastStart, -1)
  }

  const dayOfCycle = daysBetween(lastStart, todayStr) + 1

  // If past the expected cycle length it's likely a new cycle not yet logged
  if (dayOfCycle > avgCycleLength + 7) return null

  if (dayOfCycle <= 5) return {
    name: 'Menstrual',
    day: dayOfCycle,
    description: 'Oestrogen and progesterone are at their lowest. Rest, warmth and iron-rich foods support you most right now.',
    color: 'text-rose-700', bg: 'bg-rose-50', dot: 'bg-rose-400',
  }
  if (dayOfCycle <= 13) return {
    name: 'Follicular',
    day: dayOfCycle,
    description: 'Oestrogen is rising, bringing energy, clarity and confidence. Your best window for new projects and social plans.',
    color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-400',
  }
  if (dayOfCycle <= 16) return {
    name: 'Ovulation',
    day: dayOfCycle,
    description: 'Oestrogen peaks and LH surges. You are at peak fertility, energy and communication. The main event of your cycle.',
    color: 'text-teal-700', bg: 'bg-teal-50', dot: 'bg-teal-400',
  }
  return {
    name: 'Luteal',
    day: dayOfCycle,
    description: 'Progesterone rises after ovulation, bringing a calmer but more inward energy. PMS symptoms in the final days signal progesterone dropping.',
    color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-400',
  }
}

function calcPrediction(logs: Record<string, CycleLog>, todayStr: string): Prediction | null {
  const allDates = Object.keys(logs).sort()
  const starts: string[] = []
  for (const date of allDates) {
    if (!logs[date]?.period) continue
    if (!logs[addDays(date, -1)]?.period) starts.push(date)
  }
  if (starts.length < 2) return null

  const lengths: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const len = daysBetween(starts[i - 1], starts[i])
    if (len >= 18 && len <= 45) lengths.push(len)
  }
  if (lengths.length === 0) return null

  const recent = lengths.slice(-3)
  const avgCycleLength = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)

  const periodLengths = starts.map(start => {
    let len = 0, cur = start
    while (logs[cur]?.period) { len++; cur = addDays(cur, 1) }
    return len || 5
  })
  const avgPeriodLen = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)

  const lastStart = starts[starts.length - 1]
  const nextPeriodStart = addDays(lastStart, avgCycleLength)
  const nextPeriodEnd = addDays(nextPeriodStart, Math.max(avgPeriodLen - 1, 4))
  const ovulationDay = addDays(nextPeriodStart, -14)
  const fertileStart = addDays(ovulationDay, -5)
  const fertileEnd = addDays(ovulationDay, 1)
  const daysUntilPeriod = daysBetween(todayStr, nextPeriodStart)

  return { avgCycleLength, nextPeriodStart, nextPeriodEnd, ovulationDay, fertileStart, fertileEnd, basedOn: recent.length, daysUntilPeriod }
}

// ── UI pieces ──────────────────────────────────────────────────────────────
function Chip({ label, selected, onClick, color = 'blue' }: {
  label: string; selected: boolean; onClick: () => void; color?: string
}) {
  const colors: Record<string, string> = {
    blue:   selected ? 'bg-blue-600 text-white border-blue-600'    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300',
    rose:   selected ? 'bg-rose-500 text-white border-rose-500'    : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300',
    teal:   selected ? 'bg-teal-500 text-white border-teal-500'    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300',
    purple: selected ? 'bg-purple-500 text-white border-purple-500': 'bg-white text-gray-600 border-gray-200 hover:border-purple-300',
    amber:  selected ? 'bg-amber-500 text-white border-amber-500'  : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300',
    orange: selected ? 'bg-orange-500 text-white border-orange-500': 'bg-white text-gray-600 border-gray-200 hover:border-orange-300',
    indigo: selected ? 'bg-indigo-500 text-white border-indigo-500': 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300',
    pink:   selected ? 'bg-pink-500 text-white border-pink-500'    : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300',
    red:    selected ? 'bg-red-600 text-white border-red-600'      : 'bg-white text-gray-600 border-gray-200 hover:border-red-300',
  }
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${colors[color] ?? colors.blue}`}>
      {label}
    </button>
  )
}

function InfoBox({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'amber' | 'rose' | 'teal' }) {
  const styles = {
    blue:  'bg-blue-50 border-blue-100 text-blue-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
    rose:  'bg-rose-50 border-rose-100 text-rose-800',
    teal:  'bg-teal-50 border-teal-100 text-teal-800',
  }
  return (
    <div className={`border rounded-xl px-3 py-2.5 text-xs leading-relaxed ${styles[color]}`}>
      {children}
    </div>
  )
}

function EducationCard({ edu }: { edu: { headline: string; body: string; source?: string } }) {
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-1">
      <p className="text-xs font-bold text-indigo-800">{edu.headline}</p>
      <p className="text-xs text-indigo-700 leading-relaxed">{edu.body}</p>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </p>
      {children}
    </Card>
  )
}

// ── Cervical Mucus cards ───────────────────────────────────────────────────
const CM_OPTIONS: { key: CervicalMucus; label: string; when: string; meaning: string; fertility: string; fertilityColor: string }[] = [
  { key: 'dry', label: 'Dry', when: 'After period', meaning: 'Little to no mucus', fertility: 'Not fertile', fertilityColor: 'text-gray-400' },
  { key: 'sticky', label: 'Sticky', when: 'Between period & ovulation', meaning: 'Pasty or crumbly — sperm cannot survive', fertility: 'Low fertility', fertilityColor: 'text-amber-500' },
  { key: 'creamy', label: 'Creamy', when: 'Approaching ovulation', meaning: 'Lotion-like, white or yellow', fertility: 'Approaching fertile window', fertilityColor: 'text-amber-600' },
  { key: 'egg_white', label: 'Egg White', when: 'Ovulation imminent', meaning: 'Clear, stretchy & slippery — raw egg white appearance', fertility: 'Peak fertility', fertilityColor: 'text-teal-600 font-semibold' },
]

function CMCard({ option, selected, onClick }: { option: typeof CM_OPTIONS[0]; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all ${selected ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white hover:border-teal-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${selected ? 'text-teal-700' : 'text-gray-700'}`}>{option.label}</span>
        <span className={`text-xs ${option.fertilityColor}`}>{option.fertility}</span>
      </div>
      <p className="text-xs text-gray-400 mt-0.5">{option.when} · {option.meaning}</p>
    </button>
  )
}

// ── Symptom group ──────────────────────────────────────────────────────────
function SymptomGroup({ title, symptoms, selected, onToggle, color = 'orange' }: {
  title: string
  symptoms: { key: Symptom; label: string }[]
  selected: Symptom[]
  onToggle: (s: Symptom) => void
  color?: string
}) {
  const activeEdu = symptoms.filter(s => selected.includes(s.key) && SYMPTOM_EDUCATION[s.key])

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {symptoms.map(({ key, label }) => (
          <Chip key={key} label={label} selected={selected.includes(key)} onClick={() => onToggle(key)} color={color} />
        ))}
      </div>
      {activeEdu.map(s => (
        <EducationCard key={s.key} edu={SYMPTOM_EDUCATION[s.key]!} />
      ))}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
function CycleModal({ log, saving, onUpdate, onClose }: {
  log: CycleLog; saving: boolean; onUpdate: (log: CycleLog) => void; onClose: () => void
}) {
  const [local, setLocal] = useState<CycleLog>(log)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bbtTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setLocal(log) }, [log.log_date]) // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch: Partial<CycleLog>, debounced = false) {
    const next = { ...local, ...patch }
    setLocal(next)
    if (!debounced) onUpdate(next)
  }

  function toggleSymptom(s: Symptom) {
    const next = local.symptoms.includes(s)
      ? local.symptoms.filter((x) => x !== s)
      : [...local.symptoms, s]
    update({ symptoms: next })
  }

  function pick<T>(field: keyof CycleLog, value: T) {
    update({ [field]: local[field] === value ? null : value } as Partial<CycleLog>)
  }

  const hasPeriodData = local.period || local.spotting

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-50 rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Cycle Log</p>
            <p className="text-base font-bold text-gray-900 leading-tight">{fmtDate(local.log_date)}</p>
          </div>
          {saving ? (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </span>
          ) : (
            <span className="text-xs text-green-500 font-medium">Auto-saved</span>
          )}
        </div>

        {/* Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-2">

          {/* ── Period & Bleeding ── */}
          <Section title="Period & Bleeding" icon="🩸">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Period today</span>
              <button type="button"
                onClick={() => update({ period: !local.period, flow: !local.period ? local.flow : null })}
                className={`relative w-12 h-6 rounded-full transition-colors ${local.period ? 'bg-rose-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${local.period ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            {local.period && (
              <>
                {/* Flow */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Flow</p>
                  <div className="flex flex-wrap gap-2">
                    {(['spotting', 'light', 'medium', 'heavy'] as Flow[]).map((f) => (
                      <Chip key={f} label={f.charAt(0).toUpperCase() + f.slice(1)}
                        selected={local.flow === f} onClick={() => pick('flow', f)} color="rose" />
                    ))}
                  </div>
                  {local.flow === 'heavy' && (
                    <InfoBox color="rose">
                      <strong>Heavy periods</strong> are one of the most common hormonal problems. Causes include oestrogen dominance, fibroids, adenomyosis, or low thyroid. Heavy flow also causes iron deficiency — the most overlooked reason for fatigue and poor mood. Ask your GP for a ferritin level (aim for &gt;70).
                    </InfoBox>
                  )}
                </div>

                {/* Blood colour */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Colour</p>
                  <div className="space-y-1.5">
                    {(Object.entries(BLOOD_COLOR_EDUCATION) as [BloodColor, { label: string; meaning: string }][]).map(([key, { label, meaning }]) => (
                      <button key={key} type="button" onClick={() => pick('blood_color', key)}
                        className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${local.blood_color === key ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-white hover:border-rose-200'}`}>
                        <span className={`text-sm font-medium ${local.blood_color === key ? 'text-rose-700' : 'text-gray-700'}`}>{label}</span>
                        {meaning && <p className="text-xs text-gray-400 mt-0.5">{meaning}</p>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clots */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Clots</p>
                  <div className="space-y-1.5">
                    {(Object.entries(CLOT_EDUCATION) as [Clots, { label: string; meaning: string }][]).map(([key, { label, meaning }]) => (
                      <button key={key} type="button" onClick={() => pick('clots', key)}
                        className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${local.clots === key ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-white hover:border-rose-200'}`}>
                        <span className={`text-sm font-medium ${local.clots === key ? 'text-rose-700' : 'text-gray-700'}`}>{label}</span>
                        {meaning && <p className="text-xs text-gray-400 mt-0.5">{meaning}</p>}
                      </button>
                    ))}
                  </div>
                  {local.clots === 'large' && (
                    <InfoBox color="amber">
                      <strong>Large clots</strong> are a sign to bring up with your GP or gynaecologist. They warrant investigation for fibroids, adenomyosis or oestrogen dominance. Also check your ferritin — heavy bleeding with clots is a leading cause of iron deficiency.
                    </InfoBox>
                  )}
                </div>
              </>
            )}

            {/* Spotting (independent of period) */}
            <div className="pt-1 border-t border-gray-50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Spotting</span>
                  <p className="text-xs text-gray-400">Brown or pink — not a full period</p>
                </div>
                <button type="button"
                  onClick={() => update({ spotting: !local.spotting })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${local.spotting ? 'bg-rose-400' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${local.spotting ? 'translate-x-6' : ''}`} />
                </button>
              </div>
              {local.spotting && !local.period && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Chip label="Mid-cycle spotting" selected={local.symptoms.includes('spotting_mid')} onClick={() => toggleSymptom('spotting_mid')} color="rose" />
                    <Chip label="Pre-period spotting" selected={local.symptoms.includes('spotting_pre_period')} onClick={() => toggleSymptom('spotting_pre_period')} color="rose" />
                  </div>
                  {local.symptoms.includes('spotting_pre_period') && SYMPTOM_EDUCATION['spotting_pre_period'] && (
                    <EducationCard edu={SYMPTOM_EDUCATION['spotting_pre_period']} />
                  )}
                  {local.symptoms.includes('spotting_mid') && (
                    <InfoBox color="teal">
                      <strong>Mid-cycle spotting</strong> can be a sign of the oestrogen surge around ovulation — a small, brief bleed as oestrogen peaks. This is generally benign, but if it's heavy or frequent, it warrants investigation.
                    </InfoBox>
                  )}
                </>
              )}
            </div>
          </Section>

          {/* ── Fertility ── */}
          <Section title="Fertility Tracking (FAM)" icon="🌡">
            <InfoBox color="teal">
              <strong>FAM — Fertility Awareness Method:</strong> Ovulation is the main event of your cycle. You only make progesterone if you ovulate — and progesterone is essential for mood, sleep, bones and thyroid. Tracking BBT, cervical mucus and cervix position together gives you a complete picture of when (and whether) you ovulated.
            </InfoBox>

            {/* Cervical Mucus */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Cervical Mucus</p>
              <div className="space-y-1.5">
                {CM_OPTIONS.map((opt) => (
                  <CMCard key={opt.key} option={opt} selected={local.cervical_mucus === opt.key} onClick={() => pick('cervical_mucus', opt.key)} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                It takes 3–4 cycles to see clear patterns. Egg-white mucus post-ovulation (especially if ongoing) may indicate oestrogen is high relative to progesterone.
              </p>
            </div>

            {/* Cervix Position */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Cervix Position</p>
              <InfoBox color="teal">
                <strong>SHOW:</strong> Around ovulation the cervix becomes <strong>S</strong>oft, <strong>H</strong>igh, <strong>O</strong>pen &amp; <strong>W</strong>et. After ovulation it drops low, firms up and closes.
              </InfoBox>
              <div className="flex gap-2 mt-2">
                {([
                  { key: 'low', label: 'Low', sub: '1st knuckle depth · firm & closed · post-ovulation' },
                  { key: 'average', label: 'Average', sub: '2nd knuckle depth · transitioning' },
                  { key: 'high', label: 'High', sub: 'Beyond 2nd knuckle · soft & open · near ovulation' },
                ] as { key: CervixPosition; label: string; sub: string }[]).map(({ key, label, sub }) => (
                  <button key={key} type="button" onClick={() => pick('cervix_position', key)}
                    className={`flex-1 rounded-xl border py-2 px-1 text-center transition-all ${local.cervix_position === key ? 'bg-teal-500 border-teal-500 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-teal-300'}`}>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className={`text-xs mt-0.5 leading-tight ${local.cervix_position === key ? 'text-teal-100' : 'text-gray-400'}`}>{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* BBT */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Basal Body Temperature (°C)</p>
              <InfoBox color="teal">
                Measure <strong>under your tongue before getting out of bed</strong>. Pre-ovulation: 36.1–36.5°C. After ovulation, progesterone raises BBT by ~0.3°C and keeps it elevated until your period. A sustained rise for 3+ days confirms ovulation occurred.
              </InfoBox>
              <input type="number" step="0.01" min="35" max="39" placeholder="e.g. 36.5"
                value={local.bbt}
                onChange={(e) => {
                  const val = e.target.value
                  setLocal((l) => ({ ...l, bbt: val }))
                  if (bbtTimer.current) clearTimeout(bbtTimer.current)
                  bbtTimer.current = setTimeout(() => onUpdate({ ...local, bbt: val }), 800)
                }}
                className="mt-2 w-36 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50 focus:bg-white"
              />
            </div>
          </Section>

          {/* ── Ovulation Pain ── */}
          <Section title="Ovulation Pain (Mittelschmerz)" icon="⚡">
            <InfoBox color="teal">
              <strong>Mittelschmerz</strong> is one-sided pelvic pain at ovulation, caused by the follicle rupturing to release an egg. It can last minutes to a few hours. The side of pain typically indicates which ovary is ovulating that cycle — ovaries alternate, though not always perfectly.
            </InfoBox>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Ovulation pain felt today</span>
              <button type="button"
                onClick={() => update({ mittelschmerz: !local.mittelschmerz, pain_side: !local.mittelschmerz ? local.pain_side : null })}
                className={`relative w-12 h-6 rounded-full transition-colors ${local.mittelschmerz ? 'bg-teal-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${local.mittelschmerz ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            {local.mittelschmerz && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Which side? <span className="text-gray-400">(indicates ovulating ovary)</span></p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'left', label: 'Left', sub: 'Left ovary' },
                    { key: 'right', label: 'Right', sub: 'Right ovary' },
                    { key: 'both', label: 'Both', sub: 'Both sides' },
                  ] as { key: PainSide; label: string; sub: string }[]).map(({ key, label, sub }) => (
                    <button key={key} type="button" onClick={() => pick('pain_side', key)}
                      className={`rounded-xl border py-2 text-center transition-all ${local.pain_side === key ? 'bg-teal-500 border-teal-500 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-teal-300'}`}>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className={`text-xs mt-0.5 ${local.pain_side === key ? 'text-teal-100' : 'text-gray-400'}`}>{sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── Symptoms ── */}
          <Section title="Symptoms" icon="🩺">
            <SymptomGroup title="Pain" color="orange"
              symptoms={[
                { key: 'cramps_mild', label: 'Mild cramps' },
                { key: 'cramps_moderate', label: 'Moderate cramps' },
                { key: 'cramps_severe', label: 'Severe cramps' },
                { key: 'back_pain', label: 'Back pain' },
                { key: 'headache', label: 'Headache' },
                { key: 'migraine', label: 'Migraine' },
              ]}
              selected={local.symptoms} onToggle={toggleSymptom} />

            <SymptomGroup title="Digestive" color="amber"
              symptoms={[
                { key: 'bloating', label: 'Bloating' },
                { key: 'nausea', label: 'Nausea' },
                { key: 'diarrhea_period', label: 'Diarrhea with period' },
              ]}
              selected={local.symptoms} onToggle={toggleSymptom} />

            <SymptomGroup title="Skin & Hair" color="pink"
              symptoms={[
                { key: 'acne', label: 'Acne' },
                { key: 'acne_hormonal', label: 'Hormonal acne (jaw/chin)' },
                { key: 'hair_shedding', label: 'Hair shedding' },
              ]}
              selected={local.symptoms} onToggle={toggleSymptom} />

            <SymptomGroup title="Hormonal / Cyclical" color="purple"
              symptoms={[
                { key: 'breast_tenderness', label: 'Breast tenderness' },
                { key: 'fatigue', label: 'Fatigue' },
                { key: 'fatigue_severe', label: 'Severe fatigue' },
                { key: 'night_sweats', label: 'Night sweats' },
                { key: 'insomnia', label: 'Insomnia / waking at night' },
              ]}
              selected={local.symptoms} onToggle={toggleSymptom} />

            <SymptomGroup title="PMS / Premenstrual" color="red"
              symptoms={[
                { key: 'pms_anxiety', label: 'PMS anxiety / overwhelm' },
                { key: 'pms_rage', label: 'PMS rage / irritability' },
                { key: 'pms_weeping', label: 'Tearfulness / low mood' },
              ]}
              selected={local.symptoms} onToggle={toggleSymptom} />

            {(local.symptoms.includes('pms_anxiety') || local.symptoms.includes('pms_rage') || local.symptoms.includes('pms_weeping')) && (
              <InfoBox color="amber">
                <strong>Tracking PMS over 3 cycles</strong> is the first step in understanding your pattern. Note the day it starts relative to your period — if it's consistently 7–10 days before, this is a luteal phase hormonal pattern worth investigating with a practitioner.
                </InfoBox>
            )}
          </Section>

          {/* ── Mood ── */}
          <Section title="Mood" icon="💭">
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'happy', label: 'Happy' },
                { key: 'calm', label: 'Calm' },
                { key: 'anxious', label: 'Anxious' },
                { key: 'irritable', label: 'Irritable' },
                { key: 'low', label: 'Low' },
                { key: 'weepy', label: 'Weepy' },
              ] as { key: Mood; label: string }[]).map(({ key, label }) => (
                <Chip key={key} label={label} selected={local.mood === key} onClick={() => pick('mood', key)} color="purple" />
              ))}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Oestrogen boosts serotonin (mood up in follicular phase). Progesterone calms via GABA (relaxed in early luteal phase). When both drop before your period, mood drops too. Tracking mood across your cycle reveals your unique hormonal pattern.
            </p>
          </Section>

          {/* ── Energy ── */}
          <Section title="Energy" icon="⚡">
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'exhausted', label: 'Exhausted' },
                { key: 'low', label: 'Low' },
                { key: 'medium', label: 'Medium' },
                { key: 'high', label: 'High' },
              ] as { key: Energy; label: string }[]).map(({ key, label }) => (
                <Chip key={key} label={label} selected={local.energy === key} onClick={() => pick('energy', key)} color="amber" />
              ))}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Energy should peak in the follicular phase (after your period, before ovulation) as oestrogen rises. Consistently low energy at all phases may indicate thyroid issues or low iron.
            </p>
          </Section>

          {/* ── Sleep ── */}
          <Section title="Sleep" icon="🌙">
            <div className="flex flex-wrap gap-2">
              {(['poor', 'okay', 'great'] as Sleep[]).map((s) => (
                <Chip key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} selected={local.sleep === s} onClick={() => pick('sleep', s)} color="indigo" />
              ))}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Progesterone has a sedating effect — it helps you fall and stay asleep. Poor sleep is most common in the premenstrual week when progesterone drops. Waking at 3–4am may indicate blood sugar dysregulation or high cortisol.
            </p>
          </Section>

          {/* ── Libido ── */}
          <Section title="Libido" icon="❤️">
            <div className="flex flex-wrap gap-2">
              {(['low', 'medium', 'high'] as Libido[]).map((l) => (
                <Chip key={l} label={l.charAt(0).toUpperCase() + l.slice(1)} selected={local.libido === l} onClick={() => pick('libido', l)} color="pink" />
              ))}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Libido naturally peaks around ovulation — driven by rising oestrogen and a brief testosterone surge. Consistently low libido throughout the cycle may indicate low testosterone, high prolactin, or being on hormonal contraception.
            </p>
          </Section>

          {/* ── Digestion ── */}
          <Section title="Digestion" icon="🌿">
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'bloated', label: 'Bloated' },
                { key: 'normal', label: 'Normal' },
                { key: 'constipated', label: 'Constipated' },
                { key: 'diarrhea', label: 'Loose / Diarrhea' },
              ] as { key: Digestion; label: string }[]).map(({ key, label }) => (
                <Chip key={key} label={label} selected={local.digestion === key} onClick={() => pick('digestion', key)} color="teal" />
              ))}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Progesterone slows gut motility — constipation is common in the luteal phase. Prostaglandins at your period speed things up — diarrhoea at period onset is prostaglandin-driven. The gut microbiome also regulates oestrogen via the estrobolome.
            </p>
          </Section>

          {/* ── Notes ── */}
          <Section title="Notes" icon="📝">
            <textarea rows={3} placeholder="How are you feeling today? Anything unusual to note?"
              value={local.notes}
              onChange={(e) => {
                const val = e.target.value
                setLocal((l) => ({ ...l, notes: val }))
                if (notesTimer.current) clearTimeout(notesTimer.current)
                notesTimer.current = setTimeout(() => onUpdate({ ...local, notes: val }), 800)
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 focus:bg-white resize-none"
            />
          </Section>

          <div className="h-2" />
        </div>

        {/* Done */}
        <div className="flex-shrink-0 px-4 py-4 bg-white border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold rounded-2xl transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Calendar ──────────────────────────────────────────────────────────
export default function CycleTracker() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [logs, setLogs] = useState<Record<string, CycleLog>>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [historicLogs, setHistoricLogs] = useState<Record<string, CycleLog>>({})
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Fetch last 6 months for prediction calculation
  const fetchHistoric = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const from = addDays(todayStr, -180)
    const { data } = await supabase.from('cycle_logs')
      .select('log_date, period, flow, symptoms, mittelschmerz')
      .eq('user_id', session.user.id)
      .gte('log_date', from)
      .order('log_date', { ascending: true })
    const map: Record<string, CycleLog> = {}
    for (const row of data ?? []) {
      map[row.log_date] = { ...emptyLog(row.log_date), ...row, symptoms: row.symptoms ?? [] }
    }
    setHistoricLogs(map)
  }, [todayStr])

  useEffect(() => { fetchHistoric() }, [fetchHistoric])

  const fetchLogs = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const { data } = await supabase.from('cycle_logs').select('*')
      .eq('user_id', session.user.id).gte('log_date', from).lte('log_date', to)
    const map: Record<string, CycleLog> = {}
    for (const row of data ?? []) {
      map[row.log_date] = {
        ...row,
        symptoms: row.symptoms ?? [],
        bbt: row.bbt != null ? String(row.bbt) : '',
        notes: row.notes ?? '',
        mittelschmerz: row.mittelschmerz ?? false,
        pain_side: row.pain_side ?? null,
        cervix_position: row.cervix_position ?? null,
        clots: row.clots ?? null,
        blood_color: row.blood_color ?? null,
        spotting: row.spotting ?? false,
      }
    }
    setLogs(map)
  }, [year, month])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  async function saveLog(log: CycleLog) {
    setSaving(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); return }
    await supabase.from('cycle_logs').upsert({
      user_id: session.user.id,
      log_date: log.log_date,
      period: log.period, flow: log.flow,
      clots: log.clots, blood_color: log.blood_color, spotting: log.spotting,
      cervical_mucus: log.cervical_mucus, cervix_position: log.cervix_position,
      bbt: log.bbt ? Number(log.bbt) : null,
      symptoms: log.symptoms,
      mittelschmerz: log.mittelschmerz, pain_side: log.pain_side,
      mood: log.mood, energy: log.energy, sleep: log.sleep,
      libido: log.libido, digestion: log.digestion,
      notes: log.notes || null,
    }, { onConflict: 'user_id,log_date' })
    setLogs((prev) => ({ ...prev, [log.log_date]: log }))
    setHistoricLogs((prev) => ({ ...prev, [log.log_date]: log }))
    setSaving(false)
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) } else setMonth((m) => m + 1)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  // Merge current month logs into historic for up-to-date prediction
  const mergedLogs = { ...historicLogs, ...logs }
  const prediction = calcPrediction(mergedLogs, todayStr)
  const phase = getPhase(mergedLogs, todayStr, prediction?.avgCycleLength)

  const periodDates = new Set(Object.entries(logs).filter(([, l]) => l.period).map(([d]) => d))
  const ovulationHints = new Set<string>()
  for (const dateStr of periodDates) {
    const [dy, dm, dd] = dateStr.split('-').map(Number)
    const prev = new Date(dy, dm - 1, dd - 1)
    const prevStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
    if (!periodDates.has(prevStr)) {
      const ov = new Date(dy, dm - 1, dd + 14)
      ovulationHints.add(`${ov.getFullYear()}-${String(ov.getMonth() + 1).padStart(2, '0')}-${String(ov.getDate()).padStart(2, '0')}`)
    }
  }

  const selectedLog = selectedDate ? (logs[selectedDate] ?? emptyLog(selectedDate)) : null

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-5">
          <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <p className="text-base font-bold text-gray-900">{MONTH_NAMES[month]} {year}</p>
          <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Current phase */}
        {phase && (
          <div className={`rounded-2xl px-4 py-3 mb-3 ${phase.bg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${phase.dot}`} />
                <p className={`text-sm font-bold ${phase.color}`}>{phase.name} Phase</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 ${phase.color}`}>
                Day {phase.day}
              </span>
            </div>
            <p className={`text-xs mt-1.5 leading-relaxed ${phase.color} opacity-80`}>{phase.description}</p>
          </div>
        )}

        {/* Prediction banner */}
        {prediction && (
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="bg-rose-50 rounded-xl py-2 px-1">
              <p className="text-xs font-bold text-rose-600">
                {prediction.daysUntilPeriod > 0 ? `In ${prediction.daysUntilPeriod}d` : prediction.daysUntilPeriod === 0 ? 'Today' : 'Overdue'}
              </p>
              <p className="text-xs text-rose-400 mt-0.5">Next period</p>
            </div>
            <div className="bg-teal-50 rounded-xl py-2 px-1">
              <p className="text-xs font-bold text-teal-600">
                {`In ${Math.max(0, daysBetween(todayStr, prediction.ovulationDay))}d`}
              </p>
              <p className="text-xs text-teal-400 mt-0.5">Ovulation est.</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-2 px-1">
              <p className="text-xs font-bold text-gray-600">{prediction.avgCycleLength}d</p>
              <p className="text-xs text-gray-400 mt-0.5">Avg cycle</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d) => <p key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</p>)}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const log = logs[dateStr]
            const isPeriod = log?.period
            const isSpotting = log?.spotting && !log?.period
            const isOvulation = ovulationHints.has(dateStr)
            const isMittelschmerz = log?.mittelschmerz
            const hasSymptoms = (log?.symptoms?.length ?? 0) > 0
            const hasMood = !!log?.mood
            const hasFertility = !!log?.cervical_mucus || !!log?.bbt || !!log?.cervix_position
            const isToday = dateStr === todayStr
            const isFuture = dateStr > todayStr
            const isSelected = dateStr === selectedDate

            // Predictions (future only, not on logged period days)
            const isPredictedPeriod = !isPeriod && isFuture && prediction
              && dateStr >= prediction.nextPeriodStart && dateStr <= prediction.nextPeriodEnd
            const isPredictedOvulation = isFuture && prediction && dateStr === prediction.ovulationDay
            const isInFertileWindow = !isPeriod && isFuture && prediction
              && dateStr >= prediction.fertileStart && dateStr <= prediction.fertileEnd && !isPredictedOvulation

            const bgClass = isPeriod ? 'bg-rose-100 hover:bg-rose-200'
              : isSpotting ? 'bg-rose-50 hover:bg-rose-100'
              : isPredictedPeriod ? 'bg-rose-50 hover:bg-rose-100'
              : isPredictedOvulation ? 'bg-teal-100 hover:bg-teal-200'
              : isInFertileWindow ? 'bg-teal-50 hover:bg-teal-100'
              : 'hover:bg-gray-50'

            return (
              <button key={day} type="button" onClick={() => setSelectedDate(dateStr)}
                className={[
                  'relative flex flex-col items-center justify-start pt-1 pb-1.5 rounded-xl transition-all mx-0.5 min-h-[44px]',
                  bgClass,
                  isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : '',
                ].join(' ')}>
                <span className={[
                  'text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full',
                  isToday ? 'bg-gray-900 text-white'
                    : isPredictedOvulation ? 'text-teal-700'
                    : isPeriod ? 'text-rose-700'
                    : isPredictedPeriod ? 'text-rose-400'
                    : 'text-gray-700',
                ].join(' ')}>{day}</span>
                <div className="flex items-center gap-0.5 mt-0.5 h-2 flex-wrap justify-center">
                  {isPeriod && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                  {isSpotting && <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />}
                  {isPredictedPeriod && <span className="w-1.5 h-1.5 rounded-full border border-rose-300" />}
                  {isPredictedOvulation && <span className="w-2 h-2 rounded-full bg-teal-400 border-2 border-teal-600" />}
                  {isInFertileWindow && <span className="w-1.5 h-1.5 rounded-full bg-teal-300" />}
                  {(isOvulation || isMittelschmerz) && !isPeriod && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                  {hasSymptoms && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                  {hasMood && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  {hasFertility && <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />}
                </div>
              </button>
            )
          })}
        </div>

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
          {!prediction && (
            <p className="w-full text-xs text-gray-300 mt-1">Log 2+ complete cycles to see predictions</p>
          )}
        </div>
      </Card>

      {selectedDate && selectedLog && (
        <CycleModal log={selectedLog} saving={saving} onUpdate={saveLog} onClose={() => setSelectedDate(null)} />
      )}
    </>
  )
}
