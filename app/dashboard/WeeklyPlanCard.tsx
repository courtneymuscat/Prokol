'use client'

import { useState, useEffect } from 'react'
import { pickCurrentWeek, type WeekInfo, type WeekPlan } from '@/lib/weeklyPlan'

export default function WeeklyPlanCard() {
  const [info, setInfo] = useState<WeekInfo | null | 'loading'>('loading')

  useEffect(() => {
    fetch('/api/client/plans')
      .then((r) => (r.ok ? r.json() : []))
      .then((plans: WeekPlan[]) => setInfo(pickCurrentWeek(plans)))
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
