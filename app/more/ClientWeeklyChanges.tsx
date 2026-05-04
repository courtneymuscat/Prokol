'use client'

import { useState, useEffect } from 'react'

type PhaseType = 'deficit' | 'surplus' | 'maintenance' | 'diet_break' | 'reverse_diet' | 'recomp' | 'peak_week' | 'custom'

type Phase = {
  id: string
  name: string
  type: PhaseType
  duration_weeks: number
  calorie_target: number | null
  calorie_adjustment_pct: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  notes: string
  week_notes: string[]
  week_data: Array<{
    calorie_target: number | null
    calorie_adjustment_pct: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
  }>
}

type Plan = {
  id: string
  name: string
  start_date: string | null
  phases: Phase[]
}

const PHASE_CONFIG: Record<PhaseType, { label: string; color: string; bg: string; textColor: string }> = {
  deficit:      { label: 'Deficit',      color: '#ef4444', bg: '#fef2f2', textColor: '#b91c1c' },
  surplus:      { label: 'Surplus',      color: '#22c55e', bg: '#f0fdf4', textColor: '#15803d' },
  maintenance:  { label: 'Maintenance',  color: '#3b82f6', bg: '#eff6ff', textColor: '#1d4ed8' },
  diet_break:   { label: 'Diet Break',   color: '#f59e0b', bg: '#fffbeb', textColor: '#b45309' },
  reverse_diet: { label: 'Reverse Diet', color: '#8b5cf6', bg: '#f5f3ff', textColor: '#7c3aed' },
  recomp:       { label: 'Recomp',       color: '#1D9E75', bg: '#f0fdf9', textColor: '#065f46' },
  peak_week:    { label: 'Peak Week',    color: '#f97316', bg: '#fff7ed', textColor: '#c2410c' },
  custom:       { label: 'Custom',       color: '#6b7280', bg: '#f9fafb', textColor: '#374151' },
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

type WeekRow = {
  weekNum: number
  weeksRemaining: number
  weekBeginning: Date | null
  phase: Phase
  weekIndexInPhase: number
  isCurrentWeek: boolean
  isFirstWeekOfPhase: boolean
}

function buildWeekRows(phases: Phase[], startDate: string | null): WeekRow[] {
  const totalWeeks = phases.reduce((s, p) => s + p.duration_weeks, 0)
  const rows: WeekRow[] = []
  let weekNum = 0
  const now = new Date()

  for (const phase of phases) {
    for (let w = 0; w < phase.duration_weeks; w++) {
      const weekBeginning = startDate
        ? new Date(new Date(startDate).getTime() + weekNum * 7 * 24 * 60 * 60 * 1000)
        : null
      const weekEnd = weekBeginning
        ? new Date(weekBeginning.getTime() + 7 * 24 * 60 * 60 * 1000)
        : null
      weekNum++
      rows.push({
        weekNum,
        weeksRemaining: totalWeeks - weekNum,
        weekBeginning,
        phase,
        weekIndexInPhase: w,
        isCurrentWeek: !!(weekBeginning && weekEnd && now >= weekBeginning && now < weekEnd),
        isFirstWeekOfPhase: w === 0,
      })
    }
  }
  return rows
}

export default function ClientWeeklyChanges() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [activePlanIdx, setActivePlanIdx] = useState(0)
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/client/plans')
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : []
        setPlans(arr)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
  }

  const plan = plans[activePlanIdx] ?? null

  if (!plan) {
    return (
      <div className="py-12 text-center space-y-2">
        <p className="text-sm font-medium text-gray-500">No plan shared yet</p>
        <p className="text-xs text-gray-400">Your coach will share your weekly changes plan when it&apos;s ready.</p>
      </div>
    )
  }

  const rows = buildWeekRows(plan.phases, plan.start_date)
  const totalWeeks = plan.phases.reduce((s, p) => s + p.duration_weeks, 0)
  const currentRow = rows.find(r => r.isCurrentWeek)

  // Timeline
  const weekCursors: number[] = []
  let cursor = 0
  for (const p of plan.phases) { weekCursors.push(cursor); cursor += p.duration_weeks }

  return (
    <div className="space-y-4">
      {/* Plan selector — only shown when coach has shared multiple plans */}
      {plans.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {plans.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActivePlanIdx(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${activePlanIdx === i ? 'bg-[#1D9E75] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Plan name + current position */}
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-gray-900">{plan.name}</p>
            <p className="text-xs text-gray-400">{totalWeeks} weeks total</p>
          </div>
          {currentRow && (
            <div className="text-right flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                Week {currentRow.weekNum} of {totalWeeks}
              </span>
              {currentRow.weekBeginning && (
                <p className="text-xs text-gray-400 mt-1">w/c {fmtDate(currentRow.weekBeginning)}</p>
              )}
            </div>
          )}
        </div>

        {/* Timeline bar */}
        {plan.phases.length > 0 && (
          <div className="relative h-8 flex rounded-xl overflow-hidden">
            {plan.phases.map((phase) => {
              const widthPct = (phase.duration_weeks / totalWeeks) * 100
              const cfg = PHASE_CONFIG[phase.type]
              return (
                <div
                  key={phase.id}
                  className="relative flex items-center justify-center overflow-hidden text-xs font-semibold border-r border-white/30 last:border-r-0"
                  style={{ width: `${widthPct}%`, backgroundColor: cfg.color, color: '#fff', opacity: 0.85 }}
                  title={`${phase.name} — ${phase.duration_weeks}w`}
                >
                  {widthPct > 12 && <span className="truncate px-1 text-[11px]">{phase.name}</span>}
                </div>
              )
            })}
            {/* Current week marker */}
            {currentRow && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-sm"
                style={{ left: `${((currentRow.weekNum - 0.5) / totalWeeks) * 100}%` }}
              />
            )}
          </div>
        )}
      </div>

      {/* Weekly accordion — tap any week to expand */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border overflow-hidden divide-y divide-gray-50">
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Week by week</p>
          </div>

          {rows.map((row) => {
            const cfg = PHASE_CONFIG[row.phase.type]
            const isExpanded = expandedWeek === row.weekNum
            const wd = (row.phase.week_data ?? [])[row.weekIndexInPhase]
            const calorie = wd?.calorie_target
              ? `${wd.calorie_target} kcal`
              : wd?.calorie_adjustment_pct != null
              ? `${wd.calorie_adjustment_pct > 0 ? '+' : ''}${wd.calorie_adjustment_pct}% TDEE`
              : null
            const note = (row.phase.week_notes ?? [])[row.weekIndexInPhase] ?? ''
            const hasMacros = wd && (wd.protein_g != null || wd.carbs_g != null || wd.fat_g != null)
            const hasContent = calorie || note || hasMacros

            return (
              <div key={row.weekNum} className={row.isCurrentWeek ? 'bg-teal-50/60' : ''}>
                {/* Row header — always visible, tap to expand */}
                <button
                  onClick={() => setExpandedWeek(isExpanded ? null : row.weekNum)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-black/5 transition-colors"
                >
                  {/* Week number + NOW badge */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 w-14">
                    {row.isCurrentWeek && (
                      <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                    )}
                    <span className={`text-sm font-bold ${row.isCurrentWeek ? 'text-teal-700' : 'text-gray-900'}`}>
                      Wk {row.weekNum}
                    </span>
                  </div>

                  {/* Phase pill — shown on EVERY row */}
                  <span
                    className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.bg, color: cfg.textColor }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                    {row.phase.name}
                  </span>

                  {/* Date if available */}
                  {plan.start_date && row.weekBeginning && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {fmtDate(row.weekBeginning)}
                    </span>
                  )}

                  <div className="flex-1 min-w-0" />

                  {/* NOW badge */}
                  {row.isCurrentWeek && (
                    <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      NOW
                    </span>
                  )}

                  {/* Weeks remaining */}
                  <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">
                    {row.weeksRemaining > 0 ? `${row.weeksRemaining} left` : 'Final'}
                  </span>

                  {/* Chevron — only if there's content to show */}
                  {hasContent && (
                    <svg
                      className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && hasContent && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 bg-white/80">
                    {/* Calorie target */}
                    {calorie && (
                      <div className="pt-3">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Calorie target</p>
                        <p className="text-xl font-bold text-gray-900">{calorie}</p>
                        {hasMacros && wd && (
                          <div className="flex gap-4 mt-2">
                            {wd.protein_g != null && (
                              <div className="text-center">
                                <p className="text-sm font-bold text-purple-500">{wd.protein_g}g</p>
                                <p className="text-[10px] text-gray-400">protein</p>
                              </div>
                            )}
                            {wd.carbs_g != null && (
                              <div className="text-center">
                                <p className="text-sm font-bold text-green-500">{wd.carbs_g}g</p>
                                <p className="text-[10px] text-gray-400">carbs</p>
                              </div>
                            )}
                            {wd.fat_g != null && (
                              <div className="text-center">
                                <p className="text-sm font-bold text-blue-400">{wd.fat_g}g</p>
                                <p className="text-[10px] text-gray-400">fat</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Macros without calories */}
                    {!calorie && hasMacros && wd && (
                      <div className="pt-3">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Macro targets</p>
                        <div className="flex gap-4">
                          {wd.protein_g != null && (
                            <div className="text-center">
                              <p className="text-sm font-bold text-purple-500">{wd.protein_g}g</p>
                              <p className="text-[10px] text-gray-400">protein</p>
                            </div>
                          )}
                          {wd.carbs_g != null && (
                            <div className="text-center">
                              <p className="text-sm font-bold text-green-500">{wd.carbs_g}g</p>
                              <p className="text-[10px] text-gray-400">carbs</p>
                            </div>
                          )}
                          {wd.fat_g != null && (
                            <div className="text-center">
                              <p className="text-sm font-bold text-blue-400">{wd.fat_g}g</p>
                              <p className="text-[10px] text-gray-400">fat</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {note && (
                      <div className={calorie || hasMacros ? '' : 'pt-3'}>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
