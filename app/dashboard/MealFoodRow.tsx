'use client'

import { useState, useEffect, useRef } from 'react'
import type { FoodResult } from './FoodSearch'

export type RowData = {
  food: FoodResult | null
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

type Props = {
  onChange: (data: RowData) => void
  onRemove: () => void
}

function calc(food: FoodResult, grams: number) {
  const f = grams / 100
  return {
    calories: Math.round(food.calories_per_100g * f),
    protein: Math.round(food.protein_per_100g * f * 10) / 10,
    carbs: Math.round(food.carbs_per_100g * f * 10) / 10,
    fat: Math.round(food.fat_per_100g * f * 10) / 10,
  }
}

export default function MealFoodRow({ onChange, onRemove }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [food, setFood] = useState<FoodResult | null>(null)
  const [grams, setGrams] = useState(100)
  const [unit, setUnit] = useState<'g' | 'ml'>('g')
  const [creatingFood, setCreatingFood] = useState(false)
  const [newFood, setNewFood] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' })
  const [foodScope, setFoodScope] = useState<'personal' | 'global'>('personal')
  const [savingNew, setSavingNew] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`)
        setResults(await res.json())
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectFood(f: FoodResult) {
    setFood(f)
    setQuery(f.name)
    setOpen(false)
    setUnit(f.unit === 'ml' ? 'ml' : 'g')
    onChange({ food: f, grams, ...calc(f, grams) })
  }

  function updateGrams(g: number) {
    setGrams(g)
    if (food) onChange({ food, grams: g, ...calc(food, g) })
  }

  async function handleSaveNewFood() {
    if (!newFood.name.trim()) return
    setSavingNew(true)
    const endpoint = foodScope === 'global' ? '/api/foods/save' : '/api/foods/custom'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newFood.name,
        calories_per_100g: Number(newFood.calories) || 0,
        protein_per_100g: Number(newFood.protein) || 0,
        carbs_per_100g: Number(newFood.carbs) || 0,
        fat_per_100g: Number(newFood.fat) || 0,
      }),
    })
    const saved: FoodResult = await res.json()
    setSavingNew(false)
    setCreatingFood(false)
    setNewFood({ name: '', calories: '', protein: '', carbs: '', fat: '' })
    selectFood(saved)
  }

  const macros = food ? calc(food, grams) : null

  return (
    <div ref={containerRef} className="relative bg-gray-50 rounded-xl border border-gray-100">
      <div className="grid grid-cols-[1fr_90px_auto_auto] gap-2 items-center p-3">
      {/* Food search */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (food) setFood(null) }}
          placeholder="Search food..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
        />
        {loading && (
          <div className="absolute right-2.5 top-2.5">
            <svg className="animate-spin h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {/* Amount + unit */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          value={grams}
          onChange={(e) => updateGrams(Number(e.target.value))}
          disabled={!food}
          className="w-full min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
        />
        <span className="px-1.5 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded flex-shrink-0">{unit}</span>
      </div>

      {/* Macros */}
      <div className="flex items-center gap-1.5 text-xs min-w-0">
        {macros ? (
          <>
            <span className="font-semibold text-gray-700 whitespace-nowrap">{macros.calories} kcal</span>
            <span className="text-macro-p whitespace-nowrap">P {macros.protein}g</span>
            <span className="text-macro-c whitespace-nowrap">C {macros.carbs}g</span>
            <span className="text-macro-f whitespace-nowrap">F {macros.fat}g</span>
          </>
        ) : (
          <span className="text-gray-300 text-xs">— select a food</span>
        )}
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-300 hover:text-red-400 transition-colors justify-self-end"
        aria-label="Remove food"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      </div>

      {/* Create food form */}
      {creatingFood && (
        <div className="border-t border-gray-100 p-3 space-y-2 bg-white rounded-b-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Create New Food</p>
            <button type="button" onClick={() => setCreatingFood(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            placeholder="Food name (required)"
            value={newFood.name}
            onChange={(e) => setNewFood((f) => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="grid grid-cols-4 gap-1.5">
            {([
              { key: 'calories', placeholder: 'kcal' },
              { key: 'protein', placeholder: 'P (g)' },
              { key: 'carbs', placeholder: 'C (g)' },
              { key: 'fat', placeholder: 'F (g)' },
            ] as const).map(({ key, placeholder }) => (
              <input
                key={key}
                type="number"
                min={0}
                step="any"
                placeholder={placeholder}
                value={newFood[key]}
                onChange={(e) => setNewFood((f) => ({ ...f, [key]: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFoodScope('personal')}
                className={`px-2.5 py-1 transition-colors ${foodScope === 'personal' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                My Foods
              </button>
              <button
                type="button"
                onClick={() => setFoodScope('global')}
                className={`px-2.5 py-1 transition-colors border-l border-gray-200 ${foodScope === 'global' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Shared
              </button>
            </div>
            <button
              type="button"
              onClick={handleSaveNewFood}
              disabled={!newFood.name.trim() || savingNew}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {savingNew ? 'Saving...' : 'Save & Select'}
            </button>
          </div>
        </div>
      )}

      {/* Dropdown — outside grid so it spans full width */}
      {open && (results.length > 0 || query.length >= 2) && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {results.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => selectFood(f)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                  {f.unit === 'ml' && <span className="flex-shrink-0 text-xs font-medium px-1 py-0.5 rounded bg-cyan-50 text-cyan-600">liquid</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  per 100{f.unit === 'ml' ? 'ml' : 'g'} · {f.calories_per_100g ?? 0} kcal · P {f.protein_per_100g ?? 0}g · C {f.carbs_per_100g ?? 0}g · F {f.fat_per_100g ?? 0}g
                </p>
              </button>
            </li>
          ))}
          {query.length >= 2 && (
            <li>
              <button
                type="button"
                onClick={() => { setCreatingFood(true); setNewFood((f) => ({ ...f, name: query })); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-blue-600 border-t border-gray-50"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium">Create &ldquo;{query}&rdquo;</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
