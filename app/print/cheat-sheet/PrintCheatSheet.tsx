'use client'

import React, { useEffect, useState } from 'react'
import { useBranding } from '@/app/components/BrandingProvider'

type TaggedFood = {
  id: string
  food_name: string
  serve_category: string
  subcategory: string | null
  secondary_categories: string[]
  serving_desc: string | null
  household_measure: string | null
  calories_per_serve: number | null
  protein_per_serve: number | null
  carbs_per_serve: number | null
  fat_per_serve: number | null
}

const CATEGORIES = [
  { id: 'protein',   label: 'Protein',     serve: '1 serve = ~30g protein' },
  { id: 'carb',      label: 'Carbs',       serve: '1 serve = ~20g carbs' },
  { id: 'fruit',     label: 'Fruit',       serve: '1 serve = ~20g carbs' },
  { id: 'fat',       label: 'Fats',        serve: '1 serve = ~10g fat' },
  { id: 'condiment', label: 'Condiments',  serve: '~1 fat or carb serve' },
  { id: 'veg',       label: 'Vegetables',  serve: 'Unlimited / free' },
  { id: 'free',      label: 'Free Foods',  serve: 'Unlimited / ~0 cal' },
]

const SUBGROUP_LABELS: Record<string, string> = {
  lean_protein: 'Lean / Animal', plant_protein: 'Plant-Based',
  grain: 'Grains', bread: 'Bread', starchy_veg: 'Starchy Veg', cereal: 'Cereal',
  seed: 'Seeds', nut: 'Nuts', nut_butter: 'Nut Butter', oil: 'Oils', cheese: 'Cheese',
}

const SEC_LABELS: Record<string, string> = {
  fat: '+1 fat', carb: '+1 carb', fat_half: '+½ fat', carb_half: '+½ carb',
  protein_half: '+½ protein', protein: '+1 protein',
}

function groupBySubcategory(foods: TaggedFood[]): Array<{ label: string | null; items: TaggedFood[] }> {
  const map = new Map<string, TaggedFood[]>()
  for (const f of foods) {
    const key = f.subcategory ?? '_none'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(f)
  }
  const result: Array<{ label: string | null; items: TaggedFood[] }> = []
  const none = map.get('_none')
  if (none?.length) result.push({ label: null, items: none })
  for (const [key, items] of map) {
    if (key !== '_none') result.push({ label: SUBGROUP_LABELS[key] ?? key, items })
  }
  return result
}

