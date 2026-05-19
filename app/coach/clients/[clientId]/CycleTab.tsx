'use client'

import { useState, useEffect, useRef } from 'react'

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-gray-400 text-center py-10">{label}</p>
}

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

export default function CycleTab({ clientId }: { clientId: string }) {
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

