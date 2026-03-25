'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type DataPoint = {
  date: string
  weightLbs: number
}

type TooltipState = {
  x: number
  y: number
  value: string
  date: string
} | null

const CHART_W = 600
const CHART_H = 200
const PAD = { top: 16, right: 16, bottom: 36, left: 44 }
const INNER_W = CHART_W - PAD.left - PAD.right
const INNER_H = CHART_H - PAD.top - PAD.bottom

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function WeightChart() {
  const [points, setPoints] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs')
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('weight_logs')
      .select('logged_at, weight_lbs')
      .order('logged_at', { ascending: true })
      .limit(60)
    if (data) {
      setPoints(
        data.map((r) => ({
          date: r.logged_at as string,
          weightLbs: r.weight_lbs as number,
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('checkin_weight_unit')
    if (saved === 'kg' || saved === 'lbs') setUnit(saved)

    load()

    window.addEventListener('weight-logged', load)
    return () => window.removeEventListener('weight-logged', load)
  }, [load])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Weight Over Time</h3>
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  if (points.length < 2) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Weight Over Time</h3>
        <p className="text-sm text-gray-400">Log at least 2 check-ins to see your weight trend.</p>
      </div>
    )
  }

  const display = points.map((p) => ({
    ...p,
    value: unit === 'kg' ? p.weightLbs / 2.20462 : p.weightLbs,
  }))

  const values = display.map((p) => p.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const spread = maxVal - minVal || 1
  const yMin = minVal - spread * 0.15
  const yMax = maxVal + spread * 0.15

  function toX(i: number) {
    return PAD.left + (i / (display.length - 1)) * INNER_W
  }
  function toY(v: number) {
    return PAD.top + INNER_H - ((v - yMin) / (yMax - yMin)) * INNER_H
  }

  const pathD = display
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ')

  // Area fill path
  const areaD =
    pathD +
    ` L ${toX(display.length - 1).toFixed(1)} ${(PAD.top + INNER_H).toFixed(1)}` +
    ` L ${PAD.left.toFixed(1)} ${(PAD.top + INNER_H).toFixed(1)} Z`

  // X axis labels — show up to 6 evenly spaced
  const labelCount = Math.min(6, display.length)
  const labelStep = Math.floor((display.length - 1) / (labelCount - 1)) || 1
  const labelIndices = Array.from({ length: labelCount }, (_, k) =>
    Math.min(k * labelStep, display.length - 1)
  )

  // Y axis labels — 4 ticks
  const yTicks = [0, 0.33, 0.67, 1].map((t) => yMin + t * (yMax - yMin))

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const scaleX = CHART_W / rect.width
    const mouseX = (e.clientX - rect.left) * scaleX - PAD.left
    const idx = Math.round((mouseX / INNER_W) * (display.length - 1))
    const clamped = Math.max(0, Math.min(display.length - 1, idx))
    const p = display[clamped]
    setTooltip({
      x: toX(clamped),
      y: toY(p.value),
      value: `${p.value.toFixed(1)} ${unit}`,
      date: formatDate(p.date),
    })
  }

  const latestVal = display[display.length - 1].value
  const firstVal = display[0].value
  const delta = latestVal - firstVal
  const deltaLabel = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ${unit}`
  const deltaColor = delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-500' : 'text-gray-500'

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Weight Over Time</h3>
          <p className="text-xs text-gray-400 mt-0.5">{points.length} check-ins</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${deltaColor}`}>{deltaLabel}</span>
          <button
            onClick={() => {
              const next = unit === 'lbs' ? 'kg' : 'lbs'
              setUnit(next)
              localStorage.setItem('checkin_weight_unit', next)
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full transition-colors"
          >
            {unit === 'lbs' ? 'kg' : 'lbs'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full min-w-[320px]"
          style={{ height: 200 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFD885" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#FFD885" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y grid lines + labels */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={PAD.left + INNER_W}
                y1={toY(v)}
                y2={toY(v)}
                stroke="#f3f4f6"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={toY(v)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="#9ca3af"
              >
                {unit === 'kg' ? (v / 2.20462).toFixed(1) : v.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={areaD} fill="url(#wgrad)" />

          {/* Line */}
          <path d={pathD} fill="none" stroke="#FFD885" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Dots — only show when few points */}
          {display.length <= 20 &&
            display.map((p, i) => (
              <circle
                key={i}
                cx={toX(i)}
                cy={toY(p.value)}
                r={3}
                fill="white"
                stroke="#FFD885"
                strokeWidth={2}
              />
            ))}

          {/* X axis labels */}
          {labelIndices.map((idx) => (
            <text
              key={idx}
              x={toX(idx)}
              y={PAD.top + INNER_H + 18}
              textAnchor="middle"
              fontSize={10}
              fill="#9ca3af"
            >
              {formatDate(display[idx].date)}
            </text>
          ))}

          {/* Tooltip */}
          {tooltip && (
            <>
              <line
                x1={tooltip.x}
                x2={tooltip.x}
                y1={PAD.top}
                y2={PAD.top + INNER_H}
                stroke="#d1d5db"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle cx={tooltip.x} cy={tooltip.y} r={5} fill="#FFD885" />
              <g>
                <rect
                  x={Math.min(tooltip.x + 8, CHART_W - 110)}
                  y={tooltip.y - 28}
                  width={100}
                  height={36}
                  rx={6}
                  fill="white"
                  stroke="#e5e7eb"
                  strokeWidth={1}
                  filter="drop-shadow(0 1px 2px rgba(0,0,0,0.08))"
                />
                <text
                  x={Math.min(tooltip.x + 58, CHART_W - 60)}
                  y={tooltip.y - 13}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="600"
                  fill="#111827"
                >
                  {tooltip.value}
                </text>
                <text
                  x={Math.min(tooltip.x + 58, CHART_W - 60)}
                  y={tooltip.y + 3}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#9ca3af"
                >
                  {tooltip.date}
                </text>
              </g>
            </>
          )}
        </svg>
      </div>
    </div>
  )
}
