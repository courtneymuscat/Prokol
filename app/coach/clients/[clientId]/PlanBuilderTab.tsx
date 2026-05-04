'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import TDEESection from './TDEESection'

// ── Types ─────────────────────────────────────────────────────────────────────

type PhaseType =
  | 'deficit'
  | 'surplus'
  | 'maintenance'
  | 'diet_break'
  | 'reverse_diet'
  | 'recomp'
  | 'peak_week'
  | 'custom'

type WeekData = {
  calorie_target: number | null
  calorie_adjustment_pct: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}

function emptyWeekData(): WeekData {
  return { calorie_target: null, calorie_adjustment_pct: null, protein_g: null, carbs_g: null, fat_g: null }
}

function resizeWeekData(arr: WeekData[], n: number): WeekData[] {
  const copy = [...(arr ?? [])]
  while (copy.length < n) copy.push(emptyWeekData())
  return copy.slice(0, n)
}

type Phase = {
  id: string
  name: string
  type: PhaseType
  duration_weeks: number
  // Phase-level fields kept for backward compat but no longer shown in UI
  calorie_target: number | null
  calorie_adjustment_pct: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  notes: string
  week_notes: string[]
  coach_week_notes: string[]
  week_data: WeekData[]  // per-week calorie + macro targets
}

type Plan = {
  name: string
  start_date: string | null
  phases: Phase[]
  is_visible_to_client: boolean
}

type Template = {
  id: string
  name: string
  description: string | null
  phases: Phase[]
}

// ── Phase config ───────────────────────────────────────────────────────────────

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

