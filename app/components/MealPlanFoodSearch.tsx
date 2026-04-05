'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type FoodResult = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  unit?: string
  custom?: boolean
  source?: string
}

export type MealFood = {
  food_id?: string
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function searchOFF(q: string, pageSize = 50, page = 1): Promise<{ results: FoodResult[]; total: number }> {
  try {
    const params = new URLSearchParams({ q, page: String(page), page_size: String(pageSize) })
    const res = await fetch(`/api/foods/off-search?${params}`, { signal: AbortSignal.timeout(14000) })
    if (!res.ok) return { results: [], total: 0 }
    return await res.json()
  } catch {
    return { results: [], total: 0 }
  }
}

function getRelevanceScore(name: string, q: string): number {
  const n = name.toLowerCase()
  if (n === q) return 5
  if (n.startsWith(q + ' ') || n.startsWith(q + ',')) return 4
  if (n.startsWith(q)) return 3
  if (n.split(/[\s,\-—]+/).some(w => w.startsWith(q))) return 2
  if (n.includes(q)) return 1
  return 0
}

function mergeResults(local: FoodResult[], off: FoodResult[], query: string): FoodResult[] {
  const localNames = new Set(local.map(f => f.name.toLowerCase()))
  const combined = [...local, ...off.filter(f => !localNames.has(f.name.toLowerCase()))]
  const q = query.toLowerCase().trim()
  return [...combined].sort((a, b) => getRelevanceScore(b.name, q) - getRelevanceScore(a.name, q))
}

function toMealFood(r: FoodResult, grams = 100): MealFood {
  const factor = grams / 100
  return {
    food_id: r.id,
    food_name: r.name,
    grams,
    calories: Math.round(r.calories_per_100g * factor),
    protein: Math.round(r.protein_per_100g * factor * 10) / 10,
    carbs: Math.round(r.carbs_per_100g * factor * 10) / 10,
    fat: Math.round(r.fat_per_100g * factor * 10) / 10,
  }
}

async function saveOFFFood(food: FoodResult): Promise<FoodResult> {
  try {
    const res = await fetch('/api/foods/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: food.name,
        calories_per_100g: food.calories_per_100g,
        protein_per_100g: food.protein_per_100g,
        carbs_per_100g: food.carbs_per_100g,
        fat_per_100g: food.fat_per_100g,
      }),
    })
    if (res.ok) return await res.json()
  } catch { /* use as-is */ }
  return food
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ResultRow({ food, onSelect }: { food: FoodResult; onSelect: (f: FoodResult) => void }) {
  return (
    <button
      type="button"
      onMouseDown={() => onSelect(food)}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{food.name}</p>
            {food.custom && (
              <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">My food</span>
            )}
            {food.source === 'off' && (
              <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">Global</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">per 100{food.unit === 'ml' ? 'ml' : 'g'}</p>
        </div>
        <span className="text-sm font-bold text-gray-700 whitespace-nowrap flex-shrink-0">
          {food.calories_per_100g ?? 0} kcal
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <span className="text-[11px] bg-purple-50 text-purple-600 font-medium px-1.5 py-0.5 rounded-full">P {food.protein_per_100g}g</span>
        <span className="text-[11px] bg-green-50 text-green-600 font-medium px-1.5 py-0.5 rounded-full">C {food.carbs_per_100g}g</span>
        <span className="text-[11px] bg-blue-50 text-blue-500 font-medium px-1.5 py-0.5 rounded-full">F {food.fat_per_100g}g</span>
      </div>
    </button>
  )
}

// ── Expanded modal (full OFF search with pagination) ──────────────────────────

function ExpandedModal({ initialQuery, onSelect, onClose }: {
  initialQuery: string
  onSelect: (f: FoodResult) => void
  onClose: () => void
}) {
  const [q, setQ] = useState(initialQuery)
  const [results, setResults] = useState<FoodResult[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalOff, setTotalOff] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeQuery = useRef(initialQuery)

  const hasMore = results.filter(r => r.source === 'off').length < totalOff

  const fetchPage = useCallback(async (query: string, p: number, reset: boolean) => {
    activeQuery.current = query
    setLoading(true)
    try {
      const [localRes, { results: offResults, total }] = await Promise.all([
        p === 1
          ? fetch(`/api/foods/search?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => [])
          : Promise.resolve([]),
        searchOFF(query, 50, p),
      ])
      if (activeQuery.current !== query) return
      const local: FoodResult[] = Array.isArray(localRes) ? localRes : []
      if (reset) {
        setResults(mergeResults(local, offResults, query))
        setTotalOff(total)
      } else {
        setResults(prev => {
          const prevNames = new Set(prev.map(r => r.name.toLowerCase()))
          return [...prev, ...offResults.filter(f => !prevNames.has(f.name.toLowerCase()))]
        })
        setTotalOff(total)
      }
      setPage(p)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialQuery.length >= 2) fetchPage(initialQuery, 1, true)
    inputRef.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q === initialQuery) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(() => fetchPage(q, 1, true), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, fetchPage, initialQuery])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search all foods…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {totalOff > 0 && (
          <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-400">
              {results.length} shown · {totalOff.toLocaleString()} total matches on Open Food Facts
            </p>
          </div>
        )}
        {/* Results */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <Spinner /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && q.length >= 2 && (
            <p className="text-sm text-gray-400 text-center py-10">No results found for &ldquo;{q}&rdquo;</p>
          )}
          {q.length < 2 && (
            <p className="text-sm text-gray-400 text-center py-10">Type at least 2 characters to search</p>
          )}
          {results.map((food, i) => (
            <ResultRow key={`${food.id}-${i}`} food={food} onSelect={onSelect} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => fetchPage(q, page + 1, false)}
              disabled={loading}
              className="w-full py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <><Spinner /> Loading…</>
                : `Load more (${(totalOff - results.filter(r => r.source === 'off').length).toLocaleString()} remaining from Open Food Facts)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MealPlanFoodSearch({ onAdd }: { onAdd: (food: MealFood) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const [localRes, { results: offResults }] = await Promise.all([
          fetch(`/api/foods/search?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => []),
          searchOFF(query, 30, 1),
        ])
        const local: FoodResult[] = Array.isArray(localRes) ? localRes : []
        setResults(mergeResults(local, offResults, query))
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSelect(food: FoodResult) {
    let resolved = food
    if (food.source === 'off') resolved = await saveOFFFood(food)
    onAdd(toMealFood(resolved, 100))
    setQuery('')
    setResults([])
    setOpen(false)
    setShowModal(false)
  }

  return (
    <>
      <div ref={containerRef} className="relative mt-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods to add…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-20 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {loading && <Spinner />}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowModal(true) }}
              className="text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors px-1.5"
            >
              More
            </button>
          </div>
        </div>

        {/* Inline dropdown */}
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-72 overflow-y-auto divide-y divide-gray-50">
            {results.map((food, i) => (
              <ResultRow key={`${food.id}-${i}`} food={food} onSelect={handleSelect} />
            ))}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowModal(true) }}
              className="w-full py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Search all of Open Food Facts →
            </button>
          </div>
        )}

        {/* No local results — prompt to try expanded */}
        {open && !loading && results.length === 0 && query.length >= 2 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-400">No foods found for &ldquo;{query}&rdquo;</p>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowModal(true) }}
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
            >
              Search Open Food Facts →
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <ExpandedModal
          initialQuery={query}
          onSelect={handleSelect}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
