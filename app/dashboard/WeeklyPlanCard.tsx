'use client'

import { useState, useEffect } from 'react'

type WeekData = {
  calorie_target: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fibre_g: number | null
}

type Phase = {
  id: string
  name: string
  type: string
  duration_weeks: number
  calorie_target: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  week_notes: string[]
  week_data: WeekData[]
}

type Plan = {
  id: string
  name: string
  start_date: string | null
  is_visible_to_client: boolean
  phases: Phase[]
}

type WeekInfo = {
  weekNumber: number
  totalWeeks: number
  planName: string
  phaseName: string
  note: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fibre: number | null
}

function getWeekInfo(plan: Plan): WeekInfo | null {
  if (!plan.start_date || !plan.phases?.length) return null

  const start = new Date(plan.start_date)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysDiff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(daysDiff / 7) + 1

  if (weekNumber < 1) return null // plan hasn't started yet

  const totalWeeks = plan.phases.reduce((sum, p) => sum + (p.duration_weeks || 0), 0)
  if (weekNumber > totalWeeks) return null // plan is complete

  let cumWeeks = 0
  for (const phase of plan.phases) {
    cumWeeks += phase.duration_weeks
    if (weekNumber <= cumWeeks) {
      const weekInPhase = weekNumber - (cumWeeks - phase.duration_weeks) - 1
      const wd = (phase.week_data ?? [])[weekInPhase]

      return {
        weekNumber,
        totalWeeks,
        planName: plan.name,
        phaseName: phase.name,
        note: (phase.week_notes ?? [])[weekInPhase] ?? '',
        // Per-week targets take precedence over phase-level fallback
        calories: wd?.calorie_target ?? phase.calorie_target,
        protein: wd?.protein_g ?? phase.protein_g,
        carbs: wd?.carbs_g ?? phase.carbs_g,
        fat: wd?.fat_g ?? phase.fat_g,
        fibre: wd?.fibre_g ?? null,
      }
    }
  }

  return null
}

export default function WeeklyPlanCard() {
  const [info, setInfo] = useState<WeekInfo | null | 'loading'>('loading')

  useEffect(() => {
    fetch('/api/client/plans')
      .then((r) => (r.ok ? r.json() : []))
      .then((plans: Plan[]) => {
        for (const plan of plans) {
          const week = getWeekInfo(plan)
          if (week) { setInfo(week); return }
        }
        setInfo(null)
      })
      .catch(() => setInfo(null))
  }, [])

  if (info === 'loading' || info === null) return null

  const { weekNumber, totalWeeks, phaseName, note, calories, protein, carbs, fat, fibre } = info
  const hasMacros = calories || protein || carbs || fat || fibre

  return (
    <div className="bg-white rounded-2xl border px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">This week</p>
        <span className="text-xs text-gray-400 font-medium">
          Week {weekNumber} <span className="text-gray-300">of {totalWeeks}</span>
        </span>
      </div>

      <p className="text-sm font-semibold text-gray-900">{phaseName}</p>

      {hasMacros && (
        <div className="flex gap-2 flex-wrap">
          {calories != null && (
            <span className="text-xs bg-orange-50 text-orange-500 font-semibold px-2.5 py-1 rounded-full">
              {Math.round(calories)} kcal
            </span>
          )}
          {protein != null && (
            <span className="text-xs bg-teal-50 text-teal-600 font-semibold px-2.5 py-1 rounded-full">
              P {Math.round(protein)}g
            </span>
          )}
          {carbs != null && (
            <span className="text-xs bg-green-50 text-green-600 font-semibold px-2.5 py-1 rounded-full">
              C {Math.round(carbs)}g
            </span>
          )}
          {fat != null && (
            <span className="text-xs bg-blue-50 text-blue-400 font-semibold px-2.5 py-1 rounded-full">
              F {Math.round(fat)}g
            </span>
          )}
          {fibre != null && (
            <span className="text-xs bg-amber-50 text-amber-600 font-semibold px-2.5 py-1 rounded-full">
              Fibre {Math.round(fibre)}g
            </span>
          )}
        </div>
      )}

      {note && (
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{note}</p>
      )}
    </div>
  )
}
