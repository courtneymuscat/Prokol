'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type CheatFood = {
  id: string
  food_name: string
  serve_category: string
  secondary_categories: string[]
  subcategory: string | null
  serving_desc: string | null
  household_measure: string | null
  calories_per_serve: number | null
  protein_per_serve: number | null
  carbs_per_serve: number | null
  fat_per_serve: number | null
}

type ServeTargets = {
  protein_serves: number; carb_serves: number; fat_serves: number
  fruit_serves: number; veg_unlimited: boolean; notes: string | null
} | null

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const
type MealKey = typeof MEAL_KEYS[number]
const MEAL_LABELS: Record<MealKey, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snack' }

const SERVE_OPTIONS = [0.5, 1, 1.5, 2]

function todayString() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function serveBadge(cat: string, sub: string | null) {
  if (sub === 'condiment_fat') return { label: '1F', color: 'bg-green-100 text-green-700' }
  if (sub === 'condiment_carb') return { label: '1C', color: 'bg-teal-100 text-teal-700' }
  if (sub === 'free_condiment') return { label: 'free', color: 'bg-gray-100 text-gray-500' }
  if (cat === 'protein') return { label: '1P', color: 'bg-pink-100 text-pink-700' }
  if (cat === 'carb') return { label: '1C', color: 'bg-teal-100 text-teal-700' }
  if (cat === 'fat') return { label: '1F', color: 'bg-green-100 text-green-700' }
  if (cat === 'fruit') return { label: '1 fruit', color: 'bg-orange-100 text-orange-700' }
  return null
}

function secondaryBadge(sec: string) {
  if (sec === 'fat')          return { label: '+1F',    color: 'bg-green-50 text-green-600 border border-green-200' }
  if (sec === 'carb')         return { label: '+1C',    color: 'bg-teal-50 text-teal-600 border border-teal-200' }
  if (sec === 'fat_half')     return { label: '+½F',    color: 'bg-green-50 text-green-600 border border-green-200' }
  if (sec === 'carb_half')    return { label: '+½C',    color: 'bg-teal-50 text-teal-600 border border-teal-200' }
  if (sec === 'protein_half') return { label: '+½P',    color: 'bg-rose-50 text-rose-500 border border-rose-200' }
  if (sec === 'protein')      return { label: '+1P',    color: 'bg-pink-100 text-pink-700 border border-pink-200' }
  return null
}

type CategoryGroup = { id: string; label: string; color: string; dot: string }

const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'protein',    label: 'Protein',     color: 'bg-pink-50 text-pink-700',   dot: 'bg-pink-400' },
  { id: 'carb',       label: 'Carbs',       color: 'bg-teal-50 text-teal-700', dot: 'bg-teal-400' },
  { id: 'fat',        label: 'Fats',        color: 'bg-green-50 text-green-700', dot: 'bg-green-400' },
  { id: 'fruit',      label: 'Fruit',       color: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
  { id: 'condiment',  label: 'Condiments',  color: 'bg-teal-50 text-teal-600', dot: 'bg-teal-300' },
  { id: 'free',       label: 'Free Foods',  color: 'bg-gray-50 text-gray-600',   dot: 'bg-gray-300' },
]

const PALM_GUIDE: Record<string, { icon: string; headline: string; body: string }> = {
  protein: {
    icon: '🤚',
    headline: 'No scales? Use your palm',
    body: '1 protein serve ≈ the palm of your hand (flat, no fingers) — works for meat, fish, tofu, and tempeh.',
  },
  carb: {
    icon: '✊',
    headline: 'No scales? Use your fist',
    body: '1 carb serve ≈ 1 fist of cooked grains or starchy veg. For bread and cereals, use the listed serve size.',
  },
  fat: {
    icon: '👍',
    headline: 'No scales? Use your thumb',
    body: 'Oils & nut butters ≈ tip of your thumb (1 tbsp). Nuts & seeds ≈ 1 small cupped palm. Avocado ≈ ½ fruit.',
  },
  fruit: {
    icon: '✊',
    headline: 'No scales? Use your fist',
    body: '1 fruit serve ≈ 1 fist-sized piece of whole fruit, or ~1 cup of berries.',
  },
}

function getGroupId(food: CheatFood): string {
  if (food.subcategory === 'condiment_fat' || food.subcategory === 'condiment_carb') return 'condiment'
  if (food.subcategory === 'free_condiment' || food.serve_category === 'free') return 'free'
  return food.serve_category
}

