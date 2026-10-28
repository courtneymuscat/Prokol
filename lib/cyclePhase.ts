// Pure cycle-phase calculation, shared between app/cycle/page.tsx (server —
// computes the initial phase/avgCycle from one SSR query) and
// app/dashboard/CyclePhaseBar.tsx (client — falls back to its own fetch +
// calc when not given initial values, e.g. if ever reused elsewhere).
// Moved out of CyclePhaseBar.tsx specifically so the server component can
// reuse it without importing a 'use client' file.

export type PhaseName = 'Menstrual' | 'Follicular' | 'Ovulation' | 'Luteal'

export type Phase = {
  name: PhaseName
  day: number
  tagline: string
  description: string
  gradient: string
  text: string
  muted: string
  segment: string
}

export const PHASES: Record<PhaseName, Omit<Phase, 'name' | 'day'>> = {
  Menstrual: {
    tagline: 'Rest & restore',
    description: 'Your body is shedding and renewing. Prioritise sleep, warmth, iron-rich foods and gentle movement. This is a time of release — physically and emotionally.',
    gradient: 'from-rose-500 to-rose-400',
    text: 'text-white',
    muted: 'text-rose-100',
    segment: 'bg-rose-400',
  },
  Follicular: {
    tagline: 'Energy is building',
    description: 'Rising oestrogen brings mental clarity, confidence and social energy. A great window for new goals, higher-intensity training and creative work.',
    gradient: 'from-amber-400 to-orange-400',
    text: 'text-white',
    muted: 'text-amber-100',
    segment: 'bg-amber-400',
  },
  Ovulation: {
    tagline: 'Peak energy & fertility',
    description: 'Oestrogen peaks and LH surges — you are at your most magnetic, communicative and energetic. The main event of your cycle.',
    gradient: 'from-teal-500 to-emerald-400',
    text: 'text-white',
    muted: 'text-teal-100',
    segment: 'bg-teal-400',
  },
  Luteal: {
    tagline: 'Turn inward & recover',
    description: 'Progesterone rises, slowing you down. Focus on recovery, nourishing meals and lower-intensity movement. Cravings and emotional sensitivity may increase as progesterone drops.',
    gradient: 'from-teal-500 to-violet-400',
    text: 'text-white',
    muted: 'text-teal-100',
    segment: 'bg-teal-400',
  },
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000)
}

export function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function calcPhase(logs: Record<string, boolean>, todayStr: string, avgCycle = 28): Phase | null {
  const periodDays = Object.keys(logs).filter(d => d <= todayStr && logs[d]).sort()
  if (periodDays.length === 0) return null

  // Find most recent period start
  let lastStart = periodDays[periodDays.length - 1]
  while (logs[addDays(lastStart, -1)]) lastStart = addDays(lastStart, -1)

  const dayOfCycle = daysBetween(lastStart, todayStr) + 1
  if (dayOfCycle > avgCycle + 7) return null

  let name: PhaseName
  if (dayOfCycle <= 5) name = 'Menstrual'
  else if (dayOfCycle <= 13) name = 'Follicular'
  else if (dayOfCycle <= 16) name = 'Ovulation'
  else name = 'Luteal'

  return { name, day: dayOfCycle, ...PHASES[name] }
}

export function calcAvgCycle(logs: Record<string, boolean>, todayStr: string): number {
  const allDates = Object.keys(logs).filter(d => d <= todayStr && logs[d]).sort()
  const starts: string[] = []
  for (const d of allDates) {
    if (!logs[addDays(d, -1)]) starts.push(d)
  }
  if (starts.length < 2) return 28
  const lengths = []
  for (let i = 1; i < starts.length; i++) {
    const l = daysBetween(starts[i - 1], starts[i])
    if (l >= 18 && l <= 45) lengths.push(l)
  }
  if (lengths.length === 0) return 28
  const recent = lengths.slice(-3)
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
}
