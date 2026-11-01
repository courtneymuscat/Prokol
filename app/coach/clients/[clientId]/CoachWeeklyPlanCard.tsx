'use client'

import { useState, useEffect } from 'react'
import { pickCurrentWeek, type WeekInfo, type WeekPlan } from '@/lib/weeklyPlan'

export default function CoachWeeklyPlanCard({ clientId }: { clientId: string }) {
  const [info, setInfo] = useState<WeekInfo | null | 'loading'>('loading')

  useEffect(() => {
    async function load() {
      try {
        const plans: (WeekPlan & { is_visible_to_client: boolean })[] =
          await fetch(`/api/coach/clients/${clientId}/plans`).then(r => r.json())
        if (!Array.isArray(plans) || plans.length === 0) { setInfo(null); return }

        // Only a plan actually visible to the client can be "what they're
        // on this week" — matches exactly what their own dashboard and the
        // Daily Target (when sourced from the weekly plan) would show.
        const visible = plans.filter(p => p.is_visible_to_client)
        if (visible.length === 0) { setInfo(null); return }

        // Fetch full plans (phases + week_data + notes) and pick whichever
        // one is actually in range right now — same precedence rule used
        // everywhere else this is computed.
        const fulls = await Promise.all(
          visible.map(p => fetch(`/api/coach/clients/${clientId}/plans/${p.id}`).then(r => r.json()))
        )
        setInfo(pickCurrentWeek(fulls.filter((f): f is WeekPlan => !!f?.id)))
      } catch {
        setInfo(null)
      }
    }
    load()
  }, [clientId])

  if (info === 'loading') return (
    <div className="bg-white rounded-2xl border p-5">
      <p className="text-xs text-gray-400">Loading weekly plan…</p>
    </div>
  )
  if (!info) return null

  const { weekNumber, totalWeeks, phaseName, note, coachNote, calories, protein, carbs, fat, fibre } = info
  const hasMacros = calories || protein || carbs || fat || fibre

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-3">
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

      {/* Client-visible note — same as what client sees */}
      {note && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Client note</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{note}</p>
        </div>
      )}

      {/* Coach-internal note — not visible to client */}
      {coachNote && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 space-y-1">
          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Coach note (internal)</p>
          <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-line">{coachNote}</p>
        </div>
      )}
    </div>
  )
}
