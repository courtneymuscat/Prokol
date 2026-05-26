'use client'

import { useEffect } from 'react'
import { useBranding } from '@/app/components/BrandingProvider'

type MealFood = {
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  serving_qty?: number
  unit?: string
  coach_note?: string | null
  image_url?: string | null
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

export type PrintablePlan = {
  name: string
  total_calories?: number | null
  content: MealSlot[]
  notes?: string | null
  start_date?: string | null
  end_date?: string | null
  show_macros?: boolean
}

function formatServing(food: MealFood): string {
  if (food.serving_qty != null && food.unit) {
    const q = Number(food.serving_qty)
    const qStr = Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')
    const grams = food.grams && (food.unit !== 'g' && food.unit !== 'ml')
      ? ` (≈ ${Math.round(food.grams)}g)`
      : ''
    return `${qStr} ${food.unit}${grams}`
  }
  return `${Math.round(food.grams)}g`
}

function computeTotals(content: MealSlot[]) {
  let calories = 0, protein = 0, carbs = 0, fat = 0
  for (const slot of content) {
    if (slot.foods.length > 0) {
      for (const food of slot.foods) {
        calories += food.calories
        protein += food.protein
        carbs += food.carbs
        fat += food.fat
      }
    } else {
      calories += slot.target_calories ?? 0
      protein += slot.target_protein ?? 0
      carbs += slot.target_carbs ?? 0
      fat += slot.target_fat ?? 0
    }
  }
  return { calories, protein, carbs, fat }
}

export default function PrintMealPlan({
  plan,
  clientName = null,
  autoPrint = true,
}: {
  plan: PrintablePlan
  clientName?: string | null
  autoPrint?: boolean
}) {
  const branding = useBranding()
  const showMacros = plan.show_macros !== false
  const totals = computeTotals(plan.content)

  useEffect(() => {
    if (!autoPrint) return
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [autoPrint])

  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          .page-card { box-shadow: none !important; border: none !important; }
          .meal-slot { break-inside: avoid; page-break-inside: avoid; }
          body { background: white !important; }
        }
      `}</style>

      {/* Toolbar — hidden in print */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Preview — your browser&apos;s print dialog will open. Choose <strong>Save as PDF</strong> as the destination.</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.close()}
            className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 print:p-0">
        <div className="page-card bg-white rounded-2xl shadow-sm border border-gray-200 p-8 print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 pb-5 border-b border-gray-200">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Meal Plan</p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">{plan.name}</h1>
              {clientName && (
                <p className="text-sm text-gray-600 mt-1">Prepared for <span className="font-semibold">{clientName}</span></p>
              )}
              {(plan.start_date || plan.end_date) && (
                <p className="text-xs text-gray-500 mt-1">
                  {plan.start_date ? new Date(plan.start_date).toLocaleDateString() : 'No start date'}
                  {plan.end_date ? ` → ${new Date(plan.end_date).toLocaleDateString()}` : ''}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt={branding.appName} className="h-10 w-auto ml-auto mb-1" />
              ) : (
                <p className="text-base font-bold" style={{ color: branding.brandColourText }}>{branding.appName}</p>
              )}
              <p className="text-[11px] text-gray-400 mt-0.5">Generated {today}</p>
            </div>
          </div>

          {/* Totals */}
          {showMacros && (
            <div className="flex flex-wrap items-center gap-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Daily Total</p>
                <p className="text-lg font-bold text-gray-900">{Math.round(totals.calories).toLocaleString()} kcal</p>
              </div>
              {plan.total_calories != null && plan.total_calories > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Target</p>
                  <p className="text-lg font-bold text-gray-700">{plan.total_calories.toLocaleString()} kcal</p>
                </div>
              )}
              <div className="flex gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Protein</p>
                  <p className="text-sm font-semibold text-gray-800">{totals.protein.toFixed(1)} g</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Carbs</p>
                  <p className="text-sm font-semibold text-gray-800">{totals.carbs.toFixed(1)} g</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Fat</p>
                  <p className="text-sm font-semibold text-gray-800">{totals.fat.toFixed(1)} g</p>
                </div>
              </div>
            </div>
          )}

          {/* Plan-level notes */}
          {plan.notes && (
            <div className="py-4 border-b border-gray-100">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.notes}</p>
            </div>
          )}

          {/* Meal slots */}
          <div className="pt-5 space-y-5">
            {plan.content.length === 0 && (
              <p className="text-sm text-gray-400 italic">This meal plan has no meals yet.</p>
            )}
            {plan.content.map((slot, i) => {
              const slotTotals = computeTotals([slot])
              const hasCalTarget = (slot.target_calories ?? 0) > 0
              const targetParts: string[] = []
              if (hasCalTarget) targetParts.push(`${slot.target_calories} kcal`)
              if ((slot.target_protein ?? 0) > 0) targetParts.push(`P ${slot.target_protein}g`)
              if ((slot.target_carbs ?? 0) > 0) targetParts.push(`C ${slot.target_carbs}g`)
              if ((slot.target_fat ?? 0) > 0) targetParts.push(`F ${slot.target_fat}g`)
              return (
                <div key={slot.id ?? i} className="meal-slot">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <h2 className="text-base font-bold text-gray-900">{slot.label || `Meal ${i + 1}`}</h2>
                    {showMacros && slot.foods.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {Math.round(slotTotals.calories)} kcal · P {slotTotals.protein.toFixed(0)}g · C {slotTotals.carbs.toFixed(0)}g · F {slotTotals.fat.toFixed(0)}g
                      </p>
                    )}
                  </div>
                  {showMacros && targetParts.length > 0 && (
                    <p className="text-[11px] text-gray-500 mb-2">
                      <span className="font-semibold uppercase tracking-wide text-gray-400">Target </span>
                      {targetParts.join(' · ')}
                    </p>
                  )}

                  {slot.foods.length === 0 ? (
                    <p className="text-xs text-gray-400 italic pl-1">No foods added.</p>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left border-b border-gray-200">
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Food</th>
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Serving</th>
                          {showMacros && (
                            <>
                              <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">kcal</th>
                              <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">P</th>
                              <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">C</th>
                              <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">F</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {slot.foods.map((food, fi) => (
                          <tr key={fi} className="border-b border-gray-100 align-top">
                            <td className="py-1.5 pr-3 text-gray-900">
                              <div className="font-medium">{food.food_name}</div>
                              {food.coach_note && (
                                <div className="text-[11px] text-gray-500 italic mt-0.5">{food.coach_note}</div>
                              )}
                              {food.image_url && (
                                <div className="text-[10px] text-blue-600 mt-0.5 break-all">{food.image_url}</div>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-gray-700 whitespace-nowrap">{formatServing(food)}</td>
                            {showMacros && (
                              <>
                                <td className="py-1.5 pr-3 text-right text-gray-700 tabular-nums">{Math.round(food.calories)}</td>
                                <td className="py-1.5 pr-3 text-right text-gray-700 tabular-nums">{food.protein.toFixed(1)}</td>
                                <td className="py-1.5 pr-3 text-right text-gray-700 tabular-nums">{food.carbs.toFixed(1)}</td>
                                <td className="py-1.5 text-right text-gray-700 tabular-nums">{food.fat.toFixed(1)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {slot.notes && (
                    <div className="mt-2 text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">
                      {slot.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-400">
            <span>{branding.appName}</span>
            <span>{plan.name}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