export default function PrintCheatSheet() {
  const branding = useBranding()
  const [view, setView] = useState<'simple' | 'detailed'>('simple')
  const [loaded, setLoaded] = useState(false)
  const [tagged, setTagged] = useState<TaggedFood[]>([])
  const [orgName, setOrgName] = useState<string | null>(null)
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false)

  useEffect(() => {
    fetch('/api/coach/food-serves')
      .then(r => r.json())
      .then(d => {
        setTagged(d.foods ?? [])
        setOrgName(d.org_managed?.org_name ?? null)
      })
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!loaded || autoPrintTriggered) return
    const t = setTimeout(() => {
      window.print()
      setAutoPrintTriggered(true)
    }, 400)
    return () => clearTimeout(t)
  }, [loaded, autoPrintTriggered])

  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          .page-card { box-shadow: none !important; border: none !important; }
          .cat-block { break-inside: avoid; page-break-inside: avoid; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Preview — choose <strong>Save as PDF</strong> in the print dialog.</p>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 mr-2">
            <button
              onClick={() => setView('simple')}
              className={`px-3 py-1 rounded-md text-xs font-medium ${view === 'simple' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >Simple</button>
            <button
              onClick={() => setView('detailed')}
              className={`px-3 py-1 rounded-md text-xs font-medium ${view === 'detailed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >Detailed</button>
          </div>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
          >Close</button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
          >Print / Save as PDF</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 print:p-0">
        <div className="page-card bg-white rounded-2xl shadow-sm border border-gray-200 p-8 print:p-0">
          <div className="flex items-start justify-between gap-6 pb-5 border-b border-gray-200">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Reference Guide</p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">Food Sources Cheat Sheet</h1>
              {orgName && (
                <p className="text-xs text-gray-500 mt-1">Managed by {orgName}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3 text-[10px] font-semibold">
                <span className="border border-gray-200 rounded px-2 py-0.5 text-gray-700">1 Protein = 30g protein</span>
                <span className="border border-gray-200 rounded px-2 py-0.5 text-gray-700">1 Carb = 20g carbs</span>
                <span className="border border-gray-200 rounded px-2 py-0.5 text-gray-700">1 Fat = 10g fat</span>
              </div>
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

          {!loaded && (
            <p className="py-10 text-center text-sm text-gray-400 animate-pulse">Loading…</p>
          )}

          {loaded && tagged.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400 italic">No foods tagged yet.</p>
          )}

          <div className="pt-5 space-y-5">
            {CATEGORIES.map(cat => {
              const catFoods = tagged.filter(f => f.serve_category === cat.id)
              if (catFoods.length === 0) return null

              return (
                <div key={cat.id} className="cat-block">
                  <div className="flex items-baseline justify-between gap-3 mb-2 pb-1.5 border-b border-gray-200">
                    <h2 className="text-base font-bold text-gray-900">{cat.label}</h2>
                    <p className="text-xs text-gray-500">{cat.serve} · {catFoods.length} foods</p>
                  </div>

                  {view === 'detailed' ? (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left border-b border-gray-100">
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Food</th>
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Serving</th>
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Household</th>
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">kcal</th>
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">P</th>
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">C</th>
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">F</th>
                          <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Also</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupBySubcategory(catFoods).flatMap(({ label, items }) => [
                          label && (
                            <tr key={`h-${label}`}>
                              <td colSpan={8} className="pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</td>
                            </tr>
                          ),
                          ...items.map(f => (
                            <tr key={f.id} className="border-b border-gray-100 align-top">
                              <td className="py-1.5 pr-3 text-gray-900 font-medium">{f.food_name}</td>
                              <td className="py-1.5 pr-3 text-gray-700">{f.serving_desc ?? '—'}</td>
                              <td className="py-1.5 pr-3 text-gray-700">{f.household_measure ?? '—'}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums text-gray-700">{f.calories_per_serve ?? '—'}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums text-gray-700">{f.protein_per_serve ?? '—'}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums text-gray-700">{f.carbs_per_serve ?? '—'}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums text-gray-700">{f.fat_per_serve ?? '—'}</td>
                              <td className="py-1.5 text-[10px] text-gray-500">
                                {(f.secondary_categories ?? []).map(s => SEC_LABELS[s] ?? s).join(', ') || '—'}
                              </td>
                            </tr>
                          )),
                        ])}
                      </tbody>
                    </table>
                  ) : (
                    <div className="space-y-3">
                      {groupBySubcategory(catFoods).map(({ label, items }) => (
                        <div key={label ?? '_none'}>
                          {label && (
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
                          )}
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                            {items.map(f => (
                              <div key={f.id} className="text-sm text-gray-800 leading-tight">
                                <span className="font-medium">{f.food_name}</span>
                                {f.household_measure && (
                                  <span className="text-gray-500"> — {f.household_measure}</span>
                                )}
                                {f.serving_desc && (
                                  <span className="text-gray-400 text-xs"> ({f.serving_desc})</span>
                                )}
                                {(f.secondary_categories ?? []).length > 0 && (
                                  <span className="text-[10px] text-gray-500 ml-1">
                                    [{f.secondary_categories.map(s => SEC_LABELS[s] ?? s).join(', ')}]
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-400">
            <span>{branding.appName}</span>
            <span>Food Sources Cheat Sheet</span>
          </div>
        </div>
      </div>
    </div>
  )
}