function getSubgroupLabel(sub: string | null): string | null {
  const map: Record<string, string> = {
    lean_protein: 'Lean', plant_protein: 'Plant-Based',
    grain: 'Grains', bread: 'Bread', starchy_veg: 'Starchy Veg', cereal: 'Cereals',
    seed: 'Seeds', nut: 'Nuts', nut_butter: 'Nut Butters', oil: 'Oils', cheese: 'Cheese',
    condiment_fat: 'Counts as Fat Serve', condiment_carb: 'Counts as Carb Serve',
  }
  return sub ? (map[sub] ?? null) : null
}

export default function ClientCheatSheet() {
  const [foods, setFoods] = useState<CheatFood[]>([])
  const [targets, setTargets] = useState<ServeTargets>(null)
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<string>('protein')
  const [selected, setSelected] = useState<CheatFood | null>(null)
  const [serves, setServes] = useState(1)
  const [meal, setMeal] = useState<MealKey>('breakfast')
  const [logging, setLogging] = useState(false)
  const [loggedMsg, setLoggedMsg] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/client/food-serves?list=true').then(r => r.json()),
      fetch('/api/client/serve-targets').then(r => r.json()),
    ]).then(([fd, st]) => {
      setFoods(fd.foods ?? [])
      if (st.targets) setTargets(st.targets)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const groupedFoods = foods.reduce<Record<string, CheatFood[]>>((acc, f) => {
    const g = getGroupId(f)
    ;(acc[g] ??= []).push(f)
    return acc
  }, {})

  const visibleFoods = groupedFoods[activeGroup] ?? []

  // Sub-group within a category (lean/plant, grains/bread etc)
  const subgrouped = visibleFoods.reduce<Record<string, CheatFood[]>>((acc, f) => {
    const sg = getSubgroupLabel(f.subcategory) ?? '_'
    ;(acc[sg] ??= []).push(f)
    return acc
  }, {})

  async function handleLog() {
    if (!selected) return
    setLogging(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLogging(false); return }

    const cal = Math.round((selected.calories_per_serve ?? 0) * serves)
    const pro = Math.round((selected.protein_per_serve ?? 0) * serves * 10) / 10
    const carb = Math.round((selected.carbs_per_serve ?? 0) * serves * 10) / 10
    const fat = Math.round((selected.fat_per_serve ?? 0) * serves * 10) / 10
    const servesLabel = serves === 1 ? '1 serve' : `${serves} serves`

    // Build a serving description that includes total grams for accurate serve tracking
    // e.g. "1.5 serves · 202.5g (135g raw per serve)"
    let servingDesc = servesLabel
    const descGramsMatch = selected.serving_desc?.match(/(\d+(?:\.\d+)?)\s*g\b/i)
    if (descGramsMatch) {
      const perServeG = parseFloat(descGramsMatch[1])
      const totalG = Math.round(perServeG * serves * 10) / 10
      servingDesc = `${servesLabel} · ${totalG}g (${selected.serving_desc})`
    } else if (selected.serving_desc) {
      servingDesc = `${servesLabel} (${selected.serving_desc})`
    }

    const { error } = await supabase.from('food_logs').insert({
      user_id: session.user.id,
      food_name: selected.food_name,
      calories: cal,
      protein: pro,
      carbs: carb,
      fat: fat,
      meal_type: meal,
      log_date: todayString(),
      serving_description: servingDesc,
    })

    setLogging(false)
    if (!error) {
      window.dispatchEvent(new Event('meal-logged'))
      setLoggedMsg(`${selected.food_name} logged to ${MEAL_LABELS[meal]}`)
      setSelected(null)
      setTimeout(() => setLoggedMsg(null), 3000)
    }
  }

  const activeGroupMeta = CATEGORY_GROUPS.find(g => g.id === activeGroup)!

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Food Cheat Sheet</h1>
            <p className="text-[11px] text-gray-400">Tap a food to log it</p>
          </div>
        </div>

        {/* Category pills */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORY_GROUPS.filter(g => (groupedFoods[g.id]?.length ?? 0) > 0).map(g => (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              className={`flex-shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
                activeGroup === g.id ? g.color + ' ring-1 ring-current ring-opacity-30' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">Loading cheat sheet…</div>
        ) : foods.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400">Your coach hasn&apos;t set up a food list yet.</p>
          </div>
        ) : (
          <>
            {/* Palm guide — once per category */}
            {PALM_GUIDE[activeGroup] && (() => {
              const guide = PALM_GUIDE[activeGroup]
              return (
                <div className="rounded-2xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: 'rgba(29,158,117,0.07)', border: '1px solid rgba(29,158,117,0.15)' }}>
                  <span className="text-2xl leading-none mt-0.5">{guide.icon}</span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>{guide.headline}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#1D9E75' }}>{guide.body}</p>
                  </div>
                </div>
              )
            })()}

            {Object.entries(subgrouped).map(([sg, items]) => (
              <div key={sg}>
                {sg !== '_' && (
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{sg}</p>
                )}
                <div className="space-y-2">
                  {items.map(food => {
                    const badge = serveBadge(food.serve_category, food.subcategory)
                    return (
                      <button
                        key={food.id}
                        onClick={() => { setSelected(food); setServes(1); setLoggedMsg(null) }}
                        className="w-full bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3 text-left hover:border-gray-300 active:scale-[0.99] transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{food.food_name}</span>
                            {food.secondary_categories?.map(s => {
                              const sb = secondaryBadge(s)
                              return sb ? (
                                <span key={s} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${sb.color}`}>{sb.label}</span>
                              ) : null
                            })}
                          </div>
                          {/* Household measure — hero display */}
                          {food.household_measure && (
                            <p className="text-sm font-semibold text-gray-700 mt-1">{food.household_measure}</p>
                          )}
                          {/* Gram weight — secondary reference */}
                          {food.serving_desc && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {food.household_measure ? `(${food.serving_desc})` : food.serving_desc}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-1">
                            {food.calories_per_serve ?? 0} cal
                            {' · '}
                            <span className="text-macro-p">{food.protein_per_serve ?? 0}g P</span>
                            {' · '}
                            <span className="text-macro-c">{food.carbs_per_serve ?? 0}g C</span>
                            {' · '}
                            <span className="text-macro-f">{food.fat_per_serve ?? 0}g F</span>
                          </p>
                        </div>
                        {badge && (
                          <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-xl ${badge.color}`}>
                            {badge.label}
                          </span>
                        )}
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Serve targets reminder */}
      {targets && (
        <div className="max-w-2xl mx-auto px-4 mt-6">
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Daily targets</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: `${targets.protein_serves}P`, color: 'bg-pink-50 text-pink-700' },
                { label: `${targets.carb_serves}C`, color: 'bg-teal-50 text-teal-700' },
                { label: `${targets.fat_serves}F`, color: 'bg-green-50 text-green-700' },
                { label: `${targets.fruit_serves} fruit`, color: 'bg-orange-50 text-orange-700' },
                { label: 'veg ∞', color: 'bg-emerald-50 text-emerald-700' },
              ].map(t => (
                <span key={t.label} className={`text-xs font-semibold px-3 py-1 rounded-full ${t.color}`}>{t.label}</span>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Each serve already counts toward your daily calories, including ~150 kcal estimated for vegetables. Veg is unlimited — eating more is always encouraged.
            </p>
            {targets.notes && <p className="text-xs text-gray-500 border-t border-gray-50 pt-2">{targets.notes}</p>}
          </div>
        </div>
      )}

      {/* Success toast */}
      {loggedMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-lg z-50 whitespace-nowrap">
          {loggedMsg}
        </div>
      )}

      {/* Log modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-xl">
            {/* Food info */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900">{selected.food_name}</h3>
                  {selected.household_measure && (
                    <p className="text-lg font-bold text-gray-800 mt-1">{selected.household_measure}</p>
                  )}
                  {selected.serving_desc && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selected.household_measure
                        ? `1 serve = ${selected.serving_desc}`
                        : `1 serve = ${selected.serving_desc}`}
                    </p>
                  )}
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Serves selector */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Serves</p>
              <div className="flex gap-2">
                {SERVE_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setServes(s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      serves === s
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    ×{s}
                  </button>
                ))}
              </div>
            </div>

            {/* Live macro preview */}
            <div className="bg-gray-50 rounded-2xl px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Calories</span>
                <span className="font-semibold text-gray-900">{Math.round((selected.calories_per_serve ?? 0) * serves)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-macro-p">Protein</span>
                <span className="font-semibold text-macro-p">{Math.round((selected.protein_per_serve ?? 0) * serves * 10) / 10}g</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-macro-c">Carbs</span>
                <span className="font-semibold text-macro-c">{Math.round((selected.carbs_per_serve ?? 0) * serves * 10) / 10}g</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-macro-f">Fat</span>
                <span className="font-semibold text-macro-f">{Math.round((selected.fat_per_serve ?? 0) * serves * 10) / 10}g</span>
              </div>
            </div>

            {/* Meal selector */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Log to</p>
              <div className="grid grid-cols-2 gap-2">
                {MEAL_KEYS.map(m => (
                  <button
                    key={m}
                    onClick={() => setMeal(m)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      meal === m
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {MEAL_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* Log button */}
            <button
              onClick={handleLog}
              disabled={logging}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-gray-900 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: 'var(--brand-primary, #1D9E75)' }}
            >
              {logging ? 'Logging…' : `Log to ${MEAL_LABELS[meal]}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