const PHASE_TYPE_ORDER: PhaseType[] = [
  'deficit', 'surplus', 'maintenance', 'diet_break', 'reverse_diet', 'recomp', 'peak_week', 'custom',
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function emptyArr(n: number): string[] {
  return Array(n).fill('')
}

function resizeArr(arr: string[], n: number): string[] {
  const copy = [...(arr ?? [])]
  while (copy.length < n) copy.push('')
  return copy.slice(0, n)
}

function makePhase(type: PhaseType = 'deficit'): Phase {
  return {
    id: uid(),
    name: PHASE_CONFIG[type].label,
    type,
    duration_weeks: 4,
    calorie_target: null,
    calorie_adjustment_pct: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    notes: '',
    week_notes: emptyArr(4),
    coach_week_notes: emptyArr(4),
    week_data: Array.from({ length: 4 }, emptyWeekData),
  }
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ phases, startDate }: { phases: Phase[]; startDate: string | null }) {
  const totalWeeks = phases.reduce((s, p) => s + p.duration_weeks, 0)
  if (totalWeeks === 0) return null

  const today = new Date()
  let currentWeek: number | null = null
  if (startDate) {
    const start = new Date(startDate)
    const msPerWeek = 7 * 24 * 60 * 60 * 1000
    const diff = Math.floor((today.getTime() - start.getTime()) / msPerWeek)
    if (diff >= 0 && diff < totalWeeks) currentWeek = diff
  }

  let weekCursor = 0
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Timeline — {totalWeeks} weeks total</p>
      <div className="relative h-10 flex rounded-xl overflow-hidden">
        {phases.map((phase) => {
          const widthPct = (phase.duration_weeks / totalWeeks) * 100
          const phaseStartWeek = weekCursor
          weekCursor += phase.duration_weeks
          const isActive = currentWeek != null && currentWeek >= phaseStartWeek && currentWeek < weekCursor
          const cfg = PHASE_CONFIG[phase.type]
          return (
            <div
              key={phase.id}
              title={`${phase.name} — ${phase.duration_weeks}w`}
              className="relative flex items-center justify-center overflow-hidden text-xs font-semibold border-r border-white/30 last:border-r-0 transition-opacity"
              style={{
                width: `${widthPct}%`,
                backgroundColor: cfg.color,
                opacity: isActive ? 1 : 0.75,
                color: '#fff',
              }}
            >
              {isActive && (
                <span className="absolute inset-0 animate-pulse opacity-20" style={{ backgroundColor: '#fff' }} />
              )}
              {widthPct > 10 && (
                <span className="truncate px-1">{phase.name}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Week ruler */}
      <div className="relative h-4 flex">
        {phases.map((phase) => {
          const widthPct = (phase.duration_weeks / totalWeeks) * 100
          return (
            <div
              key={phase.id}
              className="text-center"
              style={{ width: `${widthPct}%` }}
            >
              <span className="text-[10px] text-gray-400">{phase.duration_weeks}w</span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-1">
        {Array.from(new Set(phases.map(p => p.type))).map(type => {
          const cfg = PHASE_CONFIG[type]
          return (
            <span key={type} className="flex items-center gap-1 text-xs" style={{ color: cfg.textColor }}>
              <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cfg.color }} />
              {cfg.label}
            </span>
          )
        })}
        {currentWeek != null && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-white border border-gray-300 flex-shrink-0" />
            Current: week {currentWeek + 1}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Phase card ────────────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  index,
  total,
  clientId,
  onChange,
  onMove,
  onDelete,
}: {
  phase: Phase
  index: number
  total: number
  clientId: string
  onChange: (updated: Phase) => void
  onMove: (from: number, to: number) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const cfg = PHASE_CONFIG[phase.type]

  function set<K extends keyof Phase>(key: K, val: Phase[K]) {
    onChange({ ...phase, [key]: val })
  }

  function setNum(key: 'calorie_target' | 'calorie_adjustment_pct' | 'protein_g' | 'carbs_g' | 'fat_g', raw: string) {
    const n = raw === '' ? null : Number(raw)
    onChange({ ...phase, [key]: n })
  }

  async function applyMacros() {
    setApplying(true)
    await fetch(`/api/coach/clients/${clientId}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase }),
    })
    setApplying(false)
    setApplied(true)
    setTimeout(() => setApplied(false), 2500)
  }

  const hasTargets = phase.calorie_target != null || phase.calorie_adjustment_pct != null ||
    phase.protein_g != null || phase.carbs_g != null || phase.fat_g != null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle / reorder */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button
            onClick={() => onMove(index, index - 1)}
            disabled={index === 0}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
            aria-label="Move up"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
          </button>
          <button
            onClick={() => onMove(index, index + 1)}
            disabled={index === total - 1}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
            aria-label="Move down"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>

        {/* Type pill */}
        <select
          value={phase.type}
          onChange={(e) => {
            const t = e.target.value as PhaseType
            onChange({ ...phase, type: t, name: phase.name === PHASE_CONFIG[phase.type].label ? PHASE_CONFIG[t].label : phase.name })
          }}
          className="text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-0"
          style={{ backgroundColor: cfg.bg, color: cfg.textColor }}
        >
          {PHASE_TYPE_ORDER.map(t => (
            <option key={t} value={t}>{PHASE_CONFIG[t].label}</option>
          ))}
        </select>

        {/* Name */}
        <input
          value={phase.name}
          onChange={(e) => set('name', e.target.value)}
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-400 focus:outline-none transition-colors min-w-0"
          placeholder="Phase name"
        />

        {/* Duration */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => {
              const n = Math.max(1, phase.duration_weeks - 1)
              onChange({ ...phase, duration_weeks: n, week_notes: resizeArr(phase.week_notes, n), coach_week_notes: resizeArr(phase.coach_week_notes, n), week_data: resizeWeekData(phase.week_data ?? [], n) })
            }}
            className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs transition-colors"
          >−</button>
          <span className="text-sm font-medium text-gray-700 w-12 text-center">{phase.duration_weeks}w</span>
          <button
            onClick={() => {
              const n = phase.duration_weeks + 1
              onChange({ ...phase, duration_weeks: n, week_notes: resizeArr(phase.week_notes, n), coach_week_notes: resizeArr(phase.coach_week_notes, n), week_data: resizeWeekData(phase.week_data ?? [], n) })
            }}
            className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs transition-colors"
          >+</button>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(phase.id)}
          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
          aria-label="Delete phase"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Expanded body — phase-level coach notes only; cals/macros live in weekly rows */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Phase notes</p>
          <textarea
            value={phase.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Overall phase focus, training approach, check-in frequency…"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
          <p className="text-xs text-gray-400 mt-2">Set calorie & macro targets per week in the Weekly Schedule below.</p>
        </div>
      )}
    </div>
  )
}

// ── Weekly schedule ───────────────────────────────────────────────────────────

type WeekRow = {
  weekNum: number
  weeksRemaining: number
  weekBeginning: Date | null
  phase: Phase
  weekIndexInPhase: number
  isCurrentWeek: boolean
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
      })
    }
  }
  return rows
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function WeeklySchedule({
  phases,
  startDate,
  clientId,
  planId,
  onUpdateWeekNote,
  onUpdateWeekData,
  onCopyWeek,
}: {
  phases: Phase[]
  startDate: string | null
  clientId: string
  planId: string
  onUpdateWeekNote: (phaseId: string, weekIndex: number, field: 'week_notes' | 'coach_week_notes', value: string) => void
  onUpdateWeekData: (phaseId: string, weekIndex: number, patch: Partial<WeekData>) => void
  onCopyWeek: (phaseId: string, fromIndex: number, toIndices: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [applyingKey, setApplyingKey] = useState<string | null>(null)
  const [appliedKey, setAppliedKey] = useState<string | null>(null)
  const [copyMenuKey, setCopyMenuKey] = useState<string | null>(null)
  const rows = buildWeekRows(phases, startDate)

  if (rows.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-gray-900">Weekly Schedule</span>
          <span className="text-xs text-gray-400">{rows.length} weeks</span>
          {!startDate && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Set a start date to see dates</span>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {rows.map((row) => {
            const cfg = PHASE_CONFIG[row.phase.type]
            const rowKey = `${row.phase.id}-${row.weekIndexInPhase}`
            const isExpanded = expandedKey === rowKey
            const isCopyMenuOpen = copyMenuKey === rowKey
            const weekNote = (row.phase.week_notes ?? [])[row.weekIndexInPhase] ?? ''
            const coachNote = (row.phase.coach_week_notes ?? [])[row.weekIndexInPhase] ?? ''
            const wd: WeekData = (row.phase.week_data ?? [])[row.weekIndexInPhase] ?? emptyWeekData()
            const hasAnyNote = weekNote || coachNote
            const hasTargets = wd.calorie_target != null || wd.calorie_adjustment_pct != null || wd.protein_g != null

            const calorie = wd.calorie_target
              ? `${wd.calorie_target} kcal`
              : wd.calorie_adjustment_pct != null
              ? `${wd.calorie_adjustment_pct > 0 ? '+' : ''}${wd.calorie_adjustment_pct}% TDEE`
              : ''

            return (
              <div
                key={rowKey}
                className={row.isCurrentWeek ? 'bg-teal-50' : 'bg-white'}
              >
                {/* Row header — click to expand */}
                <button
                  onClick={() => setExpandedKey(isExpanded ? null : rowKey)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
                >
                  {/* Week number */}
                  <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                    {row.isCurrentWeek && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />}
                    <span className={`text-sm font-semibold ${row.isCurrentWeek ? 'text-teal-700' : 'text-gray-900'}`}>
                      Wk {row.weekNum}
                    </span>
                    {row.isCurrentWeek && (
                      <span className="text-[9px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">NOW</span>
                    )}
                  </div>

                  {/* Weeks remaining */}
                  <span className="text-xs text-gray-400 w-14 flex-shrink-0 tabular-nums">
                    {row.weeksRemaining > 0 ? `${row.weeksRemaining} left` : 'Final'}
                  </span>

                  {/* Date */}
                  {startDate && (
                    <span className="text-xs text-gray-500 w-24 flex-shrink-0 tabular-nums">
                      {row.weekBeginning ? fmtDate(row.weekBeginning) : '—'}
                    </span>
                  )}

                  {/* Phase pill */}
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.bg, color: cfg.textColor }}
                  >
                    {row.phase.name}
                  </span>

                  {/* Calorie */}
                  {calorie && (
                    <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">{calorie}</span>
                  )}

                  {/* Note preview */}
                  <span className="text-xs text-gray-400 flex-1 truncate min-w-0 text-left">
                    {weekNote || coachNote
                      ? (weekNote || coachNote).slice(0, 60) + ((weekNote || coachNote).length > 60 ? '…' : '')
                      : ''}
                  </span>

                  {/* Note indicator dots */}
                  <div className="flex gap-1 flex-shrink-0">
                    {weekNote && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Has client note" />}
                    {coachNote && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Has coach note" />}
                  </div>

                  <svg className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded week editor */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 space-y-4 bg-gray-50/60 border-t border-gray-100">

                    {/* Calorie target */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Calorie Target</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Absolute (kcal)</label>
                          <input
                            type="number"
                            value={wd.calorie_target ?? ''}
                            onChange={(e) => onUpdateWeekData(row.phase.id, row.weekIndexInPhase, { calorie_target: e.target.value === '' ? null : Number(e.target.value) })}
                            placeholder="e.g. 1800"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">% from TDEE (e.g. −15)</label>
                          <input
                            type="number"
                            value={wd.calorie_adjustment_pct ?? ''}
                            onChange={(e) => onUpdateWeekData(row.phase.id, row.weekIndexInPhase, { calorie_adjustment_pct: e.target.value === '' ? null : Number(e.target.value) })}
                            placeholder="e.g. −15"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Macros */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Macros (g) — optional</p>
                      <div className="grid grid-cols-3 gap-3">
                        {(['protein_g', 'carbs_g', 'fat_g'] as const).map((key) => (
                          <div key={key}>
                            <label className="text-xs text-gray-500 mb-1 block capitalize">{key.replace('_g', '')}</label>
                            <input
                              type="number"
                              value={wd[key] ?? ''}
                              onChange={(e) => onUpdateWeekData(row.phase.id, row.weekIndexInPhase, { [key]: e.target.value === '' ? null : Number(e.target.value) })}
                              placeholder="g"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Client-visible notes */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Notes <span className="font-normal text-gray-400">(visible to client when plan is shared)</span>
                      </label>
                      <textarea
                        value={weekNote}
                        onChange={(e) => onUpdateWeekNote(row.phase.id, row.weekIndexInPhase, 'week_notes', e.target.value)}
                        rows={2}
                        placeholder="e.g. Increase cardio this week, check in Thursday…"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      />
                    </div>

                    {/* Coach-only notes */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 mb-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Coach notes <span className="font-normal text-amber-500">(private — never shown to client)</span>
                      </label>
                      <textarea
                        value={coachNote}
                        onChange={(e) => onUpdateWeekNote(row.phase.id, row.weekIndexInPhase, 'coach_week_notes', e.target.value)}
                        rows={2}
                        placeholder="e.g. Client mentioned stress this week, adjust if needed…"
                        className="w-full border border-amber-100 bg-amber-50/40 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>

                    {/* Apply macros + Copy to */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {/* Copy to */}
                      <div className="relative">
                        <button
                          onClick={() => setCopyMenuKey(isCopyMenuOpen ? null : rowKey)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Copy to…
                        </button>
                        {isCopyMenuOpen && (
                          <div className="absolute bottom-full mb-1 left-0 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10 min-w-[180px]">
                            <button
                              onClick={() => {
                                const indices = Array.from({ length: row.phase.duration_weeks }, (_, i) => i).filter(i => i !== row.weekIndexInPhase)
                                onCopyWeek(row.phase.id, row.weekIndexInPhase, indices)
                                setCopyMenuKey(null)
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              All weeks in this phase
                            </button>
                            <button
                              onClick={() => {
                                const indices = Array.from({ length: row.phase.duration_weeks }, (_, i) => i).filter(i => i > row.weekIndexInPhase)
                                onCopyWeek(row.phase.id, row.weekIndexInPhase, indices)
                                setCopyMenuKey(null)
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Following weeks only
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Apply macros */}
                      <button
                        onClick={async () => {
                          setApplyingKey(rowKey)
                          await fetch(`/api/coach/clients/${clientId}/plans/${planId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phase: wd }),
                          })
                          setApplyingKey(null)
                          setAppliedKey(rowKey)
                          setTimeout(() => setAppliedKey(k => k === rowKey ? null : k), 2500)
                        }}
                        disabled={!hasTargets || applyingKey === rowKey}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-40"
                        style={{
                          backgroundColor: appliedKey === rowKey ? '#f0fdf4' : '#1D9E75',
                          color: appliedKey === rowKey ? '#15803d' : '#fff',
                        }}
                      >
                        {applyingKey === rowKey ? 'Applying…' : appliedKey === rowKey ? 'Applied ✓' : 'Apply macros to client'}
                      </button>
                    </div>
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

// ── Main component ─────────────────────────────────────────────────────────────

type PlanSummary = { id: string; name: string; is_visible_to_client: boolean }

export default function PlanBuilderTab({ clientId }: { clientId: string }) {
  const [summaries, setSummaries] = useState<PlanSummary[]>([])
  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [plan, setPlan] = useState<Plan>({ name: 'Protocol', start_date: null, phases: [], is_visible_to_client: false })
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [planLoading, setPlanLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)
  const [showMorePhases, setShowMorePhases] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingMacros, setPendingMacros] = useState<{ targetCals: number; proteinG: number; carbG: number; fatG: number } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load plan list + templates on mount
  useEffect(() => {
    Promise.all([
      fetch(`/api/coach/clients/${clientId}/plans`).then(r => r.json()),
      fetch('/api/coach/plans/templates').then(r => r.json()),
    ]).then(([list, tplData]) => {
      const plans: PlanSummary[] = Array.isArray(list) ? list : []
      setSummaries(plans)
      setTemplates(Array.isArray(tplData) ? tplData : [])
      if (plans.length > 0) {
        setActivePlanId(plans[0].id)
      } else {
        setLoading(false)
      }
    })
  }, [clientId])

  // Load full plan when activePlanId changes
  useEffect(() => {
    if (!activePlanId) return
    setPlanLoading(true)
    fetch(`/api/coach/clients/${clientId}/plans/${activePlanId}`)
      .then(r => r.json())
      .then(d => { setPlan(d); setPlanLoading(false); setLoading(false) })
  }, [activePlanId, clientId])

  const scheduleSave = useCallback((updated: Plan & { id?: string }) => {
    if (!updated.id && !activePlanId) return
    const id = updated.id ?? activePlanId!
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/coach/clients/${clientId}/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      // Sync name change into summaries
      setSummaries(s => s.map(p => p.id === id ? { ...p, name: updated.name, is_visible_to_client: updated.is_visible_to_client } : p))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
  }, [clientId, activePlanId])

  function updatePlan(updated: Plan) {
    setPlan(updated)
    scheduleSave({ ...updated, id: activePlanId ?? undefined } as Plan & { id?: string })
  }

  async function createPlan() {
    const res = await fetch(`/api/coach/clients/${clientId}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Protocol' }),
    })
    const newPlan = await res.json()
    setSummaries(s => [...s, { id: newPlan.id, name: newPlan.name, is_visible_to_client: false }])
    setActivePlanId(newPlan.id)
  }

  async function deletePlan(id: string) {
    await fetch(`/api/coach/clients/${clientId}/plans/${id}`, { method: 'DELETE' })
    const remaining = summaries.filter(s => s.id !== id)
    setSummaries(remaining)
    setConfirmDeleteId(null)
    if (activePlanId === id) {
      if (remaining.length > 0) {
        setActivePlanId(remaining[remaining.length - 1].id)
      } else {
        setActivePlanId(null)
        setPlan({ name: 'Protocol', start_date: null, phases: [], is_visible_to_client: false })
      }
    }
  }

  function addPhase(type: PhaseType = 'deficit') {
    const updated = { ...plan, phases: [...plan.phases, makePhase(type)] }
    updatePlan(updated)
  }

  function handleUpdateWeekNote(phaseId: string, weekIndex: number, field: 'week_notes' | 'coach_week_notes', value: string) {
    const phases = plan.phases.map(p => {
      if (p.id !== phaseId) return p
      const arr = [...(p[field] ?? emptyArr(p.duration_weeks))]
      arr[weekIndex] = value
      return { ...p, [field]: arr }
    })
    updatePlan({ ...plan, phases })
  }

  function handleUpdateWeekData(phaseId: string, weekIndex: number, patch: Partial<WeekData>) {
    const phases = plan.phases.map(p => {
      if (p.id !== phaseId) return p
      const arr = resizeWeekData(p.week_data ?? [], p.duration_weeks)
      arr[weekIndex] = { ...arr[weekIndex], ...patch }
      return { ...p, week_data: arr }
    })
    updatePlan({ ...plan, phases })
  }

  function handleCopyWeek(phaseId: string, fromIndex: number, toIndices: number[]) {
    const phases = plan.phases.map(p => {
      if (p.id !== phaseId) return p
      const srcData = (p.week_data ?? [])[fromIndex] ?? emptyWeekData()
      const srcNote = (p.week_notes ?? [])[fromIndex] ?? ''
      const srcCoachNote = (p.coach_week_notes ?? [])[fromIndex] ?? ''
      const week_data = resizeWeekData(p.week_data ?? [], p.duration_weeks)
      const week_notes = resizeArr(p.week_notes ?? [], p.duration_weeks)
      const coach_week_notes = resizeArr(p.coach_week_notes ?? [], p.duration_weeks)
      toIndices.forEach(i => {
        week_data[i] = { ...srcData }
        week_notes[i] = srcNote
        coach_week_notes[i] = srcCoachNote
      })
      return { ...p, week_data, week_notes, coach_week_notes }
    })
    updatePlan({ ...plan, phases })
  }

  function updatePhase(p: Phase) {
    const updated = { ...plan, phases: plan.phases.map(x => x.id === p.id ? p : x) }
    updatePlan(updated)
  }

  function movePhase(from: number, to: number) {
    if (to < 0 || to >= plan.phases.length) return
    const phases = [...plan.phases]
    const [item] = phases.splice(from, 1)
    phases.splice(to, 0, item)
    updatePlan({ ...plan, phases })
  }

  function deletePhase(id: string) {
    updatePlan({ ...plan, phases: plan.phases.filter(p => p.id !== id) })
  }

  function loadTemplate(tpl: Template) {
    const phases = tpl.phases.map(p => ({ ...p, id: uid() }))
    const updated = { ...plan, phases }
    updatePlan(updated)
    setShowTemplatePanel(false)
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/coach/plans/templates/${id}`, { method: 'DELETE' })
    setTemplates(ts => ts.filter(t => t.id !== id))
  }

  async function saveAsTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    const res = await fetch('/api/coach/plans/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: templateName.trim(), phases: plan.phases }),
    })
    const tpl = await res.json()
    setTemplates(ts => [tpl, ...ts])
    setTemplateName('')
    setSavingTemplate(false)
    setShowSaveModal(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading…</div>
    )
  }

  // Empty state — no plans yet
  if (summaries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center space-y-3">
        <p className="text-sm font-medium text-gray-500">No protocols yet</p>
        <p className="text-xs text-gray-400">Create a protocol to start planning this client's phases and weekly changes.</p>
        <button
          onClick={createPlan}
          className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#1D9E75] text-white hover:opacity-90 transition-opacity"
        >
          Create first protocol
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Plan tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {summaries.map(s => (
          <div key={s.id} className="relative flex-shrink-0 group">
            <button
              onClick={() => setActivePlanId(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${activePlanId === s.id ? 'bg-[#1D9E75] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {s.is_visible_to_client && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-300 flex-shrink-0" title="Visible to client" />
              )}
              {s.name}
            </button>
            {/* Delete button — shows on hover */}
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id) }}
              className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] items-center justify-center hidden group-hover:flex transition-opacity`}
              aria-label="Delete plan"
            >×</button>
          </div>
        ))}
        <button
          onClick={createPlan}
          className="flex-shrink-0 w-7 h-7 rounded-xl border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center text-lg leading-none"
          title="New protocol"
        >+</button>
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">Delete "{summaries.find(s => s.id === confirmDeleteId)?.name}"? This cannot be undone.</p>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setConfirmDeleteId(null)} className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-white transition-colors">Cancel</button>
            <button onClick={() => deletePlan(confirmDeleteId)} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors">Delete</button>
          </div>
        </div>
      )}

      {planLoading && <div className="py-8 text-center text-sm text-gray-400">Loading protocol…</div>}

      {!planLoading && activePlanId && (
      <>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={plan.name}
          onChange={(e) => updatePlan({ ...plan, name: e.target.value })}
          className="text-lg font-bold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-[#1D9E75] focus:outline-none transition-colors flex-1 min-w-0"
          placeholder="Plan name"
        />

        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-xs text-gray-500">Start date</label>
          <input
            type="date"
            value={plan.start_date ?? ''}
            onChange={(e) => updatePlan({ ...plan, start_date: e.target.value || null })}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
        </div>

        <span className="text-xs text-gray-400 flex-shrink-0">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : ''}
        </span>
      </div>

      {/* Client visibility toggle */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${plan.is_visible_to_client ? 'bg-teal-50 border-teal-100' : 'bg-white border-gray-200'}`}>
        <div>
          <p className={`text-sm font-semibold ${plan.is_visible_to_client ? 'text-teal-800' : 'text-gray-700'}`}>
            Visible to client
          </p>
          <p className={`text-xs mt-0.5 ${plan.is_visible_to_client ? 'text-teal-600' : 'text-gray-400'}`}>
            {plan.is_visible_to_client
              ? 'Client can see their Weekly Changes in their More tab'
              : 'Client cannot see this plan — toggle on when ready to share'}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={plan.is_visible_to_client}
          onClick={() => updatePlan({ ...plan, is_visible_to_client: !plan.is_visible_to_client })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${plan.is_visible_to_client ? 'bg-[#1D9E75]' : 'bg-gray-200'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${plan.is_visible_to_client ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Timeline */}
      <Timeline phases={plan.phases} startDate={plan.start_date} />

      {/* Phase list */}
      <div className="space-y-2">
        {plan.phases.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center space-y-2">
            <p className="text-sm font-medium text-gray-500">No phases yet</p>
            <p className="text-xs text-gray-400">Add a phase below to start planning this client's protocol</p>
          </div>
        )}

        {plan.phases.map((phase, i) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            index={i}
            total={plan.phases.length}
            clientId={clientId}
            onChange={updatePhase}
            onMove={movePhase}
            onDelete={deletePhase}
          />
        ))}
      </div>

      {/* Weekly schedule */}
      <WeeklySchedule
        phases={plan.phases}
        startDate={plan.start_date}
        clientId={clientId}
        planId={activePlanId!}
        onUpdateWeekNote={handleUpdateWeekNote}
        onUpdateWeekData={handleUpdateWeekData}
        onCopyWeek={handleCopyWeek}
      />

      {/* Add phase actions */}
      <div className="flex flex-wrap gap-2">
        {(['deficit', 'surplus', 'maintenance', 'diet_break'] as PhaseType[]).map(type => {
          const cfg = PHASE_CONFIG[type]
          return (
            <button
              key={type}
              onClick={() => addPhase(type)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors hover:opacity-80"
              style={{ borderColor: cfg.color, color: cfg.textColor, backgroundColor: cfg.bg }}
            >
              + {cfg.label}
            </button>
          )
        })}

        {/* More — toggles secondary phase types */}
        <button
          onClick={() => setShowMorePhases(v => !v)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${showMorePhases ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          {showMorePhases ? '− Less' : '+ More'}
        </button>

        <div className="flex-1" />

        {/* Templates */}
        <button
          onClick={() => setShowTemplatePanel(v => !v)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${showTemplatePanel ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Templates
        </button>

        {plan.phases.length > 0 && (
          <button
            onClick={() => { setTemplateName(plan.name); setShowSaveModal(true) }}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#1D9E75] text-[#1D9E75] hover:bg-[#f0fdf9] transition-colors"
          >
            Save as template
          </button>
        )}
      </div>

      {/* Secondary phase types — hidden until + More is clicked */}
      {showMorePhases && (
        <div className="flex flex-wrap gap-2 -mt-2">
          {(['reverse_diet', 'recomp', 'peak_week', 'custom'] as PhaseType[]).map(type => {
            const cfg = PHASE_CONFIG[type]
            return (
              <button
                key={type}
                onClick={() => addPhase(type)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors hover:opacity-80"
                style={{ borderColor: cfg.color, color: cfg.textColor, backgroundColor: cfg.bg }}
              >
                + {cfg.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Template panel */}
      {showTemplatePanel && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Your templates</p>
          {templates.length === 0 && (
            <p className="text-xs text-gray-400">No templates saved yet. Build a plan and click "Save as template".</p>
          )}
          {templates.map(tpl => (
            <div key={tpl.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{tpl.name}</p>
                <p className="text-xs text-gray-400">{tpl.phases.length} phase{tpl.phases.length !== 1 ? 's' : ''} · {tpl.phases.reduce((s, p) => s + p.duration_weeks, 0)}w total</p>
                {/* Mini phase pills */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {tpl.phases.map(p => {
                    const cfg = PHASE_CONFIG[p.type]
                    return (
                      <span
                        key={p.id}
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: cfg.bg, color: cfg.textColor }}
                      >
                        {p.name} {p.duration_weeks}w
                      </span>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => loadTemplate(tpl)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#1D9E75] text-white hover:opacity-90 transition-opacity"
                >
                  Apply
                </button>
                <button
                  onClick={() => deleteTemplate(tpl.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save as template modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <p className="text-base font-bold text-gray-900">Save as template</p>
            <input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveAsTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#1D9E75] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {savingTemplate ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* TDEE reference calculator — results can be pushed directly to a phase/week */}
      <TDEESection clientId={clientId} onApplyToWeek={(macros) => setPendingMacros(macros)} />

      {/* Week picker — shown after "Set to phase / week →" is clicked */}
      {pendingMacros && activePlanId && (
        <div className="bg-white rounded-2xl border border-[#1D9E75] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Apply to a week</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {pendingMacros.targetCals} kcal · {pendingMacros.proteinG}g P · {pendingMacros.carbG}g C · {pendingMacros.fatG}g F
              </p>
            </div>
            <button onClick={() => setPendingMacros(null)} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {plan.phases.map((phase) => {
              const cfg = PHASE_CONFIG[phase.type]
              return (
                <div key={phase.id} className="space-y-1">
                  {/* Apply to whole phase */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: cfg.bg, color: cfg.textColor }}
                    >
                      {phase.name} — all {phase.duration_weeks} weeks
                    </span>
                    <button
                      onClick={() => {
                        const indices = Array.from({ length: phase.duration_weeks }, (_, i) => i)
                        handleUpdateWeekData && indices.forEach(i => {
                          handleUpdateWeekData(phase.id, i, {
                            calorie_target: pendingMacros.targetCals,
                            protein_g: pendingMacros.proteinG,
                            carbs_g: pendingMacros.carbG,
                            fat_g: pendingMacros.fatG,
                          })
                        })
                        setPendingMacros(null)
                      }}
                      className="text-xs font-semibold px-3 py-1 rounded-xl bg-[#1D9E75] text-white hover:opacity-90 transition-opacity flex-shrink-0"
                    >
                      Apply all
                    </button>
                  </div>
                  {/* Individual weeks */}
                  {Array.from({ length: phase.duration_weeks }, (_, wi) => (
                    <div key={wi} className="flex items-center justify-between gap-2 pl-6 pr-3 py-1.5">
                      <span className="text-xs text-gray-600">Week {wi + 1} of {phase.name}</span>
                      <button
                        onClick={() => {
                          handleUpdateWeekData(phase.id, wi, {
                            calorie_target: pendingMacros.targetCals,
                            protein_g: pendingMacros.proteinG,
                            carbs_g: pendingMacros.carbG,
                            fat_g: pendingMacros.fatG,
                          })
                          setPendingMacros(null)
                        }}
                        className="text-xs font-semibold px-3 py-1 rounded-xl border border-[#1D9E75] text-[#1D9E75] hover:bg-[#f0fdf9] transition-colors flex-shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
            {plan.phases.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Add phases to your plan first.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
