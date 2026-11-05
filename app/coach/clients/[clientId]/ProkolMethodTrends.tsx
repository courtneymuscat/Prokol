'use client'

type AutoflowCheckInLike = {
  flow_name: string
  step_number: number
  step_title?: string | null
  submitted_at: string
  answers: Record<string, string>
}

const SCALE_METRICS: { key: string; label: string; color: string }[] = [
  { key: 'overall_1_10', label: 'Overall', color: '#6366f1' },
  { key: 'energy_1_10', label: 'Energy', color: '#f59e0b' },
  { key: 'sleep_quality_1_10', label: 'Sleep', color: '#8b5cf6' },
  { key: 'stress_1_10', label: 'Stress', color: '#ef4444' },
]

const CHART_W = 520
const CHART_H = 140
const PAD = { top: 10, right: 10, bottom: 20, left: 24 }
const INNER_W = CHART_W - PAD.left - PAD.right
const INNER_H = CHART_H - PAD.top - PAD.bottom

function num(v: string | undefined): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function LineChart({ series, minY, maxY, points }: {
  series: { key: string; label: string; color: string }[]
  minY: number
  maxY: number
  points: { x: number; values: Record<string, number | null> }[]
}) {
  if (points.length < 2) {
    return <p className="text-xs text-gray-400 py-6 text-center">Need at least 2 check-ins to show a trend.</p>
  }
  const xMin = points[0].x
  const xMax = points[points.length - 1].x
  const xScale = (x: number) => PAD.left + (xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * INNER_W)
  const yScale = (y: number) => PAD.top + INNER_H - ((y - minY) / (maxY - minY)) * INNER_H

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={PAD.left} x2={CHART_W - PAD.right} y1={PAD.top + INNER_H * f} y2={PAD.top + INNER_H * f} stroke="#f3f4f6" strokeWidth={1} />
      ))}
      {series.map((s) => {
        const path = points
          .map((p) => (p.values[s.key] != null ? { x: xScale(p.x), y: yScale(p.values[s.key] as number) } : null))
          .filter((p): p is { x: number; y: number } => p != null)
        if (path.length < 2) return null
        const d = path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
        return (
          <g key={s.key}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {path.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={s.color} />)}
          </g>
        )
      })}
    </svg>
  )
}

export default function ProkolMethodTrends({ checkIns }: { checkIns: AutoflowCheckInLike[] }) {
  const prokol = checkIns
    .filter((c) => c.flow_name === 'The Prokol Method - Check-ins')
    .sort((a, b) => a.step_number - b.step_number)

  if (prokol.length === 0) return null

  const points = prokol.map((c) => ({
    x: c.step_number,
    values: Object.fromEntries(SCALE_METRICS.map((m) => [m.key, num(c.answers[m.key])])),
  }))

  const weightPoints = prokol
    .map((c) => ({ x: c.step_number, value: num(c.answers.weight_avg_kg) }))
    .filter((p): p is { x: number; value: number } => p.value != null)

  const week0 = prokol.find((c) => c.step_title === 'Week 0 Check-in')
  const final = prokol.find((c) => c.step_title === 'Final Check-in')

  const COMPARISON_METRICS: { week0Key: string; finalKey: string; label: string }[] = [
    { week0Key: 'start_energy', finalKey: 'now_energy', label: 'Energy' },
    { week0Key: 'start_sleep', finalKey: 'now_sleep', label: 'Sleep' },
    { week0Key: 'start_hunger', finalKey: 'now_hunger', label: 'Hunger' },
    { week0Key: 'start_stress', finalKey: 'now_stress', label: 'Stress' },
    { week0Key: 'food_confidence_1_10', finalKey: 'now_food_confidence', label: 'Food confidence' },
  ]

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Prokol Method trends</p>
        <div className="flex items-center gap-3 flex-wrap">
          {SCALE_METRICS.map((m) => (
            <span key={m.key} className="flex items-center gap-1 text-[11px] text-gray-500">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <LineChart series={SCALE_METRICS} minY={0} maxY={10} points={points} />

      {weightPoints.length >= 2 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Weigh-in average (kg)</p>
          <LineChart
            series={[{ key: 'w', label: 'Weight', color: '#10b981' }]}
            minY={Math.min(...weightPoints.map((p) => p.value)) - 1}
            maxY={Math.max(...weightPoints.map((p) => p.value)) + 1}
            points={weightPoints.map((p) => ({ x: p.x, values: { w: p.value } }))}
          />
        </div>
      )}

      {week0 && final && (
        <div className="pt-4 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Week 0 vs Week 12</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {COMPARISON_METRICS.map((m) => {
              const before = num(week0.answers[m.week0Key])
              const after = num(final.answers[m.finalKey])
              return (
                <div key={m.label}>
                  <p className="text-[11px] text-gray-400">{m.label}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {before ?? '—'} <span className="text-gray-300">→</span> {after ?? '—'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
