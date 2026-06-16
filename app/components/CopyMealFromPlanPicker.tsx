'use client'

import { useEffect, useState } from 'react'

type MealFood = {
  food_id?: string
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  serving_qty?: number
  unit?: string
  _key?: string
}

type MealSlot = {
  id: string
  label: string
  foods: MealFood[]
  notes?: string
  target_calories?: number | null
  target_protein?: number | null
  target_carbs?: number | null
  target_fat?: number | null
}

type Source = 'client' | 'template'

type PlanSummary = {
  id: string
  name: string
  content: MealSlot[] | null
  source: Source
}

type Props = {
  excludePlanId?: string
  clientId?: string
  onPick: (slot: MealSlot) => void
  onClose: () => void
}

export default function CopyMealFromPlanPicker({ excludePlanId, clientId, onPick, onClose }: Props) {
  const [plans, setPlans] = useState<PlanSummary[] | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const sources: Promise<PlanSummary[]>[] = [
      fetch('/api/coach/meal-plans?archived=0')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : []).map((p: { id: string; name: string; content: MealSlot[] | null }) => ({
          id: p.id, name: p.name, content: p.content, source: 'template' as const,
        })))
        .catch(() => []),
    ]
    if (clientId) {
      sources.push(
        fetch(`/api/coach/clients/${clientId}/meal-plans`)
          .then((r) => r.json())
          .then((d) => (Array.isArray(d) ? d : []).map((p: { id: string; name: string; content: MealSlot[] | null }) => ({
            id: p.id, name: p.name, content: p.content, source: 'client' as const,
          })))
          .catch(() => []),
      )
    }
    Promise.all(sources).then((results) => {
      if (cancelled) return
      const merged = results.flat().filter((p) => p.id !== excludePlanId)
      setPlans(merged)
    }).catch(() => { if (!cancelled) setError('Could not load meal plans') })
    return () => { cancelled = true }
  }, [excludePlanId, clientId])

  const selectedPlan = selectedPlanId ? plans?.find((p) => p.id === selectedPlanId) ?? null : null
  const clientPlans = (plans ?? []).filter((p) => p.source === 'client')
  const templatePlans = (plans ?? []).filter((p) => p.source === 'template')

  function macroSummary(slot: MealSlot): string {
    if (slot.foods.length === 0) {
      const cal = slot.target_calories ?? 0
      return cal > 0 ? `${Math.round(cal)} kcal (target)` : 'Empty'
    }
    const cal = slot.foods.reduce((s, f) => s + (f.calories || 0), 0)
    return `${Math.round(cal)} kcal · ${slot.foods.length} food${slot.foods.length === 1 ? '' : 's'}`
  }

  function renderPlanGroup(label: string, group: PlanSummary[]) {
    if (group.length === 0) return null
    return (
      <div className="mb-3 last:mb-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1">{label}</p>
        <ul className="space-y-1">
          {group.map((p) => {
            const count = (p.content ?? []).length
            return (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedPlanId(p.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors"
                >
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{count} meal{count === 1 ? '' : 's'}</p>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">
              {selectedPlan ? selectedPlan.name : 'Import a meal'}
            </h2>
            <p className="text-xs text-gray-400">
              {selectedPlan ? 'Pick a meal to copy into this plan' : 'Pick a meal plan to copy from'}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {selectedPlan && (
              <button onClick={() => setSelectedPlanId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                ← Back
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {error && <p className="text-xs text-red-500 px-2 py-3">{error}</p>}
          {!error && plans === null && <p className="text-xs text-gray-400 px-2 py-6 text-center">Loading…</p>}

          {!selectedPlan && plans && plans.length === 0 && (
            <p className="text-xs text-gray-400 px-2 py-6 text-center">No other meal plans to copy from.</p>
          )}

          {!selectedPlan && plans && plans.length > 0 && (
            <>
              {renderPlanGroup("This client's plans", clientPlans)}
              {renderPlanGroup('Your templates', templatePlans)}
            </>
          )}

          {selectedPlan && (
            (selectedPlan.content ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-6 text-center">This plan has no meals to copy.</p>
            ) : (
              <ul className="space-y-1">
                {(selectedPlan.content ?? []).map((slot) => (
                  <li key={slot.id}>
                    <button
                      onClick={() => onPick(slot)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-colors"
                    >
                      <p className="text-sm font-semibold text-gray-900 truncate">{slot.label || 'Unnamed meal'}</p>
                      <p className="text-xs text-gray-400">{macroSummary(slot)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  )
}
