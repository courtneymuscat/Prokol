'use client'

import { useState, useEffect, useRef } from 'react'

type FoodLog = {
  id: string
  food_name: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  serving_description: string | null
}

type SearchFood = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

type ServingUnit = 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp'
const UNIT_TO_G: Record<ServingUnit, number> = { g: 1, ml: 1, oz: 28.35, cup: 240, tbsp: 15, tsp: 5 }

function parseGramsFromDesc(desc: string | null): number | null {
  if (!desc) return null
  const all = [...(desc.matchAll(/(\d+(?:\.\d+)?)\s*g\b/gi))]
  return all.length > 0 ? parseFloat(all[0][1]) : null
}

function fmt1(n: number) { return Math.round(n * 10) / 10 }

export default function EditFoodLogForm({
  log,
  onSave,
  onCancel,
}: {
  log: FoodLog
  onSave: (update: {
    food_name: string | null
    serving_description: string | null
    calories: number
    protein: number
    carbs: number
    fat: number
  }) => void
  onCancel: () => void
}) {
  const parsedGrams = parseGramsFromDesc(log.serving_description)
  const baseGrams = parsedGrams ?? 100

  // Per-gram ratios derived from current log (used until DB lookup completes)
  const derivedPerGram = {
    cal: log.calories / baseGrams,
    pro: log.protein  / baseGrams,
    carb: log.carbs   / baseGrams,
    fat: log.fat      / baseGrams,
  }

  const [foodName, setFoodName] = useState(log.food_name ?? '')
  const [unit, setUnit] = useState<ServingUnit>('g')
  const [qty, setQty] = useState(baseGrams)
  const [perGram, setPerGram] = useState(derivedPerGram)
  const [searching, setSearching] = useState(false)
  const [changing, setChanging] = useState(false)
  const [searchQuery, setSearchQuery] = useState(log.food_name ?? '')
  const [searchResults, setSearchResults] = useState<SearchFood[]>([])
  const [manualSearching, setManualSearching] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const grams = qty * UNIT_TO_G[unit]
  const cal  = Math.round(perGram.cal  * grams)
  const pro  = fmt1(perGram.pro  * grams)
  const carb = fmt1(perGram.carb * grams)
  const fat  = fmt1(perGram.fat  * grams)

  // Auto-search for per-100g values in background for better accuracy
  useEffect(() => {
    if (!log.food_name || log.food_name.length < 2) return
    setSearching(true)
    fetch(`/api/foods/search?q=${encodeURIComponent(log.food_name)}`)
      .then(r => r.json())
      .then((data: SearchFood[]) => {
        if (!Array.isArray(data)) return
        const exact = data.find(f => f.name.toLowerCase() === log.food_name!.toLowerCase())
        const match = exact ?? data[0] ?? null
        if (match) {
          setPerGram({
            cal:  match.calories_per_100g / 100,
            pro:  match.protein_per_100g  / 100,
            carb: match.carbs_per_100g    / 100,
            fat:  match.fat_per_100g      / 100,
          })
        }
      })
      .catch(() => {})
      .finally(() => setSearching(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Manual food search while "changing"
  useEffect(() => {
    if (!changing || searchQuery.length < 2) { setSearchResults([]); return }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setManualSearching(true)
      try {
        const r = await fetch(`/api/foods/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await r.json()
        setSearchResults(Array.isArray(data) ? data.slice(0, 8) : [])
      } finally { setManualSearching(false) }
    }, 300)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [searchQuery, changing])

  function selectFood(food: SearchFood) {
    setFoodName(food.name)
    setSearchQuery(food.name)
    setSearchResults([])
    setChanging(false)
    setPerGram({
      cal:  food.calories_per_100g / 100,
      pro:  food.protein_per_100g  / 100,
      carb: food.carbs_per_100g    / 100,
      fat:  food.fat_per_100g      / 100,
    })
    setQty(100)
    setUnit('g')
  }

  function handleSave() {
    onSave({
      food_name: foodName.trim() || null,
      serving_description: `${qty}${unit}`,
      calories: cal,
      protein:  pro,
      carbs:    carb,
      fat:      fat,
    })
  }

  return (
    <div className="px-4 py-3 space-y-3 bg-blue-50/40 border-t border-blue-100">

      {/* Selected food card */}
      {!changing ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              Selected {searching && <span className="font-normal normal-case text-blue-400">· updating…</span>}
            </p>
            <button type="button" onClick={() => { setChanging(true); setSearchQuery(foodName) }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors">
              Change
            </button>
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">{foodName || log.food_name}</p>

          {/* Serving size */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-gray-600 whitespace-nowrap">Serving size:</label>
            <input
              type="number" min={0.1} step={1} value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
              className="w-16 border border-blue-200 rounded-lg px-2 py-1 text-sm text-center font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <select value={unit} onChange={(e) => setUnit(e.target.value as ServingUnit)}
              className="border border-blue-200 rounded-lg px-2 py-1 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-700">
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="oz">oz</option>
              <option value="cup">cup</option>
              <option value="tbsp">tbsp</option>
              <option value="tsp">tsp</option>
            </select>
          </div>

          {/* Macro grid — always visible */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'kcal', val: String(cal),    unit: '',  color: 'text-gray-900' },
              { label: 'g',    val: String(pro),    unit: 'P', color: 'text-rose-500' },
              { label: 'g',    val: String(carb),   unit: 'C', color: 'text-purple-500' },
              { label: 'g',    val: String(fat),    unit: 'F', color: 'text-blue-400'  },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-lg p-2 text-center">
                <p className={`text-sm font-bold ${m.color}`}>{m.val}</p>
                <p className="text-[10px] text-gray-400">{m.unit || m.label}</p>
                {m.unit && <p className="text-[10px] text-gray-300">{m.label}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Change food search */
        <div className="relative">
          <div className="relative flex items-center">
            <svg className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              autoFocus type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food database…"
              className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <div className="absolute right-3 flex items-center gap-1">
              {manualSearching && (
                <svg className="animate-spin h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <button type="button" onClick={() => setChanging(false)}
                className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
          </div>
          {searchResults.length > 0 && (
            <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map(f => (
                <button key={f.id} type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectFood(f) }}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  <p className="text-sm font-medium text-gray-900">{f.name}</p>
                  <p className="text-xs text-gray-400">per 100g: {Math.round(f.calories_per_100g)} kcal · P {f.protein_per_100g}g · C {f.carbs_per_100g}g · F {f.fat_per_100g}g</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={!foodName.trim() || grams <= 0}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
          Save changes
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm rounded-xl hover:bg-gray-100 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
